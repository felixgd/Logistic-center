import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, requireTipo, jsonError } from "@/lib/auth";
import { publishEvent } from "@/lib/pubsub";
import { sanitizeText, normalizeUnit, validateQuantity } from "@/lib/validation";

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
    include: { actor: { select: { id: true, name: true, address: true, city: true, lat: true, lng: true, whatsapp: true } } },
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
    const body = await req.json();
    const category = sanitizeText(body.category || "general");
    const name = sanitizeText(body.name).toLowerCase();
    const unit = normalizeUnit(body.unit);
    const notes = sanitizeText(body.notes);

    if (!name) return jsonError(400, "El nombre del insumo es requerido");

    const qtyValidation = validateQuantity(body.quantity);
    if (!qtyValidation.valid) return jsonError(400, qtyValidation.error);

    const existing = await prisma.supply.findFirst({
      where: { actorId: auth.actorId, name: { equals: name, mode: "insensitive" } },
    });
    if (existing) return jsonError(400, "Ya tienes registrado este insumo");

    const supply = await prisma.supply.create({
      data: {
        userId: auth.userId,
        actorId: auth.actorId,
        category,
        name,
        unit,
        quantity: qtyValidation.quantity,
        status: "available",
        notes,
      },
    });

    await publishEvent("insumo.registrado", {
      userId: auth.userId, actorId: auth.actorId,
      supplyId: supply.id, name, quantity: qtyValidation.quantity, unit,
    });

    return Response.json(supply, { status: 201 });
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
