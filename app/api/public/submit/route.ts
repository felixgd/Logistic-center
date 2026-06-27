import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { findOrCreateActor } from "@/lib/frictionless";
import { publishEvent } from "@/lib/pubsub";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action, // "request", "supply", "driver"
      name,
      whatsapp,
      address,
      city,
      lat,
      lng,
      // For drivers
      vehicleType,
      capacityKg,
      // For requests/supplies
      category,
      itemName, // Avoid collision with actor name
      unit,
      quantity,
      urgency,
      notes,
    } = body;

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
    const { token, actor } = await findOrCreateActor({
      name,
      whatsapp,
      type,
      address: address || "Sin dirección",
      city: city || "Sin ciudad",
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
      vehicleType,
      capacityKg: capacityKg ? Number(capacityKg) : undefined,
    });

    let resultPayload: any = { token, actor };

    // 3. Perform the specific action
    if (action === "request") {
      // Create supply request
      const requestRecord = await prisma.request.create({
        data: {
          actorId: actor.id,
          userId: (await prisma.actor.findUnique({ where: { id: actor.id } }))?.userId || actor.id,
          category: category || "general",
          name: itemName,
          unit: unit || "unidades",
          quantity: Number(quantity),
          urgency: urgency || "media",
          status: "open",
          notes: notes || "",
        },
      });

      await publishEvent("solicitud.creada", {
        userId: requestRecord.userId,
        actorId: actor.id,
        requestId: requestRecord.id,
        name: itemName,
        quantity: Number(quantity),
        urgency: urgency || "media",
      });

      resultPayload.request = requestRecord;
    } else if (action === "supply") {
      // Create supply entry
      const supplyRecord = await prisma.supply.create({
        data: {
          userId: (await prisma.actor.findUnique({ where: { id: actor.id } }))?.userId || actor.id,
          actorId: actor.id,
          category: category || "general",
          name: itemName,
          unit: unit || "unidades",
          quantity: Number(quantity),
          status: "available",
          notes: notes || "",
        },
      });

      await publishEvent("insumo.registrado", {
        userId: supplyRecord.userId,
        actorId: actor.id,
        supplyId: supplyRecord.id,
        name: itemName,
        quantity: Number(quantity),
        unit: unit || "unidades",
      });

      resultPayload.supply = supplyRecord;
    }

    return Response.json(resultPayload, { status: 201 });
  } catch (error: any) {
    console.error("Public submit API error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
