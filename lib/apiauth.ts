import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError, TokenPayload } from "@/lib/auth";
import { hashApiKey, timingSafeEqualHex } from "@/lib/apikey";

export type ApiKeyRecord = { id: string; name: string; trackingId: string };

// Lee la key del header x-api-key, la hashea (SHA-256) y la busca por índice.
// Rechaza si no existe o está revocada. Devuelve datos no sensibles de la key.
export async function verifyApiKey(req: NextRequest): Promise<ApiKeyRecord | null> {
  const presented = req.headers.get("x-api-key");
  if (!presented) return null;

  const keyHash = hashApiKey(presented);

  const record = await prisma.api_key.findUnique({ where: { keyHash } });
  if (!record) return null;
  if (record.revokedAt) return null;

  // Defensa en profundidad sobre el lookup por índice: confirmación en tiempo constante.
  if (!timingSafeEqualHex(keyHash, record.keyHash)) return null;

  // Seguimiento de uso (best-effort: no bloquea la request si falla).
  await prisma.api_key
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { id: record.id, name: record.name, trackingId: record.trackingId };
}

export type ApiAuthResult =
  | { ok: true; actor: TokenPayload; apiKey: ApiKeyRecord }
  | { ok: false; response: Response };

// Auth compuesta para rutas API-a-API: exige JWT (reusa getAuthActor) + API key.
// El CSRF se omite en el middleware para estas rutas (ver API_TO_API_PATHS).
//
// Uso en un route handler:
//   const authz = await requireApiAuth(req);
//   if (!authz.ok) return authz.response;
//   const { actor, apiKey } = authz;
export async function requireApiAuth(req: NextRequest): Promise<ApiAuthResult> {
  const actor = getAuthActor(req);
  if (!actor) return { ok: false, response: jsonError(401, "Token requerido") };

  const apiKey = await verifyApiKey(req);
  if (!apiKey) return { ok: false, response: jsonError(401, "API key inválida o ausente") };

  return { ok: true, actor, apiKey };
}
