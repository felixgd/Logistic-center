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
    const shipment = await prisma.shipment.update({
      where: { id: params.id },
      data: { status, updatedAt: new Date() },
      include: { reliefActor: true },
    });

    if (status === "delivered") {
      if (shipment.requestId) {
        await prisma.request.update({ where: { id: shipment.requestId }, data: { status: "fulfilled" } });
      }
      await publishEvent("viaje.completado", {
        shipmentId: shipment.id, warehouseActorId: shipment.warehouseActorId, reliefActorId: shipment.reliefActorId,
      });
      if (shipment.reliefActor?.whatsapp) {
        await sendWhatsAppMessage(shipment.reliefActor.whatsapp,
          `✅ Entrega Completada\nLos insumos han llegado a su destino.`
        );
      }
    }

    return Response.json(shipment);
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
