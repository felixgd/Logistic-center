import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError } from "@/lib/auth";
import { notifyBySms, formatItems } from "@/lib/notifications";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sanitizeText } from "@/lib/validation";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  const { id } = params;
  const actor = await prisma.actor.findUnique({ where: { id: auth.actorId } });
  if (!actor) return jsonError(404, "Actor no encontrado");

  try {
    const body = await req.json();
    const type = sanitizeText(body.type || "otro");
    const description = sanitizeText(body.description || "");

    if (!description) return jsonError(400, "La descripción del incidente es requerida");

    const tiposValidos = ["retraso", "vehiculo", "insumos", "accidente", "otro"];
    if (!tiposValidos.includes(type)) return jsonError(400, "Tipo de incidente inválido");

    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: {
        warehouseActor: { select: { id: true, name: true, phone: true, whatsapp: true, userId: true } },
        reliefActor: { select: { id: true, name: true, phone: true, whatsapp: true, userId: true } },
        transporterActor: { select: { id: true, name: true, phone: true, whatsapp: true, userId: true } },
        shipmentItem: true,
      },
    });

    if (!shipment) return jsonError(404, "Envío no encontrado");

    const incident = await prisma.order_incident.create({
      data: {
        shipmentId: id,
        type,
        description,
        reportedBy: auth.actorId,
      },
    });

    const codigo = shipment.notes?.startsWith("VIA-")
      ? shipment.notes.split(" ")[0]
      : shipment.id.slice(-8).toUpperCase();

    const tipoLabel: Record<string, string> = {
      retraso: "Retraso por Tráfico/Bloqueo",
      vehiculo: "Falla Mecánica del Vehículo",
      insumos: "Problema con los Insumos",
      accidente: "Accidente Vial",
      otro: "Otro Motivo",
    };

    const hora = new Date().toLocaleString("es-VE", {
      timeZone: "America/Caracas",
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const msg = `⚠️ INCIDENTE - ${codigo}
Tipo: ${tipoLabel[type] || type}
Hora: ${hora}
Reportado por: ${actor.name}
Descripción: ${description}`;

    const actors = [
      { data: shipment.warehouseActor, rol: "almacén" },
      { data: shipment.reliefActor, rol: "centro de ayuda" },
    ];
    if (shipment.transporterActor) {
      actors.push({ data: shipment.transporterActor, rol: "transportista" });
    }

    for (const { data: a } of actors) {
      if (a?.whatsapp) {
        await sendWhatsAppMessage(a.whatsapp, msg);
      }
      await notifyBySms(a?.phone || a?.whatsapp, msg);
      if (a?.userId) {
        await prisma.notification.create({
          data: {
            userId: a.userId,
            actorId: a.id,
            type: "incidente",
            title: `Incidente en ${codigo}`,
            message: `Tipo: ${tipoLabel[type] || type}. ${description}`,
            link: "/viajes",
          },
        });
      }
    }

    return Response.json(incident, { status: 201 });
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
