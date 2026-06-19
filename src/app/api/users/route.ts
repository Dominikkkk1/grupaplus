import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/users — lista uzytkownikow (admin only)
 */
export async function GET() {
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

  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, role, is_active, phone, created_at")
    .order("full_name");

  // Pobierz emaile z auth (admin client)
  const adminClient = createAdminClient();
  const { data: authData } = await adminClient.auth.admin.listUsers();
  const emailMap = new Map<string, string>();
  authData?.users?.forEach((u) => {
    if (u.email) emailMap.set(u.id, u.email);
  });

  const enriched = (users ?? []).map((u) => ({
    ...u,
    email: emailMap.get(u.id) ?? "",
  }));

  return NextResponse.json(enriched);
}

/**
 * POST /api/users — tworzenie nowego uzytkownika (admin only)
 * Body: { email, password, fullName, role, phone? }
 */
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

  const { email, password, fullName, role, phone } = await request.json();

  if (!email || !password || !fullName || !role) {
    return NextResponse.json(
      { error: "Email, haslo, imie i rola sa wymagane" },
      { status: 400 }
    );
  }

  if (!["admin", "operator", "client"].includes(role)) {
    return NextResponse.json(
      { error: "Rola musi byc: admin, operator lub client" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Haslo musi miec minimum 6 znakow" },
      { status: 400 }
    );
  }

  // Utworz usera przez Supabase Admin API
  const adminClient = createAdminClient();
  const { data: newUser, error: authError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });

  if (authError) {
    if (authError.message.includes("already been registered")) {
      return NextResponse.json(
        { error: "Uzytkownik z tym emailem juz istnieje" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Zaktualizuj profil (trigger handle_new_user juz go stworzyl)
  if (newUser.user && phone) {
    await adminClient
      .from("users")
      .update({ phone })
      .eq("id", newUser.user.id);
  }

  // Klient musi miec rekord w contacts — bez tego nie pojawi sie w CRM
  // i nie bedzie mogl byc przypisany do zamowien (RLS szuka go przez contacts.user_id)
  if (newUser.user && role === "client") {
    // Sprawdz czy email juz istnieje w contacts (mogl byc dodany reczne w CRM)
    const { data: existingContact } = await adminClient
      .from("contacts")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingContact) {
      // Podlacz istniejacy contact do nowego usera
      await adminClient
        .from("contacts")
        .update({ user_id: newUser.user.id })
        .eq("id", existingContact.id);
    } else {
      await adminClient.from("contacts").insert({
        user_id: newUser.user.id,
        full_name: fullName,
        email,
        phone: phone || null,
      });
    }
  }

  return NextResponse.json({
    id: newUser.user?.id,
    email,
    fullName,
    role,
  });
}
