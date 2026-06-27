import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, signToken, jsonError } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  try {
    const { actorId } = await req.json();
    if (!actorId) return jsonError(400, "actorId es requerido");

    // Verify if the user owns this actor
    const owned = await prisma.actor.findFirst({
      where: { id: actorId, userId: auth.userId },
    });

    let actor = owned;
    let isOwner = true;

    // Verify membership if not owned
    if (!actor) {
      const membership = await prisma.actor_user.findFirst({
        where: { actorId, userId: auth.userId, deletedAt: null },
        include: { actor: true },
      });
      if (!membership) {
        return jsonError(403, "No tienes permiso para acceder a este perfil");
      }
      actor = membership.actor;
      isOwner = false;
    }

    if (!actor) {
      return jsonError(404, "Perfil no encontrado");
    }

    const user = await prisma.user.findUnique({ where: { id: auth.userId } });

    // Sign a new token with the new actor ID and type
    const token = signToken({ 
      userId: auth.userId, 
      actorId: actor.id, 
      actorType: actor.type 
    });

    return Response.json({
      token,
      actor: {
        id: actor.id,
        type: actor.type,
        name: actor.name,
        email: user?.email,
        whatsapp: actor.whatsapp,
        phone: actor.phone,
        isOwner,
      },
    });
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
