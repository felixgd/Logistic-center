import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

const SECRET = () => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET no configurado");
  return process.env.JWT_SECRET;
};

export type TokenPayload = {
  userId: string;
  actorId: string;
  actorType: string;
  csrfToken?: string;
  diditStatus?: string;
  kycBlocked?: boolean;
};

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET(), { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, SECRET()) as TokenPayload;
  } catch {
    return null;
  }
}

export function getAuthActor(req: NextRequest): TokenPayload | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7));
}

export function requireTipo(tipos: string[]) {
  return (actor: { userId: string; actorId: string; actorType: string } | null): string | null => {
    if (!actor) return "Token requerido";
    if (!tipos.includes(actor.actorType)) return `Acceso denegado. Requiere rol: ${tipos.join(", ")}`;
    return null;
  };
}

export function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status });
}
