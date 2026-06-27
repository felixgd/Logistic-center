import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, requireTipo, jsonError } from "@/lib/auth";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");
  const rError = requireTipo(["transporter"])(auth);
  if (rError) return jsonError(403, rError);

  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: params.id },
      include: { shipmentItem: true, warehouseActor: true, reliefActor: true },
    });
    if (!shipment) return jsonError(404, "Envío no encontrado");
    if (shipment.status !== "proposed" || shipment.transporterActorId)
      return jsonError(400, "El envío no está disponible");

    const { transporterActorId } = await req.json();

    const updated = await prisma.shipment.update({
      where: { id: params.id },
      data: { transporterActorId: transporterActorId || auth.actorId, status: "assigned", updatedAt: new Date() },
      include: { transporterActor: true, warehouseActor: true, reliefActor: true, shipmentItem: true },
    });

    const codigo = updated.notes?.startsWith("VIA-") ? updated.notes.split(" ")[0] : updated.id.slice(-8).toUpperCase();

    if (updated.transporterActor?.whatsapp) {
      const itemsList = updated.shipmentItem.map((i: any) => `• ${i.quantity} ${i.unit} - ${i.name}`).join("\n");
      await sendWhatsAppMessage(updated.transporterActor.whatsapp,
        `🚚 Envio Asignado\nCodigo: ${codigo}\n\n📥 CARGAR en: ${updated.warehouseActor.name}\n📍 ${updated.warehouseActor.address}\n\n📤 DESCARGAR en: ${updated.reliefActor.name}\n📍 ${updated.reliefActor.address}\n\n📋 Manifiesto:\n${itemsList}\n\nResponde: CONFIRMAR para aceptar el envio.`
      );
    }

    return Response.json(updated);
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
