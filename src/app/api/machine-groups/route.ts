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

  const { name, description } = await request.json();

  if (!name || !name.trim()) {
    return NextResponse.json(
      { error: "Nazwa grupy jest wymagana" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("machine_groups")
    .insert({ name: name.trim(), description: description?.trim() || null })
    .select("id, name")
    .single();

  if (error) {
    console.error("[API] DB error:", error.message); return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  return NextResponse.json(data);
}
