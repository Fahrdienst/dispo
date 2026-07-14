import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Creates a Supabase client for use in Next.js middleware.
 * Handles session refresh by reading/writing cookies on the request/response pair.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
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
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Do not add logic between createServerClient and supabase.auth.getUser().
  // A simple mistake could make it very hard to debug issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Allow public paths without authentication check.
  // "/help" is the public help area (open to signed-out visitors). The
  // protected, role-specific help lives under "/hilfe" and stays behind auth.
  // "/passwort-setzen" / "/passwort-vergessen" are reached via invite/reset
  // links; the session may still be establishing, so they must stay public.
  const PUBLIC_PATHS = [
    "/auth/callback",
    "/api/rides/respond",
    "/rides/respond",
    "/help",
    "/passwort-setzen",
    "/passwort-vergessen",
  ];
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users to login page.
  // Allow access to the root page and auth routes without authentication.
  if (!user && !pathname.startsWith("/login") && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login page.
  if (user && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Role-based area guard (M12 / #98).
  //
  // The driver self-service area lives under "/fahrer/**" (the new M12 target).
  // The existing driver pages still live under "/my/**" (Meine Fahrten /
  // Verfügbarkeit) until the "/fahrer" shell phase migrates them, so BOTH
  // prefixes count as the driver area to avoid locking drivers out at runtime.
  // Every operator/admin feature lives under "(dashboard)" route-group paths
  // (which resolve to real URLs like "/patients", "/rides", "/drivers", ... and
  // the root "/").
  //
  // Rules:
  //   - driver   -> may ONLY enter the driver area. Any other authenticated path
  //                 is redirected to "/fahrer" (never a 500 / empty list).
  //   - operator -> blocked from the driver area, redirected to "/".
  //   - admin    -> may read the driver area too (support/debugging). Deliberate
  //                 decision: admins are trusted and occasionally need to see
  //                 the driver view; they keep full dashboard access as well.
  //
  // We only hit the DB for the role when the user is authenticated and NOT on a
  // path we already cleared above. RLS lets a user read their own profile row.
  // NOTE: this runs AFTER getUser() and does not create a new NextResponse, so
  // the session-refresh invariant documented below stays intact.
  if (user) {
    const isDriverArea =
      pathname === "/fahrer" ||
      pathname.startsWith("/fahrer/") ||
      pathname === "/my" ||
      pathname.startsWith("/my/");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;

    if (role === "driver" && !isDriverArea) {
      const url = request.nextUrl.clone();
      url.pathname = "/fahrer";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (role !== "driver" && role !== "admin" && isDriverArea) {
      // operator (or any non-driver, non-admin role) has no business in /fahrer
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // IMPORTANT: Return the supabaseResponse object as is.
  // If you create a new response object with NextResponse.next(),
  // the refreshed session cookies will be lost.
  return supabaseResponse;
}
