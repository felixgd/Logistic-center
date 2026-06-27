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

  const body = await req.json();

  if (body.mode === "add") {
    const delta = Number(body.delta);
    if (isNaN(delta)) return jsonError(400, "Delta inválido");
    if (supply.quantity + delta < 0) return jsonError(400, "La cantidad no puede ser menor a 0");
    const updated = await prisma.supply.update({
      where: { id: params.id },
      data: { quantity: { increment: delta } },
    });
    return Response.json(updated);
  }

  const expectedVersion = Number(body.version);
  if (isNaN(expectedVersion)) return jsonError(400, "version requerido para asignación directa");

  const quantity = Number(body.quantity);
  if (isNaN(quantity) || quantity < 0) return jsonError(400, "Cantidad inválida");

  const result = await prisma.supply.updateMany({
    where: { id: params.id, version: expectedVersion },
    data: { quantity, version: { increment: 1 } },
  });
  if (result.count === 0) {
    const current = await prisma.supply.findUnique({ where: { id: params.id } });
    if (!current) return jsonError(404, "Insumo no encontrado");
    return jsonError(409, `Conflicto: otro usuario modificó este insumo (versión actual: ${current.version}, esperada: ${expectedVersion})`);
  }

  return Response.json(await prisma.supply.findUnique({ where: { id: params.id } }));
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
