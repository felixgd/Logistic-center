import { NextRequest } from "next/server";

export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  (crypto as any).getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function validateCsrfToken(token: string | null, storedToken: string | null): boolean {
  if (!token || !storedToken) return false;
  if (token.length !== storedToken.length) return false;
  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ storedToken.charCodeAt(i);
  }
  return result === 0;
}

function getAllowedOrigins(): string[] {
  const origins: string[] = [];
  if (process.env.NEXT_PUBLIC_APP_URL) origins.push(process.env.NEXT_PUBLIC_APP_URL);
  if (process.env.NEXT_PUBLIC_API_URL) origins.push(process.env.NEXT_PUBLIC_API_URL);
  if (process.env.VERCEL_URL) origins.push(`https://${process.env.VERCEL_URL}`);
  return origins.filter(Boolean);
}

export function isSafeMethod(method: string): boolean {
  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

export function validateOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const allowed = getAllowedOrigins();

  // Si no hay origin ni referer, no podemos validar; rechazamos mutaciones en producción
  if (!origin && !referer) return allowed.length === 0;

  const checkUrl = (url: string | null) => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return allowed.some((allowedOrigin) => {
        const ao = allowedOrigin.toLowerCase();
        return parsed.origin.toLowerCase() === ao || (ao.endsWith("/") && parsed.origin.toLowerCase() === ao.slice(0, -1));
      });
    } catch {
      return false;
    }
  };

  return checkUrl(origin) || checkUrl(referer);
}

export function validateCsrf(req: NextRequest, storedToken: string | null): { valid: true } | { valid: false; error: string } {
  if (isSafeMethod(req.method)) return { valid: true };

  const csrfHeader = req.headers.get("x-csrf-token");
  if (csrfHeader && validateCsrfToken(csrfHeader, storedToken)) {
    return { valid: true };
  }

  if (validateOrigin(req)) {
    return { valid: true };
  }

  return { valid: false, error: "CSRF token u origen inválido" };
}

export function getCsrfTokenFromRequest(req: NextRequest): string | null {
  return req.headers.get("x-csrf-token");
}
