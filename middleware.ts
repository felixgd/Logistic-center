import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { validateCsrfToken, isSafeMethod } from "@/lib/csrf";

const EXEMPT_PATHS = [
  "/api/public/submit",
  "/api/public/claim-trip",
  "/api/public/map-data",
  "/api/verificar/enviar",
  "/api/verificar/codigo",
  "/api/health",
  "/api/whatsapp/webhook",
];

export async function middleware(req: NextRequest) {
  // Solo proteger rutas de API
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Eximir endpoints públicos o de verificación
  if (EXEMPT_PATHS.some((p) => req.nextUrl.pathname === p)) {
    return NextResponse.next();
  }

  // Métodos seguros no requieren protección CSRF
  if (isSafeMethod(req.method)) {
    return NextResponse.next();
  }

  const auth = req.headers.get("authorization");
  const csrfHeader = req.headers.get("x-csrf-token");

  // Si no hay token de autenticación, no hay nada que proteger con CSRF
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.next();
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "secret");
    const { payload } = await jwtVerify(auth.slice(7), secret);
    const csrfToken = payload.csrfToken as string | undefined;

    // Validar CSRF token contra el almacenado en el JWT
    if (!validateCsrfToken(csrfHeader, csrfToken || null)) {
      return NextResponse.json({ error: "CSRF token inválido" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
