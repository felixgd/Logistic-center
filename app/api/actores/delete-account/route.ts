import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError } from "@/lib/auth";

export async function DELETE(req: NextRequest) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  try {
    const { userId } = auth;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return jsonError(404, "Usuario no encontrado");

    // Collect all actor IDs owned by this user
    const actors: { id: string }[] = await prisma.actor.findMany({ where: { userId }, select: { id: true } });
    const actorIds = actors.map((a) => a.id);

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Remove transporter references (NoAction constraint)
      if (actorIds.length > 0) {
        await tx.shipment.updateMany({
          where: { transporterActorId: { in: actorIds } },
          data: { transporterActorId: null },
        });
      }

      // Delete event_log entries referencing this user or their actors (NoAction)
      await tx.event_log.deleteMany({ where: { userId } });
      if (actorIds.length > 0) {
        await tx.event_log.deleteMany({ where: { actorId: { in: actorIds } } });
      }

      // Delete the user — cascades to account, session, actor, supply, request, shipment,
      // actor_user, notification, and all cascade chains from there
      await tx.user.delete({ where: { id: userId } });
    });

    return Response.json({ mensaje: "Cuenta eliminada correctamente" });
  } catch (error: any) {
    console.error("Delete account error:", error);
    return jsonError(500, error.message || "Error al eliminar la cuenta");
  }
}
