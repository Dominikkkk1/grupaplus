import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateFile } from "@/services/file-validation.service";

/**
 * POST /api/orders/[id]/files — upload pliku do zamówienia
 * Body: FormData z polem "file"
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const orderItemId = formData.get("orderItemId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "Brak pliku" }, { status: 400 });
  }

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Plik za duzy (max 20 MB)" },
      { status: 400 }
    );
  }

  // Upload do Supabase Storage
  const ext = file.name.split(".").pop() ?? "bin";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${id}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("order-files")
    .upload(filePath, file, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Preflight — walidacja pliku (DPI, wymiary, profil)
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const preflight = await validateFile(fileBuffer, file.type);

  // Zapisz rekord w tabeli order_files z wynikiem preflight
  const { data: record, error: dbError } = await supabase
    .from("order_files")
    .insert({
      order_id: id,
      order_item_id: orderItemId || null,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: user.id,
      preflight_status: preflight.status,
      preflight_result: preflight,
    })
    .select("id, file_name, file_size, mime_type, preflight_status, preflight_result, created_at")
    .single();

  if (dbError) {
    // Cleanup: usun plik z Storage jesli DB insert fail (zeby nie bylo orphanow)
    await supabase.storage.from("order-files").remove([filePath]);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(record);
}

/**
 * DELETE /api/orders/[id]/files?fileId=xxx — usun plik
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // params consumed below after fileId check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fileId = request.nextUrl.searchParams.get("fileId");
  if (!fileId) {
    return NextResponse.json({ error: "Brak fileId" }, { status: 400 });
  }

  const { id: orderId } = await params;

  // Pobierz sciezke pliku — weryfikuj ze nalezy do tego zamowienia
  const { data: fileRecord } = await supabase
    .from("order_files")
    .select("file_path")
    .eq("id", fileId)
    .eq("order_id", orderId)
    .maybeSingle();

  if (!fileRecord) {
    return NextResponse.json({ error: "Plik nie znaleziony" }, { status: 404 });
  }

  if (fileRecord.file_path) {
    await supabase.storage
      .from("order-files")
      .remove([fileRecord.file_path]);
  }

  const { error: deleteError } = await supabase.from("order_files").delete().eq("id", fileId).eq("order_id", orderId);

  if (deleteError) {
    console.error("[FILE DELETE] error:", deleteError.message);
    return NextResponse.json({ error: "Blad usuwania pliku" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
