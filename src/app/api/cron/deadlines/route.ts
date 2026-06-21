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

  return NextResponse.json({
    ok: true,
    overdue: overdueCount,
    approaching: approachingCount,
    notified: adminEmails.length,
  });
}
