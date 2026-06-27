import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  try {
    const notification = await prisma.notification.findFirst({
      where: { id: params.id, userId: auth.userId },
    });
    if (!notification) return jsonError(404, "Notificación no encontrada");

    await prisma.notification.update({
      where: { id: params.id },
      data: { read: true },
    });
    return Response.json({ mensaje: "Notificación marcada como leída" });
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
