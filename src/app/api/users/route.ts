import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/users — lista użytkownikow (admin only)
 */
export const GET = withAuth("admin", async (_request, { supabase }) => {
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, role, is_active, phone, created_at")
    .order("full_name");

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
});

/**
 * POST /api/users — tworzenie nowego użytkownika (admin only)
 */
export const POST = withAuth("admin", async (request, _ctx) => {
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const { email, password, fullName, role, phone } = parsed.data as Record<string, unknown>;
  console.log("[USER CREATE] email=%s role=%s fullName=%s", email, role, fullName);

  if (!email || !password || !fullName || !role) {
    return NextResponse.json(
      { error: "Email, hasło, imię i rola są wymagane" },
      { status: 400 }
    );
  }

  if (!["admin", "operator", "client"].includes(role as string)) {
    return NextResponse.json(
      { error: "Rola musi być: admin, operator lub client" },
      { status: 400 }
    );
  }

  if ((password as string).length < 8) {
    return NextResponse.json(
      { error: "Hasło musi mieć minimum 8 znaków" },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();
  const { data: newUser, error: authError } =
    await adminClient.auth.admin.createUser({
      email: email as string,
      password: password as string,
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

  if (newUser.user && phone) {
    await adminClient
      .from("users")
      .update({ phone })
      .eq("id", newUser.user.id);
  }

  console.log("[USER CREATE] auth user created: %s", newUser.user?.id);

  if (newUser.user && role === "client") {
    const { data: existingContact } = await adminClient
      .from("contacts")
      .select("id")
      .eq("email", email as string)
      .maybeSingle();

    if (existingContact) {
      console.log("[USER CREATE] podlaczam istniejacy contact %s do user %s", existingContact.id, newUser.user.id);
      await adminClient
        .from("contacts")
        .update({ user_id: newUser.user.id })
        .eq("id", existingContact.id);
    } else {
      console.log("[USER CREATE] tworze nowy contact dla %s", email);
      await adminClient.from("contacts").insert({
        user_id: newUser.user.id,
        full_name: fullName as string,
        email: email as string,
        phone: (phone as string) || null,
      });
    }
  }

  return NextResponse.json({
    id: newUser.user?.id,
    email,
    fullName,
    role,
  });
});
