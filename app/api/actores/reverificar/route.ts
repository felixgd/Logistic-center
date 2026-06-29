import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError } from "@/lib/auth";
import { createDiditSession } from "@/lib/didit";

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthActor(req);
    if (!auth) return jsonError(401, "Token requerido");

    const actor = await prisma.actor.findUnique({ where: { id: auth.actorId }, include: { user: true } });
    if (!actor) return jsonError(404, "Actor no encontrado");
    if (actor.type !== "transporter") return jsonError(400, "Solo transportistas pueden verificar identidad");

    const { session_id, url } = await createDiditSession(actor.id, actor.user?.email || undefined);

    await prisma.actor.update({
      where: { id: actor.id },
      data: { diditSessionId: session_id, diditStatus: "pending" },
    });

    return Response.json({ url, sessionId: session_id });
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
