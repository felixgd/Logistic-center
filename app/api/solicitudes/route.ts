import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, requireTipo, jsonError } from "@/lib/auth";
import { publishEvent } from "@/lib/pubsub";
import { sanitizeText, normalizeUnit, validateQuantity, validateUrgency } from "@/lib/validation";

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

  const requestsWithOriginal = requests.map((r) => ({
    ...r,
    quantityOriginal: r.quantity + (r.quantityFulfilled || 0),
    quantityPending: r.quantity,
  }));

  return Response.json(requestsWithOriginal);
}

export async function POST(req: NextRequest) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");
  const rError = requireTipo(["relief"])(auth);
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

    const urgencyValidation = validateUrgency(body.urgency);
    if (!urgencyValidation.valid) return jsonError(400, urgencyValidation.error);

    const solicitud = await prisma.request.create({
      data: {
        userId: auth.userId,
        actorId: auth.actorId,
        category,
        name,
        unit,
        quantity: qtyValidation.quantity,
        urgency: urgencyValidation.urgency,
        status: "open",
        notes,
      },
    });

    await publishEvent("solicitud.creada", {
      userId: auth.userId, actorId: auth.actorId,
      requestId: solicitud.id, name, quantity: qtyValidation.quantity, urgency: urgencyValidation.urgency,
    });

    return Response.json(solicitud, { status: 201 });
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
