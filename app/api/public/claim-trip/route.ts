import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { findOrCreateActor } from "@/lib/frictionless";
import { publishEvent } from "@/lib/pubsub";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  try {
    const { shipmentId, name, whatsapp } = await req.json();

    if (!shipmentId || !name || !whatsapp) {
      return Response.json({ error: "shipmentId, name, y whatsapp son requeridos." }, { status: 400 });
    }

    // 1. Find or create the transporter actor
    const { actor } = await findOrCreateActor({
      name,
      whatsapp,
      type: "transporter",
      address: "Móvil",
      city: "Móvil",
      lat: null,
      lng: null,
    });

    // 2. Fetch the shipment to make sure it's valid and unassigned
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        warehouseActor: true,
        reliefActor: true,
        shipmentItem: true,
      },
    });

    if (!shipment) {
      return Response.json({ error: "Envío no encontrado." }, { status: 404 });
    }

    if (shipment.transporterActorId) {
      return Response.json({ error: "Este envío ya tiene un transportista asignado." }, { status: 400 });
    }

    // 3. Assign transporter to shipment and update status
    const updatedShipment = await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        transporterActorId: actor.id,
        status: "assigned",
      },
    });

    // 4. Publish Event
    await publishEvent("viaje.asignado", {
      shipmentId,
      transporterActorId: actor.id,
      driverName: name,
      driverWhatsapp: whatsapp,
    });

    // 5. WhatsApp Coordination Messages
    const itemsStr = shipment.shipmentItem.map((i) => `${i.quantity} ${i.unit} de ${i.name}`).join(", ");
    const codigo = shipment.notes?.split(" ")[0] || shipment.id.slice(-8).toUpperCase();

    // Notify Warehouse
    if (shipment.warehouseActor?.whatsapp) {
      await sendWhatsAppMessage(
        shipment.warehouseActor.whatsapp,
        `🚚 Conductor asignado para envío ${codigo}\nNombre: ${name}\nWhatsApp: ${whatsapp}\nPor favor, coordinar la recogida.`
      );
    }

    // Notify Relief Center
    if (shipment.reliefActor?.whatsapp) {
      await sendWhatsAppMessage(
        shipment.reliefActor.whatsapp,
        `🚚 Conductor asignado para tu ayuda ${codigo}\nNombre: ${name}\nWhatsApp: ${whatsapp}`
      );
    }

    // Notify Driver (Send origin & destination details)
    await sendWhatsAppMessage(
      whatsapp,
      `✅ Has aceptado el viaje ${codigo}!\n📍 Recogida (Almacén): ${shipment.warehouseActor.name} - ${shipment.warehouseActor.address || ""}\n📍 Entrega (Centro de Ayuda): ${shipment.reliefActor.name} - ${shipment.reliefActor.address || ""}\n📦 Carga: ${itemsStr}`
    );

    return Response.json({
      mensaje: "Envío reclamado con éxito",
      shipment: updatedShipment,
    });
  } catch (error: any) {
    console.error("Public claim-trip API error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
