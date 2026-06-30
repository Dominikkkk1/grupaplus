import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { deadlineDigestEmail } from "@/lib/email/templates";

/**
 * GET /api/cron/deadlines — codzienny monitoring terminow
 *
 * Wywoływany przez Vercel Cron (raz dziennie o 7:00).
 * Wysyla digest email do adminow jesli sa zamowienia:
 * - po terminie (deadline < NOW())
 * - z terminem w ciagu 2 dni
 */
export async function GET(request: NextRequest) {
  // Weryfikacja — tylko Vercel Cron lub CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const excludedStatuses = ["shipped", "delivered", "cancelled"];

  // Zamowienia po terminie
  const { data: overdue } = await supabase
    .from("orders")
    .select("id, order_number, status, deadline, contact:contacts(full_name)")
    .lt("deadline", now.toISOString())
    .not("status", "in", `(${excludedStatuses.join(",")})`)
    .order("deadline");

  // Zamowienia z terminem w ciagu 2 dni (ale jeszcze nie po terminie)
  const { data: approaching } = await supabase
    .from("orders")
    .select("id, order_number, status, deadline, contact:contacts(full_name)")
    .gte("deadline", now.toISOString())
    .lte("deadline", twoDaysFromNow.toISOString())
    .not("status", "in", `(${excludedStatuses.join(",")})`)
    .order("deadline");

  const overdueCount = overdue?.length ?? 0;
  const approachingCount = approaching?.length ?? 0;

  console.log(
    "[CRON DEADLINES] overdue=%d approaching=%d",
    overdueCount,
    approachingCount
  );

  // Jesli nie ma nic do raportowania — cicho wyjdz
  if (overdueCount === 0 && approachingCount === 0) {
    return NextResponse.json({ ok: true, message: "no deadlines at risk" });
  }

  // Pobierz emaile adminow
  const { data: admins } = await supabase
    .from("users")
    .select("email")
    .eq("role", "admin")
    .eq("is_active", true);

  const adminEmails = (admins ?? [])
    .map((a) => a.email)
    .filter((e): e is string => !!e);

  if (adminEmails.length === 0) {
    console.warn("[CRON DEADLINES] brak aktywnych adminow z emailem");
    return NextResponse.json({ ok: true, message: "no admin emails" });
  }

  type DeadlineOrder = {
    order_number: string;
    status: string;
    deadline: string;
    customer: string;
  };

  const formatOrders = (
    orders: typeof overdue
  ): DeadlineOrder[] =>
    (orders ?? []).map((o) => ({
      order_number: o.order_number,
      status: o.status,
      deadline: o.deadline!,
      customer:
        (o.contact as unknown as { full_name: string } | null)?.full_name ??
        "—",
    }));

  const { subject, html } = deadlineDigestEmail({
    overdue: formatOrders(overdue),
    approaching: formatOrders(approaching),
  });

  // Wyslij do kazdego admina
  for (const email of adminEmails) {
    await sendEmail({ to: email, subject, html });
  }

  // Auto-notify: awaiting_approval > 3 dni
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const { data: staleApprovals } = await supabase
    .from("orders")
    .select("id, order_number, sent_for_approval_at, contact:contacts(full_name)")
    .eq("status", "awaiting_approval")
    .eq("approval_reminder_sent", false)
    .lt("sent_for_approval_at", threeDaysAgo.toISOString());

  if (staleApprovals && staleApprovals.length > 0) {
    console.log("[CRON DEADLINES] stale approvals: %d", staleApprovals.length);

    // Dodaj do digest emaila (wyslij osobny email o akceptacjach)
    const approvalList = staleApprovals.map((o) => {
      const days = Math.floor((now.getTime() - new Date(o.sent_for_approval_at!).getTime()) / (1000 * 60 * 60 * 24));
      const customer = (o.contact as unknown as { full_name: string } | null)?.full_name ?? "—";
      return `${o.order_number} — ${customer} (${days} dni)`;
    }).join("<br>");

    for (const email of adminEmails) {
      await sendEmail({
        to: email,
        subject: `Zamówienia oczekujące na akceptację (${staleApprovals.length})`,
        html: `<h2>Zamówienia oczekujące na akceptację klienta powyżej 3 dni</h2><p>${approvalList}</p><p>Prosimy o kontakt z klientami.</p>`,
      });
    }

    await supabase
      .from("orders")
      .update({ approval_reminder_sent: true })
      .in("id", staleApprovals.map((o) => o.id));
  }

  // Auto-delivered: shipped > 7 dni → delivered
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { count: deliveredCount } = await supabase
    .from("orders")
    .update({ status: "delivered" }, { count: "exact" })
    .eq("status", "shipped")
    .lt("updated_at", sevenDaysAgo.toISOString());

  if (deliveredCount && deliveredCount > 0) {
    console.log("[CRON DEADLINES] auto-delivered: %d zamówień", deliveredCount);
  }

  // Auto-close complaints: in_progress > 14 dni → resolved
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const { count: closedComplaints } = await supabase
    .from("complaints")
    .update(
      { status: "resolved", resolved_at: now.toISOString() },
      { count: "exact" }
    )
    .eq("status", "in_progress")
    .lt("created_at", fourteenDaysAgo.toISOString());

  if (closedComplaints && closedComplaints > 0) {
    console.log("[CRON DEADLINES] auto-closed complaints: %d", closedComplaints);
  }

  return NextResponse.json({
    ok: true,
    overdue: overdueCount,
    approaching: approachingCount,
    notified: adminEmails.length,
    autoDelivered: deliveredCount ?? 0,
    autoClosedComplaints: closedComplaints ?? 0,
    staleApprovals: staleApprovals?.length ?? 0,
  });
}
