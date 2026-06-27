import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, requireTipo, jsonError } from "@/lib/auth";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendSms } from "@/lib/zavu";

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
    const wa = updated.warehouseActor;
    const ra = updated.reliefActor;
    const ta = updated.transporterActor;
    const itemsList = updated.shipmentItem.map((i: any) => `• ${i.quantity} ${i.unit} - ${i.name}`).join("\n");

    const msgAsignado = `Viaje asignado ${codigo}\nInsumos:\n${itemsList}\n\nAlmacen: ${wa?.name} (${wa?.phone || wa?.whatsapp || "—"})\nCentro: ${ra?.name} (${ra?.phone || ra?.whatsapp || "—"})\nTransportista: ${ta?.name} (${ta?.phone || ta?.whatsapp || "—"})`;

    const toNotify = [
      ta?.phone || ta?.whatsapp,
      wa?.phone || wa?.whatsapp,
      ra?.phone || ra?.whatsapp,
    ];

    for (const phone of toNotify) {
      if (phone) await sendSms(`+${phone}`, msgAsignado);
    }

    if (ta?.whatsapp) {
      await sendWhatsAppMessage(ta.whatsapp,
        `🚚 Envio Asignado\nCodigo: ${codigo}\n\n📥 CARGAR en: ${wa?.name}\n📍 ${wa?.address}\n\n📤 DESCARGAR en: ${ra?.name}\n📍 ${ra?.address}\n\n📋 Manifiesto:\n${itemsList}\n\nResponde: CONFIRMAR para aceptar el envio.`
      );
    }

    return Response.json(updated);
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
