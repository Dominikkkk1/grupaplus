import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Anonimizuje dane osobowe kontaktu (RODO art. 17).
 * - Podmienia dane kontaktu na anonimowe
 * - Odlacza kontakt od zamowien (contact_id = null)
 * - Usuwa pliki klienta z Storage i DB
 *
 * Zamowienia zostaja w systemie (numer, kwota, workflow) — tylko bez danych osobowych.
 */
export async function anonymizeContact(
  supabase: SupabaseClient,
  contactId: string
): Promise<{ ordersUnlinked: number; filesDeleted: number }> {
  console.log("[RODO] Anonymizing contact %s", contactId);

  // 1. Znajdz zamowienia tego kontaktu
  const { data: orders } = await supabase
    .from("orders")
    .select("id")
    .eq("contact_id", contactId);

  const orderIds = (orders ?? []).map((o) => o.id);

  // 2. Usun pliki z Storage i DB
  let filesDeleted = 0;
  if (orderIds.length > 0) {
    const { data: files } = await supabase
      .from("order_files")
      .select("id, file_path")
      .in("order_id", orderIds);

    if (files && files.length > 0) {
      // Usun z Storage
      const filePaths = files.map((f) => f.file_path);
      const { error: storageError } = await supabase.storage
        .from("order-files")
        .remove(filePaths);

      if (storageError) {
        console.error("[RODO] Storage delete error:", storageError.message);
      }

      // Usun rekordy z DB
      await supabase
        .from("order_files")
        .delete()
        .in("id", files.map((f) => f.id));

      filesDeleted = files.length;
    }

    // 3. Odlacz kontakt od zamowien
    await supabase
      .from("orders")
      .update({ contact_id: null })
      .in("id", orderIds);
  }

  // 4. Anonimizuj dane kontaktu
  await supabase
    .from("contacts")
    .update({
      full_name: "Anonimowy",
      email: null,
      phone: null,
      allegro_login: null,
      anonymized_at: new Date().toISOString(),
    })
    .eq("id", contactId);

  console.log(
    "[RODO] Contact %s anonymized: %d orders unlinked, %d files deleted",
    contactId,
    orderIds.length,
    filesDeleted
  );

  return { ordersUnlinked: orderIds.length, filesDeleted };
}
