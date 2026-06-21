import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/users — lista użytkownikow (admin only)
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
 * POST /api/users — tworzenie nowego użytkownika (admin only)
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
  console.log("[USER CREATE] email=%s role=%s fullName=%s", email, role, fullName);

  if (!email || !password || !fullName || !role) {
    return NextResponse.json(
      { error: "Email, hasło, imię i rola są wymagane" },
      { status: 400 }
    );
  }

  if (!["admin", "operator", "client"].includes(role)) {
    return NextResponse.json(
      { error: "Rola musi być: admin, operator lub client" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Hasło musi mieć minimum 8 znaków" },
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
    console.error("[USER CREATE] auth error:", authError.message);
    if (authError.message.includes("already been registered")) {
      return NextResponse.json(
        { error: "Użytkownik z tym emailem już istnieje" },
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

  console.log("[USER CREATE] auth user created: %s", newUser.user?.id);

  // Klient musi miec rekord w contacts — bez tego nie pojawi sie w CRM
  // i nie bedzie mogl byc przypisany do zamówień (RLS szuka go przez contacts.user_id)
  if (newUser.user && role === "client") {
    // Sprawdz czy email juz istnieje w contacts (mogl byc dodany reczne w CRM)
    const { data: existingContact } = await adminClient
      .from("contacts")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingContact) {
      // Podlacz istniejacy contact do nowego usera
      console.log("[USER CREATE] podlaczam istniejacy contact %s do user %s", existingContact.id, newUser.user.id);
      await adminClient
        .from("contacts")
        .update({ user_id: newUser.user.id })
        .eq("id", existingContact.id);
    } else {
      console.log("[USER CREATE] tworze nowy contact dla %s", email);
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
