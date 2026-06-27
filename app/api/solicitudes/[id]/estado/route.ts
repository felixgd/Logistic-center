import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError } from "@/lib/auth";
import { publishEvent } from "@/lib/pubsub";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  try {
    const { status } = await req.json();

    const solicitud = await prisma.request.findUnique({ where: { id: params.id } });
    if (!solicitud) return jsonError(404, "Solicitud no encontrada");

    if (status === "cancelled") {
      if (solicitud.actorId !== auth.actorId) return jsonError(403, "Solo el centro que creó la solicitud puede cancelarla");
      if (solicitud.status !== "open") return jsonError(400, "Solo se pueden cancelar solicitudes abiertas");
    }

    const updated = await prisma.request.update({
      where: { id: params.id },
      data: { status },
    });

    await publishEvent("solicitud.estado.cambiado", {
      requestId: updated.id, status,
    });

    return Response.json(updated);
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
