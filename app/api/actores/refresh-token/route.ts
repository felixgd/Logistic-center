import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, signToken, jsonError } from "@/lib/auth";
import { generateCsrfToken } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthActor(req);
    if (!auth) return jsonError(401, "Token requerido");

    const actor = await prisma.actor.findUnique({ where: { id: auth.actorId } });
    if (!actor) return jsonError(404, "Actor no encontrado");
    if (actor.type !== "transporter") return jsonError(400, "Solo transportistas pueden refrescar token KYC");
    if (actor.diditStatus !== "approved") return jsonError(400, "KYC aún no aprobado");

    const csrfToken = generateCsrfToken();
    const token = signToken({
      userId: auth.userId,
      actorId: actor.id,
      actorType: actor.type,
      csrfToken,
      diditStatus: actor.diditStatus,
      kycBlocked: actor.kycBlocked,
    });

    return Response.json({ token });
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
