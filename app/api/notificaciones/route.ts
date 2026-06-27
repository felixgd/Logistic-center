import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return Response.json(notifications);
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  try {
    await prisma.notification.updateMany({
      where: { userId: auth.userId, read: false },
      data: { read: true },
    });
    return Response.json({ mensaje: "Notificaciones marcadas como leídas" });
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
