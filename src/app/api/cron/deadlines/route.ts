import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { deadlineDigestEmail } from "@/lib/email/templates";
import { getActiveAdminEmails } from "@/lib/email/recipients";
import { APPROVAL_DEADLINE_HOURS, approvalCutoffISO, approvalWaitingHours, formatWaitingTime } from "@/lib/approval";

/**
 * GET /api/cron/deadlines — codzienny monitoring
 *
 * Wywoływany przez Vercel Cron (raz dziennie o 7:00). Robi trzy rzeczy:
 *  1. digest do adminów o terminach (po terminie / w ciągu 2 dni)
 *  2. przypomnienie o zamówieniach bez akceptacji projektu powyżej 24 h
 *  3. automaty: wysłane > 7 dni -> dostarczone, reklamacje > 14 dni -> zamknięte
 *
 * UWAGA na kolejność: automaty i przypomnienia o akceptacji muszą działać
 * NIEZALEŻNIE od tego, czy są zagrożone terminy. Wcześniej wszystko to siedziało
 * za wczesnym `return` i w spokojny dzień nie wykonywało się w ogóle.
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
  const approvalCutoff = approvalCutoffISO(now);

  const excludedStatuses = ["shipped", "delivered", "cancelled"];

  // ---------- 1. ZBIERANIE DANYCH ----------

  const { data: overdue } = await supabase
    .from("orders")
    .select("id, order_number, status, deadline, contact:contacts(full_name)")
    .lt("deadline", now.toISOString())
    .not("status", "in", `(${excludedStatuses.join(",")})`)
    .order("deadline");

  const { data: approaching } = await supabase
    .from("orders")
    .select("id, order_number, status, deadline, contact:contacts(full_name)")
    .gte("deadline", now.toISOString())
    .lte("deadline", twoDaysFromNow.toISOString())
    .not("status", "in", `(${excludedStatuses.join(",")})`)
    .order("deadline");

  // Zamówienia, w których projekt poszedł do klienta i cisza od ponad 24 h
  const { data: staleApprovals } = await supabase
    .from("orders")
    .select("id, order_number, sent_for_approval_at, approval_resent_count, contact:contacts(full_name)")
    .eq("status", "awaiting_approval")
    .eq("approval_reminder_sent", false)
    .not("sent_for_approval_at", "is", null)
    .lt("sent_for_approval_at", approvalCutoff);

  const overdueCount = overdue?.length ?? 0;
  const approachingCount = approaching?.length ?? 0;
  const staleCount = staleApprovals?.length ?? 0;

  console.log(
    "[CRON DEADLINES] overdue=%d approaching=%d bezAkceptacji=%d",
    overdueCount,
    approachingCount,
    staleCount
  );

  // ---------- 2. WYSYŁKA MAILI ----------

  let notified = 0;

  if (overdueCount > 0 || approachingCount > 0 || staleCount > 0) {
    // Adresy z auth.users — public.users NIE ma kolumny email
    const adminEmails = await getActiveAdminEmails();
    notified = adminEmails.length;

    if (adminEmails.length === 0) {
      console.warn("[CRON DEADLINES] brak aktywnych adminow z emailem");
    } else {
      if (overdueCount > 0 || approachingCount > 0) {
        type DeadlineOrder = {
          order_number: string;
          status: string;
          deadline: string;
          customer: string;
        };

        const formatOrders = (orders: typeof overdue): DeadlineOrder[] =>
          (orders ?? []).map((o) => ({
            order_number: o.order_number,
            status: o.status,
            deadline: o.deadline!,
            customer:
              (o.contact as unknown as { full_name: string } | null)?.full_name ?? "—",
          }));

        const { subject, html } = deadlineDigestEmail({
          overdue: formatOrders(overdue),
          approaching: formatOrders(approaching),
        });

        for (const email of adminEmails) {
          await sendEmail({ to: email, subject, html });
        }
      }

      if (staleCount > 0 && staleApprovals) {
        const approvalList = staleApprovals
          .map((o) => {
            const hours = approvalWaitingHours(o.sent_for_approval_at, now) ?? 0;
            const customer =
              (o.contact as unknown as { full_name: string } | null)?.full_name ?? "—";
            const resent = (o.approval_resent_count ?? 0) > 0
              ? ` — po ${o.approval_resent_count} poprawce`
              : "";
            return `${o.order_number} — ${customer} (czeka ${formatWaitingTime(hours)}${resent})`;
          })
          .join("<br>");

        for (const email of adminEmails) {
          await sendEmail({
            to: email,
            subject: `Brak akceptacji projektu (${staleCount})`,
            html:
              `<h2>Zamówienia bez akceptacji projektu powyżej ${APPROVAL_DEADLINE_HOURS} h</h2>` +
              `<p>${approvalList}</p>` +
              `<p>Prosimy o kontakt z klientami.</p>`,
          });
        }
      }
    }

    // Znacznik stawiamy niezależnie od tego, czy mail poszedł — inaczej przy
    // braku adresu admina codziennie próbowalibyśmy wysyłać to samo.
    if (staleCount > 0 && staleApprovals) {
      await supabase
        .from("orders")
        .update({ approval_reminder_sent: true })
        .in("id", staleApprovals.map((o) => o.id));
    }
  }

  // ---------- 3. AUTOMATY (zawsze, niezależnie od maili) ----------

  // Wysłane > 7 dni -> dostarczone. Liczymy od shipped_at, NIE od updated_at
  // (updated_at rusza się przy każdej edycji zamówienia i resetował licznik).
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { count: deliveredCount } = await supabase
    .from("orders")
    .update({ status: "delivered" }, { count: "exact" })
    .eq("status", "shipped")
    .not("shipped_at", "is", null)
    .lt("shipped_at", sevenDaysAgo.toISOString());

  if (deliveredCount && deliveredCount > 0) {
    console.log("[CRON DEADLINES] auto-delivered: %d zamówień", deliveredCount);
  }

  // Reklamacje w trakcie > 14 dni -> rozwiązane
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
    staleApprovals: staleCount,
    notified,
    autoDelivered: deliveredCount ?? 0,
    autoClosedComplaints: closedComplaints ?? 0,
  });
}
