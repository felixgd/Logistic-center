import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError } from "@/lib/auth";
import { publishEvent } from "@/lib/pubsub";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  try {
    const { status } = await req.json();
    const solicitud = await prisma.request.update({
      where: { id: params.id },
      data: { status },
    });

    await publishEvent("solicitud.estado.cambiado", {
      requestId: solicitud.id, status,
    });

    return Response.json(solicitud);
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
