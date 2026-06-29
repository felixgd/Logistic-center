import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { findOrCreateActor } from "@/lib/frictionless";
import { publishEvent } from "@/lib/pubsub";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getAuthActor } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { shipmentId, name, whatsapp, documentNumber, phoneVerificationToken } = await req.json();

    const missing: string[] = [];
    if (!shipmentId) missing.push("ID del envío");
    if (!name) missing.push("nombre");
    if (!whatsapp) missing.push("WhatsApp");
    if (missing.length > 0) {
      return Response.json({ error: `Campos requeridos faltantes: ${missing.join(", ")}.` }, { status: 400 });
    }

    const cleanWhatsapp = whatsapp.replace(/\D/g, "");
    const authActor = getAuthActor(req);
    if (!authActor) {
      if (!phoneVerificationToken) {
        return Response.json({ error: "Debes verificar tu teléfono antes de continuar." }, { status: 400 });
      }
      const verif = await prisma.phone_verification.findFirst({
        where: { phone: cleanWhatsapp, token: phoneVerificationToken, verified: true },
      });
      if (!verif) {
        return Response.json({ error: "Teléfono no verificado. Solicita un nuevo código." }, { status: 400 });
      }
    }

    // 1. Find or create the transporter actor
    const { token, csrfToken, actor, verificationUrl } = await findOrCreateActor({
      name,
      whatsapp,
      type: "transporter",
      address: "Móvil",
      city: "Móvil",
      lat: null,
      lng: null,
      documentNumber: documentNumber || null,
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

    // 3. Check KYC status — defer assignment if transporter is not KYC-approved
    const freshActor = await prisma.actor.findUnique({
      where: { id: actor.id },
      select: { diditStatus: true },
    });
    const kycApproved = freshActor?.diditStatus === "approved";

    if (!kycApproved) {
      await prisma.actor.update({
        where: { id: actor.id },
        data: { pendingClaimShipmentId: shipmentId },
      });

      return Response.json({
        mensaje: "Debes completar la verificación de identidad (KYC) antes de que el envío sea asignado.",
        token,
        csrfToken,
        actor,
        verificationUrl: verificationUrl || null,
      });
    }

    // 4. Assign transporter to shipment and update status
    const updatedShipment = await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        transporterActorId: actor.id,
        status: "assigned",
      },
    });

    // 5. Publish Event
    await publishEvent("viaje.asignado", {
      shipmentId,
      transporterActorId: actor.id,
      driverName: name,
      driverWhatsapp: whatsapp,
    });

    // 6. WhatsApp Coordination Messages
    const itemsStr = (shipment.shipmentItem as Array<{ quantity: number; unit: string; name: string }>).map((i) => `${i.quantity} ${i.unit} de ${i.name}`).join(", ");
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
      token,
      csrfToken,
      actor,
      shipment: updatedShipment,
    });
  } catch (error: any) {
    console.error("Public claim-trip API error:", error);
    return Response.json({ error: "An internal server error occurred." }, { status: 500 });
  }
}
