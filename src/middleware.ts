import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Paths that must work without a session.
 *
 * The two API routes here are not unprotected -- they carry their own
 * credential and would be useless behind a redirect:
 *   /api/calendar        a subscription feed; calendar apps cannot sign in,
 *                        so the token in the URL is the credential.
 *   /api/notifications   the scheduled email sender; authenticated by the
 *                        cron secret in its Authorization header.
 *
 * Everything else, including /api/imagekit/auth, still requires a session.
 */
const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/api/calendar",
  "/api/notifications",
];

/**
 * Refreshes the Supabase session on every request and guards every page.
 * Signed out anywhere but /login is sent to /login; signed in at /login is
 * sent home.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() revalidates the token with Supabase. Do not swap this for
  // getSession(), which trusts whatever is in the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
