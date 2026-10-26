import { NextResponse, type NextRequest } from "next/server";

// Must match SESSION_COOKIE in src/lib/auth.ts, duplicated so middleware stays
// free of Node-only imports (crypto, pg).
const SESSION_COOKIE = "fuelsafe_session";

// Fast UX gate: the cookie proves a session may exist, while the real check
// (token + expiry against PostgreSQL) happens in the server components.
export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (!hasSession) {
    const url = new URL("/signin", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/welcome"],
};
