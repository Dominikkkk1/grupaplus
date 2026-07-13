import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";
import { validateFile } from "@/services/file-validation.service";

export const maxDuration = 60;

/**
 * POST /api/orders/[id]/files — rejestracja pliku (po direct upload do Storage)
 */
export const POST = withAuth(["admin", "client"], async (request, { supabase, user, role }, params) => {
  const id = params!.id;

  // Klient moze uploadowac tylko do swoich zamowien (RLS sprawdza za nas)
  if (role === "client") {
    const { data: orderCheck } = await supabase.from("orders").select("id").eq("id", id).maybeSingle();
    if (!orderCheck) {
      return NextResponse.json({ error: "Brak dostępu do tego zamówienia" }, { status: 403 });
    }
  }

  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data as Record<string, unknown>;
  const { filePath, fileName, fileSize, mimeType, orderItemId } = body as {
    filePath: string; fileName: string; fileSize?: number; mimeType?: string; orderItemId?: string;
  };

  if (!filePath || !fileName) {
    return NextResponse.json({ error: "filePath i fileName wymagane" }, { status: 400 });
  }

  const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "tiff", "tif"];
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    await supabase.storage.from("order-files").remove([filePath]);
    return NextResponse.json({ error: "Niedozwolony typ pliku (dozwolone: PDF, JPG, PNG, TIFF)" }, { status: 400 });
  }

  let targetWidth: number | null = null;
  let targetHeight: number | null = null;

  if (orderItemId) {
    const { data: itemData } = await supabase
      .from("order_items").select("product:products(width_mm, height_mm)").eq("id", orderItemId).maybeSingle();
    const prod = itemData?.product as unknown as { width_mm: number | null; height_mm: number | null } | null;
    targetWidth = prod?.width_mm ? Number(prod.width_mm) : null;
    targetHeight = prod?.height_mm ? Number(prod.height_mm) : null;
  }

  let preflight: { status: string; checks?: unknown[]; validatedAt?: string } = { status: "pending", checks: [], validatedAt: new Date().toISOString() };

  const { data: fileData, error: downloadError } = await supabase.storage.from("order-files").download(filePath);
  if (!downloadError && fileData) {
    const fileBuffer = Buffer.from(await fileData.arrayBuffer());
    preflight = await validateFile(fileBuffer, mimeType ?? "", fileName, targetWidth, targetHeight);
  } else {
    console.error("[FILES] download for preflight failed:", downloadError?.message);
  }

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
      is_client_upload: role === "client",
      is_accepted: role !== "client",
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
});

/**
 * DELETE /api/orders/[id]/files?fileId=xxx — usun plik
 */
export const DELETE = withAuth("admin", async (request, { supabase }, params) => {
  const id = params!.id;
  const fileId = request.nextUrl.searchParams.get("fileId");
  if (!fileId) {
    return NextResponse.json({ error: "Brak fileId" }, { status: 400 });
  }

  const { data: fileRecord } = await supabase
    .from("order_files").select("file_path").eq("id", fileId).eq("order_id", id).maybeSingle();

  if (!fileRecord) {
    return NextResponse.json({ error: "Plik nie znaleziony" }, { status: 404 });
  }

  if (fileRecord.file_path) {
    await supabase.storage.from("order-files").remove([fileRecord.file_path]);
  }

  const { error: deleteError } = await supabase.from("order_files").delete().eq("id", fileId).eq("order_id", id);
  if (deleteError) {
    console.error("[FILE DELETE] error:", deleteError.message);
    return NextResponse.json({ error: "Błąd usuwania pliku" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});

/**
 * PATCH /api/orders/[id]/files?fileId=xxx&action=accept — akceptacja pliku klienta
 */
export const PATCH = withAuth(["admin", "operator"], async (request, { supabase }, params) => {
  const id = params!.id;
  const fileId = request.nextUrl.searchParams.get("fileId");
  const action = request.nextUrl.searchParams.get("action");

  if (!fileId || action !== "accept") {
    return NextResponse.json({ error: "fileId i action=accept wymagane" }, { status: 400 });
  }

  const { error } = await supabase.from("order_files").update({ is_accepted: true }).eq("id", fileId).eq("order_id", id);
  if (error) {
    console.error("[FILE ACCEPT] error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});
