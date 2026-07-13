import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";

export const POST = withAuth("admin", async (request, { supabase }) => {
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const { name, description } = parsed.data as Record<string, unknown>;

  if (!name || !(name as string).trim()) {
    return NextResponse.json({ error: "Nazwa grupy jest wymagana" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("machine_groups")
    .insert({
      name: (name as string).trim(),
      description: description ? (description as string).trim() : null,
    })
    .select("id, name")
    .single();

  if (error) {
    console.error("[MACHINE_GROUPS] DB error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  return NextResponse.json(data);
});
