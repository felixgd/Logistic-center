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

export async function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (EXEMPT_PATHS.some((p) => req.nextUrl.pathname === p)) {
    return NextResponse.next();
  }

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

      if (!isKycMocked && actorType === "transporter" && diditStatus !== "approved" && !isOnKycExemptPath) {
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

      if (!isSafeMethod(req.method)) {
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
