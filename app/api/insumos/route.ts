import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, requireTipo, jsonError } from "@/lib/auth";
import { publishEvent } from "@/lib/pubsub";

export async function GET(req: NextRequest) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  const { searchParams } = new URL(req.url);
  const disponibles = searchParams.get("disponibles");

  const actor = await prisma.actor.findUnique({ where: { id: auth.actorId } });

  const filter: any = {};
  if (actor?.type === "warehouse") filter.actorId = auth.actorId;
  if (disponibles === "true") filter.status = "available";

  const supplies = await prisma.supply.findMany({
    where: filter,
    include: { actor: { select: { id: true, name: true, address: true, whatsapp: true } } },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(supplies);
}

export async function POST(req: NextRequest) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");
  const rError = requireTipo(["warehouse"])(auth);
  if (rError) return jsonError(403, rError);

  try {
    const { category, name, unit, quantity, notes } = await req.json();
    const supply = await prisma.supply.create({
      data: {
        userId: auth.userId,
        actorId: auth.actorId,
        category: category || "general",
        name,
        unit: unit || "unidad",
        quantity,
        status: "available",
        notes,
      },
    });

    await publishEvent("insumo.registrado", {
      userId: auth.userId, actorId: auth.actorId,
      supplyId: supply.id, name, quantity, unit,
    });

    return Response.json(supply, { status: 201 });
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
