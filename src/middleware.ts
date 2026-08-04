import { NextRequest, NextResponse } from "next/server";
import { BRANA_SUBDOMENA_HOST } from "@/lib/brana/cesty";

/** Čisté veřejné cesty BRÁNY na subdoméně → interní /brana/... */
const BRANA_CISTE_CESTY = new Set([
  "/",
  "/zitra",
  "/vikend",
  "/7-dni",
  "/vyhled",
  "/vzkaz",
  "/admin",
]);

function jeBranaSubdomena(request: NextRequest): boolean {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();

  return host === BRANA_SUBDOMENA_HOST;
}

export function middleware(request: NextRequest) {
  if (!jeBranaSubdomena(request)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Přímá registrace /brana/sw.js se scope / vyžaduje rozšíření max scope.
  if (pathname === "/brana/sw.js") {
    const response = NextResponse.next();
    response.headers.set("Service-Worker-Allowed", "/");
    return response;
  }

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/brana/")
  ) {
    return NextResponse.next();
  }

  if (!BRANA_CISTE_CESTY.has(pathname)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? "/brana" : `/brana${pathname}`;

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
