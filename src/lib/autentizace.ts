import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const NAZEV_COOKIE = "admin_session";
const PLATNOST_HODIN = 24;

function ziskatTajemstvi(): Uint8Array {
  const tajemstvi = (
    process.env.SESSION_TAJEMSTVI ?? "vychozi-tajemstvi-pro-vyvoj-min-32-zn"
  ).trim();
  return new TextEncoder().encode(tajemstvi);
}

/** Ověří heslo administrátora */
export function overitHeslo(heslo: string): boolean {
  const adminHeslo = (process.env.ADMIN_HESLO ?? "admin").trim();
  return heslo.trim() === adminHeslo;
}

/** Vytvoří JWT token pro admin session */
export async function vytvoritSessionToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PLATNOST_HODIN}h`)
    .sign(ziskatTajemstvi());
}

/** Ověří platnost admin session z cookie */
export async function jeAdminPrihlasen(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(NAZEV_COOKIE)?.value;
  if (!token) return false;

  try {
    await jwtVerify(token, ziskatTajemstvi());
    return true;
  } catch {
    return false;
  }
}

/** Nastaví session cookie po úspěšném přihlášení */
export async function nastavitSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(NAZEV_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: PLATNOST_HODIN * 60 * 60,
    path: "/",
  });
}

/** Smaže session cookie při odhlášení */
export async function smazatSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(NAZEV_COOKIE);
}

export { NAZEV_COOKIE };
