import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, requireTipo, jsonError } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");
  const rError = requireTipo(["warehouse"])(auth);
  if (rError) return jsonError(403, rError);

  const supply = await prisma.supply.findFirst({ where: { id: params.id, actorId: auth.actorId } });
  if (!supply) return jsonError(404, "Insumo no encontrado o no autorizado");

  const { category, name, unit, quantity, status, notes } = await req.json();
  const updated = await prisma.supply.update({
    where: { id: params.id },
    data: {
      ...(category !== undefined && { category }),
      ...(name !== undefined && { name }),
      ...(unit !== undefined && { unit }),
      ...(quantity !== undefined && { quantity }),
      ...(status !== undefined && { status }),
      ...(notes !== undefined && { notes }),
    },
  });
  return Response.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");
  const rError = requireTipo(["warehouse"])(auth);
  if (rError) return jsonError(403, rError);

  const supply = await prisma.supply.findFirst({ where: { id: params.id, actorId: auth.actorId } });
  if (!supply) return jsonError(404, "Insumo no encontrado o no autorizado");

  await prisma.supply.delete({ where: { id: params.id } });
  return Response.json({ mensaje: "Insumo eliminado" });
}
