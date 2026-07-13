import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type UserRole = "admin" | "operator" | "client";

export interface AuthContext {
  user: { id: string; email?: string };
  role: UserRole;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

type AuthHandler = (
  request: NextRequest,
  context: AuthContext,
  params?: Record<string, string>
) => Promise<NextResponse>;

export function withAuth(
  allowedRoles: UserRole | UserRole[],
  handler: AuthHandler
) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return async (request: NextRequest, routeContext?: { params?: Promise<Record<string, string>> }) => {
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

    if (!profile || !roles.includes(profile.role as UserRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = routeContext?.params ? await routeContext.params : undefined;

    return handler(request, {
      user: { id: user.id, email: user.email },
      role: profile.role as UserRole,
      supabase,
    }, params);
  };
}
