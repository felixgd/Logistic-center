import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { validateCsrf, isSafeMethod } from "@/lib/csrf";

const EXEMPT_PATHS = [
  "/api/public/submit",
  "/api/public/claim-trip",
  "/api/public/map-data",
  "/api/verificar/enviar",
  "/api/verificar/codigo",
  "/api/health",
  "/api/whatsapp/webhook",
  "/api/webhooks/didit",
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

  // Si no hay token de autenticación, no hay nada que proteger con CSRF
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.next();
  }

  try {
    if (!process.env.JWT_SECRET) {
      return NextResponse.json({ error: "JWT_SECRET no configurado" }, { status: 500 });
    }
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(auth.slice(7), secret);
    const storedToken = (payload.csrfToken as string) || null;

    // Validar CSRF: primero contra el token en el JWT, luego por origen
    const result = validateCsrf(req, storedToken);
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
