import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError } from "@/lib/auth";
import { publishEvent } from "@/lib/pubsub";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  try {
    const { status } = await req.json();

    const shipment = await prisma.shipment.findUnique({
      where: { id: params.id },
      include: { shipmentItem: true, reliefActor: true },
    });
    if (!shipment) return jsonError(404, "Envío no encontrado");

    if (status === "cancelled" && shipment.status === "proposed") {
      if (auth.actorId !== shipment.warehouseActorId && auth.actorId !== shipment.reliefActorId) {
        return jsonError(403, "Solo el almacén o el centro de ayuda puede cancelar este viaje");
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
