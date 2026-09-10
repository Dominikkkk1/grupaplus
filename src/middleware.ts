import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Sciezki bez logowania uzytkownika.
// UWAGA: /api/cron MUSI tu byc. Vercel Cron wola te endpointy bez ciasteczka
// sesji — bez wyjatku middleware odsylal je na /login (HTTP 307) i kod cronu
// w ogole sie nie wykonywal. Same endpointy pilnuja sie naglowkiem CRON_SECRET,
// a webhooki podpisem HMAC.
const PUBLIC_PATHS = [
  "/login",
  "/api/webhooks",
  "/api/cron",
  // Akceptacja projektu przez klienta — bez logowania, autoryzuje token z linku
  "/akceptacja",
  "/api/approval",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Webhooks i publiczne sciezki — przepuszczaj
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Layout serwerowy nie zna sciezki, a musi ja znac, zeby sprawdzic uprawnienia
  // roli. Przekazujemy ja naglowkiem requestu.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Naglowki budujemy PO ustawieniu ciasteczek, zeby odswiezona sesja
          // poszla dalej razem z naszym x-pathname.
          const headers = new Headers(request.headers);
          headers.set("x-pathname", pathname);
          supabaseResponse = NextResponse.next({ request: { headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Niezalogowany → redirect do /login
  if (!user && pathname !== "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Zalogowany na /login → redirect do /orders
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/orders";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
