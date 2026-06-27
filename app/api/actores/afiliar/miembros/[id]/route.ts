import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError } from "@/lib/auth";
import { sanitizeText } from "@/lib/validation";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  const actor = await prisma.actor.findUnique({ where: { id: auth.actorId } });
  if (!actor || !["warehouse", "relief"].includes(actor.type)) return jsonError(403, "Acceso denegado");
  if (actor.userId !== auth.userId) return jsonError(403, "Solo el administrador principal puede gestionar afiliados");

  const membership = await prisma.actor_user.findFirst({
    where: { id: params.id, actorId: auth.actorId, deletedAt: null },
    include: { user: true },
  });
  if (!membership) return jsonError(404, "Afiliado no encontrado");

  const body = await req.json();
  const name = body.name !== undefined ? sanitizeText(body.name) : undefined;
  const email = body.email !== undefined ? sanitizeText(body.email) : undefined;
  const phone = body.phone !== undefined ? sanitizeText(body.phone) : undefined;

  const updateUser: any = {};
  if (name !== undefined) updateUser.name = name;
  if (email !== undefined) updateUser.email = email;

  if (Object.keys(updateUser).length > 0) {
    await prisma.user.update({
      where: { id: membership.userId },
      data: updateUser,
    });
  }

  if (phone !== undefined) {
    await prisma.actor_user.update({
      where: { id: params.id },
      data: { phone },
    });
  }

  return Response.json({ mensaje: "Afiliado actualizado" });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  const actor = await prisma.actor.findUnique({ where: { id: auth.actorId } });
  if (!actor || !["warehouse", "relief"].includes(actor.type)) return jsonError(403, "Acceso denegado");
  if (actor.userId !== auth.userId) return jsonError(403, "Solo el administrador principal puede gestionar afiliados");

  const membership = await prisma.actor_user.findFirst({
    where: { id: params.id, actorId: auth.actorId, deletedAt: null },
  });
  if (!membership) return jsonError(404, "Afiliado no encontrado");

  await prisma.actor_user.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });

  return Response.json({ mensaje: "Afiliado eliminado" });
}
