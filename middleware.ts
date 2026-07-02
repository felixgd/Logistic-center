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

const KYC_EXEMPT_PATHS = [
  "/api/actores/reverificar",
  "/api/actores/refresh-token",
];

// Rutas de comunicación API-a-API: mantienen la verificación de JWT pero
// omiten CSRF (irrelevante fuera del navegador) y el gate de KYC. La capa de
// API key (x-api-key) se valida en el handler con requireApiAuth (lib/apiauth).
// Arranca vacía a propósito: activar una ruta = agregar aquí su path (exacto o
// prefijo) y una llamada a requireApiAuth en su handler. Sin cambios adicionales.
const API_TO_API_PATHS: string[] = [];

export async function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (EXEMPT_PATHS.some((p) => req.nextUrl.pathname === p)) {
    return NextResponse.next();
  }

  const isApiToApi = API_TO_API_PATHS.some(
    (p) => req.nextUrl.pathname === p || req.nextUrl.pathname.startsWith(p + "/")
  );

  const auth = req.headers.get("authorization");

  if (auth?.startsWith("Bearer ")) {
    try {
      if (!process.env.JWT_SECRET) {
        return NextResponse.json({ error: "JWT_SECRET no configurado" }, { status: 500 });
      }
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jwtVerify(auth.slice(7), secret);

      const actorType = payload.actorType as string;
      const diditStatus = payload.diditStatus as string;
      const kycBlocked = payload.kycBlocked as boolean;
      const isKycMocked = process.env.IS_KYC_MOCKED === "true";

      const isOnKycExemptPath = KYC_EXEMPT_PATHS.some((p) => req.nextUrl.pathname === p);

      if (!isApiToApi && !isKycMocked && actorType === "transporter" && diditStatus !== "approved" && !isOnKycExemptPath) {
        if (kycBlocked) {
          return NextResponse.json(
            { error: "Cuenta bloqueada por exceder intentos de verificación", code: "KYC_BLOCKED" },
            { status: 403 }
          );
        }
        return NextResponse.json(
          { error: "Debes completar la verificación KYC antes de usar la plataforma", code: "KYC_PENDING" },
          { status: 403 }
        );
      }

      if (!isApiToApi && !isSafeMethod(req.method)) {
        const storedToken = (payload.csrfToken as string) || null;
        const result = validateCsrf(req, storedToken);
        if (!result.valid) {
          return NextResponse.json({ error: result.error }, { status: 403 });
        }
      }
    } catch {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
