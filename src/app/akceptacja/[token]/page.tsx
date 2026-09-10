import { createAdminClient } from "@/lib/supabase/admin";
import { checkApprovalToken } from "@/lib/approval-token";
import { ApprovalDecision } from "@/components/orders/approval-decision";

export const dynamic = "force-dynamic";

/**
 * Publiczna strona akceptacji projektu — BEZ LOGOWANIA.
 *
 * Klient drukarni zwykle nie ma konta w systemie, więc dostaje mailem link
 * z jednorazowym tokenem. Cała autoryzacja opiera się na tym tokenie:
 * strona działa na kluczu service_role, ale pokazuje wyłącznie zamówienie
 * przypisane do tokenu i nic poza tym.
 */

function Komunikat({ tytul, tresc }: { tytul: string; tresc: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">{tytul}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-zinc-600">{tresc}</p>
        <p className="mt-6 text-[13px] text-zinc-400">
          Drukarnia Grupa Plus &middot; w razie pytań prosimy o kontakt
        </p>
      </div>
    </div>
  );
}

export default async function AkceptacjaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const check = await checkApprovalToken(supabase, token);

  if (!check.ok) {
    if (check.reason === "used") {
      return (
        <Komunikat
          tytul="Ten link został już wykorzystany"
          tresc="Decyzja w sprawie tego projektu została już zapisana. Jeśli chcą Państwo coś zmienić, prosimy o kontakt z drukarnią."
        />
      );
    }
    if (check.reason === "expired") {
      return (
        <Komunikat
          tytul="Link stracił ważność"
          tresc="Ten link do akceptacji projektu wygasł. Prosimy o kontakt z drukarnią — wyślemy nowy."
        />
      );
    }
    return (
      <Komunikat
        tytul="Nie znaleźliśmy takiego linku"
        tresc="Sprawdź, czy adres został skopiowany w całości. W razie wątpliwości prosimy o kontakt z drukarnią."
      />
    );
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, status, sent_for_approval_at, contact:contacts(full_name), company:companies(name)")
    .eq("id", check.orderId)
    .maybeSingle();

  if (!order) {
    return (
      <Komunikat
        tytul="Zamówienie niedostępne"
        tresc="Nie udało się wczytać zamówienia. Prosimy o kontakt z drukarnią."
      />
    );
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("description, quantity")
    .eq("order_id", order.id)
    .order("created_at");

  const { data: files } = await supabase
    .from("order_files")
    .select("id, file_name, file_path, mime_type")
    .eq("order_id", order.id)
    .eq("is_client_upload", false)
    .order("created_at", { ascending: false });

  // Podpisane adresy do plików — ważne przez godzinę, tyle wystarczy na obejrzenie
  const podglad: { id: string; name: string; url: string | null; isImage: boolean }[] = [];
  for (const f of files ?? []) {
    const { data } = await supabase.storage
      .from("order-files")
      .createSignedUrl(f.file_path as string, 3600);
    podglad.push({
      id: f.id as string,
      name: f.file_name as string,
      url: data?.signedUrl ?? null,
      isImage: String(f.mime_type ?? "").startsWith("image/"),
    });
  }

  const contact = order.contact as unknown as { full_name: string } | null;
  const company = order.company as unknown as { name: string } | null;
  const klient = company?.name ?? contact?.full_name ?? "";

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-5 text-center">
          <p className="text-[13px] font-medium uppercase tracking-wider text-zinc-400">
            Drukarnia Grupa Plus
          </p>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900">
            Projekt do akceptacji
          </h1>
          <p className="mt-1 text-[14px] text-zinc-600">
            Zamówienie <span className="font-mono font-medium">{order.order_number}</span>
            {klient && ` · ${klient}`}
          </p>
        </div>

        {/* Co zamawiano */}
        {items && items.length > 0 && (
          <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
              Zamówienie
            </h2>
            <ul className="space-y-1.5">
              {items.map((i, idx) => (
                <li key={idx} className="flex justify-between text-[14px] text-zinc-700">
                  <span>{i.description as string}</span>
                  <span className="ml-4 flex-shrink-0 text-zinc-500">
                    {i.quantity as number} szt.
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Projekt */}
        <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
            Projekt
          </h2>
          {podglad.length === 0 ? (
            <p className="text-[14px] text-zinc-500">
              Projekt przesłaliśmy osobno. Jeśli go Państwo nie otrzymali, prosimy o kontakt.
            </p>
          ) : (
            <div className="space-y-3">
              {podglad.map((f) => (
                <div key={f.id} className="rounded-lg border border-zinc-100 p-3">
                  {f.isImage && f.url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={f.url}
                      alt={f.name}
                      className="mx-auto max-h-[420px] w-auto rounded"
                    />
                  ) : null}
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="truncate text-[13px] text-zinc-600">{f.name}</span>
                    {f.url && (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-shrink-0 rounded-md border border-zinc-200 px-2.5 py-1 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        Otwórz
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <ApprovalDecision token={token} />

        <p className="mt-5 text-center text-[12px] leading-relaxed text-zinc-400">
          Produkcja rusza dopiero po Państwa akceptacji.
          <br />
          Ten link jest jednorazowy i wygasa.
        </p>
      </div>
    </div>
  );
}
