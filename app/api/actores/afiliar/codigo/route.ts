import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError } from "@/lib/auth";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  const actor = await prisma.actor.findUnique({ where: { id: auth.actorId } });
  if (!actor) return jsonError(404, "Actor no encontrado");
  if (!["warehouse", "relief"].includes(actor.type)) return jsonError(403, "Solo almacenes y centros de ayuda pueden generar códigos de afiliación");

  const code = crypto.randomBytes(4).toString("hex").toUpperCase();

  await prisma.affiliate_code.create({
    data: {
      actorId: auth.actorId,
      code,
    },
  });

  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_API_URL || vercelUrl || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const url = `${baseUrl}/register?code=${code}`;

  return Response.json({ code, url, actorName: actor.name });
}
