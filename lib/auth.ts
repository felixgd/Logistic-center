import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

const SECRET = () => process.env.JWT_SECRET || "secret";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: { userId: string; actorId: string; actorType: string }): string {
  return jwt.sign(payload, SECRET(), { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: string; actorId: string; actorType: string } | null {
  try {
    return jwt.verify(token, SECRET()) as { userId: string; actorId: string; actorType: string };
  } catch {
    return null;
  }
}

export function getAuthActor(req: NextRequest): { userId: string; actorId: string; actorType: string } | null {
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
