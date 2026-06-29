import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError } from "@/lib/auth";
import { publishEvent } from "@/lib/pubsub";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { notifyBySms, formatTripCode, formatItems, createNotification } from "@/lib/notifications";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  try {
    const { status } = await req.json();

    const shipment = await prisma.shipment.findUnique({
      where: { id: params.id },
      include: {
        shipmentItem: true,
        warehouseActor: { select: { id: true, name: true, phone: true, whatsapp: true, userId: true } },
        reliefActor: { select: { id: true, name: true, phone: true, whatsapp: true, userId: true } },
        transporterActor: { select: { id: true, name: true, phone: true, whatsapp: true, userId: true } },
      },
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
      if (shipment.status !== "proposed" && shipment.status !== "approved") {
        return jsonError(400, "Solo se pueden cancelar viajes que aún no han sido aceptados por un transportista");
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
                ...(status === "delivered" ? { quantity: { decrement: item.quantity } } : {}),
              },
            });
          }
        }

        if (status === "delivered") {
          if (shipment.requestId) {
            const request = await tx.request.findUnique({ where: { id: shipment.requestId } });
            if (request) {
              const deliveredShipments = await tx.shipment.findMany({
                where: { requestId: shipment.requestId, status: "delivered" },
                include: { shipmentItem: true },
              });
              const totalDelivered = deliveredShipments.reduce((sum, s) =>
                sum + s.shipmentItem.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
              );
              const quantityOriginal = request.quantity + (request.quantityFulfilled || 0);
              if (totalDelivered >= quantityOriginal) {
                await tx.request.update({ where: { id: shipment.requestId }, data: { status: "fulfilled" } });
              }
            }
          }
        }

        if (status === "cancelled" && shipment.requestId) {
          const shippedQty = shipment.shipmentItem.reduce((sum, item) => sum + item.quantity, 0);
          const updated = await tx.request.update({
            where: { id: shipment.requestId },
            data: {
              quantity: { increment: shippedQty },
              quantityFulfilled: { decrement: shippedQty },
            },
          });
          if (updated.quantityFulfilled <= 0) {
            await tx.request.update({
              where: { id: shipment.requestId },
              data: { status: "open" },
            });
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
      if (ra?.userId) {
        await createNotification({
          userId: ra.userId,
          actorId: ra.id,
          type: "viaje.aprobado",
          title: "Envío aprobado",
          message: `El almacén ${wa?.name || "—"} aprobó el envío ${codigo}.`,
          link: "/viajes",
        });
      }
    }

    if (status === "assigned") {
      const msg = `Envio ${codigo} asignado a transportista ${ta?.name || "—"}. Insumos: ${itemsStr}.`;
      if (wa?.whatsapp) await sendWhatsAppMessage(wa.whatsapp, `🚚 Envio Asignado\nCodigo: ${codigo}\nTransportista: ${ta?.name}`);
      if (ra?.whatsapp) await sendWhatsAppMessage(ra.whatsapp, `🚚 Envio Asignado\nCodigo: ${codigo}\nTransportista: ${ta?.name}`);
      if (ta?.whatsapp) await sendWhatsAppMessage(ta.whatsapp, `🚚 Envio Asignado\nCodigo: ${codigo}\nAlmacen: ${wa?.name}\nCentro: ${ra?.name}`);
      await notifyBySms(wa?.phone || wa?.whatsapp, msg);
      await notifyBySms(ra?.phone || ra?.whatsapp, msg);
      await notifyBySms(ta?.phone || ta?.whatsapp, msg);

      const phoneList = `Almacén: ${wa?.name} (${wa?.phone || wa?.whatsapp || "—"})\nCentro: ${ra?.name} (${ra?.phone || ra?.whatsapp || "—"})\nTransportista: ${ta?.name} (${ta?.phone || ta?.whatsapp || "—"})`;
      await createNotification({ userId: wa?.userId, actorId: wa?.id, type: "viaje.asignado", title: "Envío asignado", message: `${msg}\n\n${phoneList}`, link: "/viajes" });
      await createNotification({ userId: ra?.userId, actorId: ra?.id, type: "viaje.asignado", title: "Envío asignado", message: `${msg}\n\n${phoneList}`, link: "/viajes" });
      await createNotification({ userId: ta?.userId, actorId: ta?.id, type: "viaje.asignado", title: "Envío asignado", message: `${msg}\n\n${phoneList}`, link: "/viajes" });
    }

    if (status === "in_transit") {
      const msg = `Viaje ${codigo} en tránsito. Transportista: ${ta?.name} (${ta?.phone || ta?.whatsapp || "—"}).`;
      if (wa?.whatsapp) await sendWhatsAppMessage(wa.whatsapp, `🚚 Viaje en Tránsito\nCódigo: ${codigo}\nTransportista: ${ta?.name}`);
      if (ra?.whatsapp) await sendWhatsAppMessage(ra.whatsapp, `🚚 Viaje en Tránsito\nCódigo: ${codigo}\nTransportista: ${ta?.name}`);
      await notifyBySms(wa?.phone || wa?.whatsapp, msg);
      await notifyBySms(ra?.phone || ra?.whatsapp, msg);

      await createNotification({ userId: wa?.userId, actorId: wa?.id, type: "viaje.en_transito", title: "Viaje en tránsito", message: msg, link: "/viajes" });
      await createNotification({ userId: ra?.userId, actorId: ra?.id, type: "viaje.en_transito", title: "Viaje en tránsito", message: msg, link: "/viajes" });
    }

    if (status === "delivered") {
      await publishEvent("viaje.completado", {
        shipmentId: shipment.id, warehouseActorId: shipment.warehouseActorId, reliefActorId: shipment.reliefActorId,
      });
      const msg = `Viaje ${codigo} entregado. Transportista: ${ta?.name} (${ta?.phone || ta?.whatsapp || "—"}).`;
      if (shipment.reliefActor?.whatsapp) {
        await sendWhatsAppMessage(shipment.reliefActor.whatsapp,
          `✅ Entrega Completada\nCódigo: ${codigo}\nLos insumos han llegado a su destino.`
        );
      }
      if (wa?.whatsapp) await sendWhatsAppMessage(wa.whatsapp, `✅ Entrega Completada\nCódigo: ${codigo}`);
      await notifyBySms(ra?.phone || ra?.whatsapp, msg);
      await notifyBySms(wa?.phone || wa?.whatsapp, msg);

      await createNotification({ userId: wa?.userId, actorId: wa?.id, type: "viaje.entregado", title: "Envío entregado", message: msg, link: "/viajes" });
      await createNotification({ userId: ra?.userId, actorId: ra?.id, type: "viaje.entregado", title: "Envío entregado", message: msg, link: "/viajes" });
    }

    return Response.json({ mensaje: "Estado actualizado" });
  } catch (error: any) {
    if (error.code === "P2034") {
      return jsonError(409, "Conflicto: intenta de nuevo.");
    }
    return jsonError(500, error.message);
  }
}
