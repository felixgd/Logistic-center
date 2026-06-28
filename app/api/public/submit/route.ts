import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { findOrCreateActor } from "@/lib/frictionless";
import { publishEvent } from "@/lib/pubsub";
import { sanitizeText, normalizeUnit, validateQuantity, validateUrgency } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = sanitizeText(body.action);
    const name = sanitizeText(body.name);
    const whatsapp = sanitizeText(body.whatsapp);
    const address = sanitizeText(body.address || "Sin dirección");
    const city = sanitizeText(body.city || "Sin ciudad");
    const lat = body.lat ? Number(body.lat) : null;
    const lng = body.lng ? Number(body.lng) : null;
    const vehicleType = sanitizeText(body.vehicleType);
    const capacityKg = body.capacityKg ? Number(body.capacityKg) : undefined;
    const category = sanitizeText(body.category || "general");
    const itemName = sanitizeText(body.itemName);
    const unit = normalizeUnit(body.unit);
    const quantity = body.quantity;
    const urgency = body.urgency;
    const notes = sanitizeText(body.notes);

    if (!name || !whatsapp) {
      return Response.json({ error: "Nombre y WhatsApp son requeridos." }, { status: 400 });
    }

    // 1. Map action to actor type
    let type: "warehouse" | "relief" | "transporter";
    if (action === "request") {
      type = "relief";
    } else if (action === "supply") {
      type = "warehouse";
    } else {
      type = "transporter";
    }

    // 2. Find or create the actor
    const { token, csrfToken, actor } = await findOrCreateActor({
      name,
      whatsapp,
      type,
      address,
      city,
      lat,
      lng,
      vehicleType,
      capacityKg,
    });

    let resultPayload: any = { token, csrfToken, actor };

    // 3. Perform the specific action
    if (action === "request") {
      if (!itemName) {
        return Response.json({ error: "Nombre del insumo es requerido." }, { status: 400 });
      }

      const qtyValidation = validateQuantity(quantity);
      if (!qtyValidation.valid) return Response.json({ error: qtyValidation.error }, { status: 400 });

      const urgencyValidation = validateUrgency(urgency);
      if (!urgencyValidation.valid) return Response.json({ error: urgencyValidation.error }, { status: 400 });

      // Create supply request
      const requestRecord = await prisma.request.create({
        data: {
          actorId: actor.id,
          userId: (await prisma.actor.findUnique({ where: { id: actor.id } }))?.userId || actor.id,
          category,
          name: itemName.toLowerCase(),
          unit,
          quantity: qtyValidation.quantity,
          urgency: urgencyValidation.urgency,
          status: "open",
          notes,
        },
      });

      await publishEvent("solicitud.creada", {
        userId: requestRecord.userId,
        actorId: actor.id,
        requestId: requestRecord.id,
        name: itemName.toLowerCase(),
        quantity: qtyValidation.quantity,
        urgency: urgencyValidation.urgency,
      });

      resultPayload.request = requestRecord;
    } else if (action === "supply") {
      if (!itemName) {
        return Response.json({ error: "Nombre del insumo es requerido." }, { status: 400 });
      }

      const qtyValidation = validateQuantity(quantity);
      if (!qtyValidation.valid) return Response.json({ error: qtyValidation.error }, { status: 400 });

      // Check for duplicate
      const existing = await prisma.supply.findFirst({
        where: { actorId: actor.id, name: { equals: itemName.toLowerCase(), mode: "insensitive" } },
      });
      if (existing) {
        return Response.json({ error: "Este almacén ya tiene registrado este insumo." }, { status: 400 });
      }

      // Create supply entry
      const supplyRecord = await prisma.supply.create({
        data: {
          userId: (await prisma.actor.findUnique({ where: { id: actor.id } }))?.userId || actor.id,
          actorId: actor.id,
          category,
          name: itemName.toLowerCase(),
          unit,
          quantity: qtyValidation.quantity,
          status: "available",
          notes,
        },
      });

      await publishEvent("insumo.registrado", {
        userId: supplyRecord.userId,
        actorId: actor.id,
        supplyId: supplyRecord.id,
        name: itemName.toLowerCase(),
        quantity: qtyValidation.quantity,
        unit,
      });

      resultPayload.supply = supplyRecord;
    }

    return Response.json(resultPayload, { status: 201 });
  } catch (error: any) {
    console.error("Public submit API error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
