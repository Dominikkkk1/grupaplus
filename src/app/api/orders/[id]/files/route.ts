import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateFile } from "@/services/file-validation.service";

export const maxDuration = 60;

/**
 * POST /api/orders/[id]/files — rejestracja pliku (po direct upload do Storage)
 *
 * Nowy flow (od Fazy "duże pliki"):
 * 1. Browser uploaduje plik bezpośrednio do Supabase Storage (bypass Vercel 4.5MB limit)
 * 2. Browser wysyła JSON z metadata do tego API
 * 3. API pobiera plik ze Storage → preflight → zapisuje rekord w order_files
 *
 * Body: { filePath, fileName, fileSize, mimeType, orderItemId? }
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

  const body = await request.json();
  const { filePath, fileName, fileSize, mimeType, orderItemId } = body;

  if (!filePath || !fileName) {
    return NextResponse.json({ error: "filePath i fileName wymagane" }, { status: 400 });
  }

  // Walidacja rozszerzenia server-side
  const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "tiff", "tif"];
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    // Cleanup: usun plik z Storage
    await supabase.storage.from("order-files").remove([filePath]);
    return NextResponse.json(
      { error: "Niedozwolony typ pliku (dozwolone: PDF, JPG, PNG, TIFF)" },
      { status: 400 }
    );
  }

  // Pobierz docelowe wymiary produktu (jeśli pozycja ma produkt)
  let targetWidth: number | null = null;
  let targetHeight: number | null = null;

  if (orderItemId) {
    const { data: itemData } = await supabase
      .from("order_items")
      .select("product:products(width_mm, height_mm)")
      .eq("id", orderItemId)
      .maybeSingle();
    const prod = itemData?.product as unknown as { width_mm: number | null; height_mm: number | null } | null;
    targetWidth = prod?.width_mm ? Number(prod.width_mm) : null;
    targetHeight = prod?.height_mm ? Number(prod.height_mm) : null;
  }

  // Pobierz plik ze Storage do preflight
  let preflight: { status: string; checks?: unknown[]; validatedAt?: string } = { status: "pending", checks: [], validatedAt: new Date().toISOString() };

  const { data: fileData, error: downloadError } = await supabase.storage
    .from("order-files")
    .download(filePath);

  if (!downloadError && fileData) {
    const fileBuffer = Buffer.from(await fileData.arrayBuffer());
    preflight = await validateFile(fileBuffer, mimeType, fileName, targetWidth, targetHeight);
  } else {
    console.error("[FILES] download for preflight failed:", downloadError?.message);
  }

  // Zapisz rekord w tabeli order_files
  const { data: record, error: dbError } = await supabase
    .from("order_files")
    .insert({
      order_id: id,
      order_item_id: orderItemId || null,
      file_name: fileName,
      file_path: filePath,
      file_size: fileSize || null,
      mime_type: mimeType || null,
      uploaded_by: user.id,
      preflight_status: preflight.status,
      preflight_result: preflight,
    })
    .select("id, file_name, file_size, mime_type, preflight_status, preflight_result, created_at")
    .single();

  if (dbError) {
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
