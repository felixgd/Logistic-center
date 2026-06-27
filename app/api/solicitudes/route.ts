import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, requireTipo, jsonError } from "@/lib/auth";
import { publishEvent } from "@/lib/pubsub";

export async function GET(req: NextRequest) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("estado");

  const actor = await prisma.actor.findUnique({ where: { id: auth.actorId } });

  const filter: any = {};
  if (actor?.type === "relief") filter.actorId = auth.actorId;
  if (status) filter.status = status;

  const requests = await prisma.request.findMany({
    where: filter,
    include: { actor: { select: { id: true, name: true, address: true, whatsapp: true, city: true, lat: true, lng: true } } },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(requests);
}

export async function POST(req: NextRequest) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");
  const rError = requireTipo(["relief"])(auth);
  if (rError) return jsonError(403, rError);

  try {
    const { category, name, unit, quantity, urgency, notes } = await req.json();
    const solicitud = await prisma.request.create({
      data: {
        userId: auth.userId,
        actorId: auth.actorId,
        category: category || "general",
        name,
        unit: unit || "unidad",
        quantity,
        urgency: urgency || "media",
        status: "open",
        notes,
      },
    });

    await publishEvent("solicitud.creada", {
      userId: auth.userId, actorId: auth.actorId,
      requestId: solicitud.id, name, quantity, urgency,
    });

    return Response.json(solicitud, { status: 201 });
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
