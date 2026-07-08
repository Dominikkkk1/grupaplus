import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
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
  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name.trim();
  if (body.description !== undefined)
    updateData.description = body.description?.trim() || null;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "Brak danych do aktualizacji" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("machine_groups")
    .update(updateData)
    .eq("id", id);

  if (error) {
    console.error("[API] DB error:", error.message); return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
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

  const { error } = await supabase
    .from("machine_groups")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[API] DB error:", error.message); return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
