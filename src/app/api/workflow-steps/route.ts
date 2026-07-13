import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";

export const POST = withAuth("admin", async (request, { supabase }) => {
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const { name, color, machineGroupId } = parsed.data as Record<string, unknown>;

  if (!name || !(name as string).trim()) {
    return NextResponse.json({ error: "Nazwa etapu jest wymagana" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("workflow_steps")
    .insert({
      name: (name as string).trim(),
      color: (color as string) || "#6b7280",
      machine_group_id: (machineGroupId as string) || null,
    })
    .select("id, name")
    .single();

  if (error) {
    console.error("[WORKFLOW_STEPS] DB error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  return NextResponse.json(data);
});
