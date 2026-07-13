import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";

/**
 * POST /api/machines — tworzenie nowej maszyny
 */
export const POST = withAuth("admin", async (request, { supabase }) => {
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const { name, groupId, priority, isActive, notes } = parsed.data as Record<string, unknown>;

  if (!name || !(name as string).trim()) {
    return NextResponse.json(
      { error: "Nazwa maszyny jest wymagana" },
      { status: 400 }
    );
  }

  if (!groupId) {
    return NextResponse.json(
      { error: "Grupa maszyn jest wymagana" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("machines")
    .insert({
      name: (name as string).trim(),
      group_id: groupId as string,
      priority: (priority as number) ?? 0,
      is_active: (isActive as boolean) ?? true,
      notes: notes ? (notes as string).trim() : null,
    })
    .select("id, name")
    .single();

  if (error) {
    console.error("[MACHINES] DB error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  return NextResponse.json(data);
});
