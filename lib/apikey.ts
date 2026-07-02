import crypto from "crypto";

// Prefijo legible para identificar el tipo de secreto (estilo "sk_").
export const API_KEY_PREFIX = "sk_";

// Genera una API key de alta entropía: prefijo + 32 bytes aleatorios en hex.
export function generateApiKey(): string {
  return API_KEY_PREFIX + crypto.randomBytes(32).toString("hex");
}

// Hash determinístico SHA-256 (hex) para poder buscar por índice único.
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

// Comparación en tiempo constante de dos hashes hex del mismo largo.
export function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
