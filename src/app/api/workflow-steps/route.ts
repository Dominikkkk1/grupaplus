import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
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

  const { name, color, machineGroupId } = await request.json();

  if (!name || !name.trim()) {
    return NextResponse.json(
      { error: "Nazwa etapu jest wymagana" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("workflow_steps")
    .insert({
      name: name.trim(),
      color: color || "#6b7280",
      machine_group_id: machineGroupId || null,
    })
    .select("id, name")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
