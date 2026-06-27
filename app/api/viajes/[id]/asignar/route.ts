import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, requireTipo, jsonError } from "@/lib/auth";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { notifyBySms, formatTripCode, formatItems } from "@/lib/notifications";

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
    if (shipment.status !== "approved" || shipment.transporterActorId)
      return jsonError(400, "El envío no está disponible para asignación");

    const { transporterActorId } = await req.json();

    const updated = await prisma.shipment.update({
      where: { id: params.id },
      data: { transporterActorId: transporterActorId || auth.actorId, status: "assigned", updatedAt: new Date() },
      include: { transporterActor: true, warehouseActor: true, reliefActor: true, shipmentItem: true },
    });

    const codigo = formatTripCode(updated);
    const wa = updated.warehouseActor;
    const ra = updated.reliefActor;
    const ta = updated.transporterActor;
    const itemsList = updated.shipmentItem.map((i: any) => `• ${i.quantity} ${i.unit} - ${i.name}`).join("\n");
    const itemsStr = formatItems(updated.shipmentItem);

    const msgAsignado = `Viaje asignado ${codigo}. Insumos: ${itemsStr}. Transportista: ${ta?.name || "—"}.`;

    await notifyBySms(wa?.phone || wa?.whatsapp, msgAsignado);
    await notifyBySms(ra?.phone || ra?.whatsapp, msgAsignado);
    await notifyBySms(ta?.phone || ta?.whatsapp, msgAsignado);

    if (ta?.whatsapp) {
      await sendWhatsAppMessage(ta.whatsapp,
        `🚚 Envio Asignado\nCodigo: ${codigo}\n\n📥 CARGAR en: ${wa?.name}\n📍 ${wa?.address}\n\n📤 DESCARGAR en: ${ra?.name}\n📍 ${ra?.address}\n\n📋 Manifiesto:\n${itemsList}\n\nResponde: CONFIRMAR para aceptar el envio.`
      );
    }
    if (wa?.whatsapp) await sendWhatsAppMessage(wa.whatsapp, `🚚 Envio Asignado\nCodigo: ${codigo}\nTransportista: ${ta?.name}`);
    if (ra?.whatsapp) await sendWhatsAppMessage(ra.whatsapp, `🚚 Envio Asignado\nCodigo: ${codigo}\nTransportista: ${ta?.name}`);

    return Response.json(updated);
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
