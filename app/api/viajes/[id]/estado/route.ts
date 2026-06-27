import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError } from "@/lib/auth";
import { publishEvent } from "@/lib/pubsub";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { notifyBySms, formatTripCode, formatItems } from "@/lib/notifications";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  try {
    const { status } = await req.json();

    const shipment = await prisma.shipment.findUnique({
      where: { id: params.id },
      include: { shipmentItem: true, warehouseActor: true, reliefActor: true, transporterActor: true },
    });
    if (!shipment) return jsonError(404, "Envío no encontrado");

    const validTransitions: Record<string, string[]> = {
      proposed: ["approved", "cancelled"],
      approved: ["assigned", "cancelled"],
      assigned: ["in_transit", "cancelled"],
      in_transit: ["delivered", "cancelled"],
      delivered: [],
      cancelled: [],
    };

    if (!validTransitions[shipment.status]?.includes(status)) {
      return jsonError(400, `No se puede cambiar el estado de ${shipment.status} a ${status}`);
    }

    if (status === "approved") {
      if (auth.actorId !== shipment.warehouseActorId) {
        return jsonError(403, "Solo el almacén puede aprobar este viaje");
      }
    }

    if (status === "cancelled") {
      if (auth.actorId !== shipment.warehouseActorId && auth.actorId !== shipment.reliefActorId) {
        return jsonError(403, "Solo el almacén o el centro de ayuda pueden cancelar este viaje");
      }
    }

    if (status === "in_transit" || status === "delivered") {
      if (auth.actorId !== shipment.transporterActorId) {
        return jsonError(403, "Solo el transportista asignado puede actualizar este viaje");
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: params.id },
        data: { status, updatedAt: new Date() },
      });

      if ((status === "delivered" || status === "cancelled") && shipment.status !== "delivered" && shipment.status !== "cancelled") {
        for (const item of shipment.shipmentItem) {
          if (item.supplyId) {
            await tx.supply.update({
              where: { id: item.supplyId },
              data: {
                quantityReserved: { decrement: item.quantity },
                ...(status === "cancelled" ? { quantity: { increment: item.quantity } } : {}),
              },
            });
          }
        }

        if (status === "delivered") {
          if (shipment.requestId) {
            await tx.request.update({ where: { id: shipment.requestId }, data: { status: "fulfilled" } });
          }
        }
      }
    }, { isolationLevel: "Serializable" });

    const codigo = formatTripCode(shipment);
    const itemsStr = formatItems(shipment.shipmentItem);
    const wa = shipment.warehouseActor;
    const ra = shipment.reliefActor;
    const ta = shipment.transporterActor;

    if (status === "approved") {
      const msg = `El almacen ${wa?.name || "—"} aprobo el envio ${codigo}. Insumos: ${itemsStr}.`;
      if (ra?.whatsapp) await sendWhatsAppMessage(ra.whatsapp, `✅ Envio Aprobado\nCodigo: ${codigo}\nAlmacen: ${wa?.name}`);
      await notifyBySms(ra?.phone || ra?.whatsapp, msg);
    }

    if (status === "assigned") {
      const msg = `Envio ${codigo} asignado a transportista ${ta?.name || "—"}. Insumos: ${itemsStr}.`;
      if (wa?.whatsapp) await sendWhatsAppMessage(wa.whatsapp, `🚚 Envio Asignado\nCodigo: ${codigo}\nTransportista: ${ta?.name}`);
      if (ra?.whatsapp) await sendWhatsAppMessage(ra.whatsapp, `🚚 Envio Asignado\nCodigo: ${codigo}\nTransportista: ${ta?.name}`);
      if (ta?.whatsapp) await sendWhatsAppMessage(ta.whatsapp, `🚚 Envio Asignado\nCodigo: ${codigo}\nAlmacen: ${wa?.name}\nCentro: ${ra?.name}`);
      await notifyBySms(wa?.phone || wa?.whatsapp, msg);
      await notifyBySms(ra?.phone || ra?.whatsapp, msg);
      await notifyBySms(ta?.phone || ta?.whatsapp, msg);
    }

    if (status === "delivered") {
      await publishEvent("viaje.completado", {
        shipmentId: shipment.id, warehouseActorId: shipment.warehouseActorId, reliefActorId: shipment.reliefActorId,
      });
      if (shipment.reliefActor?.whatsapp) {
        await sendWhatsAppMessage(shipment.reliefActor.whatsapp,
          `✅ Entrega Completada\nLos insumos han llegado a su destino.`
        );
      }
    }

    return Response.json({ mensaje: "Estado actualizado" });
  } catch (error: any) {
    if (error.code === "P2034") {
      return jsonError(409, "Conflicto: intenta de nuevo.");
    }
    return jsonError(500, error.message);
  }
}
