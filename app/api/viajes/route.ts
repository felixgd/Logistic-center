import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError } from "@/lib/auth";
import { publishEvent } from "@/lib/pubsub";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { notifyBySms, formatTripCode, formatItems } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("estado");

  const actor = await prisma.actor.findUnique({ where: { id: auth.actorId } });

  const filter: any = {};
  if (actor?.type === "warehouse") filter.warehouseActorId = auth.actorId;
  else if (actor?.type === "relief") filter.reliefActorId = auth.actorId;
  else if (actor?.type === "transporter") filter.transporterActorId = auth.actorId;
  if (status) filter.status = status;

  const shipments = await prisma.shipment.findMany({
    where: filter,
    include: {
      warehouseActor: { select: { id: true, name: true, address: true, whatsapp: true, lat: true, lng: true } },
      reliefActor: { select: { id: true, name: true, address: true, whatsapp: true, lat: true, lng: true } },
      transporterActor: { select: { id: true, name: true, whatsapp: true } },
      shipmentItem: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const mapped = shipments.map((s) => ({
    id: s.id,
    codigoViaje: s.notes?.startsWith("VIA-") ? s.notes.split(" ")[0] : s.id.slice(-8).toUpperCase(),
    almacen: s.warehouseActor,
    centroAyuda: s.reliefActor,
    transportista: s.transporterActor,
    insumos: s.shipmentItem,
    estado: s.status,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));

  return Response.json(mapped);
}

export async function POST(req: NextRequest) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  try {
    const { warehouseActorId, reliefActorId, items, requestId } = await req.json();

    const codigo = `VIA-${Date.now().toString(36).toUpperCase().slice(-5)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    const shipment = await prisma.$transaction(async (tx) => {
      const created = await tx.shipment.create({
        data: {
          createdByUserId: auth.userId,
          warehouseActorId,
          reliefActorId,
          requestId: requestId || null,
          status: "proposed",
          notes: `${codigo} ${requestId ? `Req:${requestId}` : ""}`,
          shipmentItem: {
            create: items.map((i: any) => ({
              supplyId: i.supplyId || null,
              category: i.category || "general",
              name: i.name,
              unit: i.unit || "unidad",
              quantity: i.quantity,
            })),
          },
        },
        include: { shipmentItem: true, warehouseActor: true, reliefActor: true },
      });

      if (requestId) {
        const request = await tx.request.findUnique({ where: { id: requestId } });
        if (request && request.status === "open") {
          const shipped = items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);
          const remaining = request.quantity - shipped;
          await tx.request.update({
            where: { id: requestId },
            data: {
              quantity: Math.max(remaining, 0),
              quantityFulfilled: { increment: shipped },
              status: remaining <= 0 ? "in_progress" : undefined,
            },
          });
        }
      }

      for (const item of items) {
        if (item.supplyId) {
          await tx.supply.update({
            where: { id: item.supplyId },
            data: {
              quantity: { decrement: item.quantity },
              quantityReserved: { increment: item.quantity },
            },
          });
        }
      }

      return created;
    }, { isolationLevel: "Serializable" });

    await publishEvent("viaje.creado", {
      shipmentId: shipment.id,
      warehouseActorId,
      reliefActorId,
      items,
      userId: auth.userId,
    });

    const itemsStr = formatItems(items);
    const wa = shipment.warehouseActor;
    const ra = shipment.reliefActor;

    const msgAlmacen = `Nuevo envio ${codigo} solicitado por ${ra?.name || "Centro de ayuda"}. Insumos: ${itemsStr}. Responde APROBAR para aceptar.`;
    const msgCentro = `Envio ${codigo} coordinado con almacen ${wa?.name || "—"}. Insumos: ${itemsStr}.`;

    if (wa?.whatsapp) await sendWhatsAppMessage(wa.whatsapp, `📦 Nuevo envio generado\nCodigo: ${codigo}\nCentro: ${ra?.name}\nInsumos: ${itemsStr}`);
    await notifyBySms(wa?.phone || wa?.whatsapp, msgAlmacen);

    if (ra?.whatsapp) await sendWhatsAppMessage(ra.whatsapp, `✅ Envio coordinado\nCodigo: ${codigo}\nAlmacen: ${wa?.name}\nInsumos: ${itemsStr}`);
    await notifyBySms(ra?.phone || ra?.whatsapp, msgCentro);

    return Response.json({
      id: shipment.id,
      codigoViaje: codigo,
      estado: shipment.status,
      insumos: shipment.shipmentItem,
      almacen: shipment.warehouseActor,
      centroAyuda: shipment.reliefActor,
    }, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2034") {
      return jsonError(409, "Conflicto: otro usuario está procesando esta solicitud. Intenta de nuevo.");
    }
    return jsonError(500, error.message);
  }
}
