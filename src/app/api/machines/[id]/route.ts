import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";

export const PATCH = withAuth("admin", async (request, { supabase }, params) => {
  const id = params!.id;
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data as Record<string, unknown>;
  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined) updateData.name = (body.name as string).trim();
  if (body.groupId !== undefined) updateData.group_id = body.groupId;
  if (body.priority !== undefined) updateData.priority = body.priority;
  if (body.isActive !== undefined) updateData.is_active = body.isActive;
  if (body.notes !== undefined) updateData.notes = body.notes ? (body.notes as string).trim() : null;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Brak danych do aktualizacji" }, { status: 400 });
  }

  const { error } = await supabase.from("machines").update(updateData).eq("id", id);

  if (error) {
    console.error("[MACHINES] DB error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth("admin", async (_request, { supabase }, params) => {
  const id = params!.id;

  const { error } = await supabase.from("machines").delete().eq("id", id);

  if (error) {
    console.error("[MACHINES] DB error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});
