import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: params.id },
    include: {
      warehouseActor: { select: { name: true, address: true, whatsapp: true, lat: true, lng: true } },
      reliefActor: { select: { name: true, address: true, whatsapp: true, lat: true, lng: true } },
      transporterActor: { select: { name: true, whatsapp: true } },
      shipmentItem: true,
    },
  });

  if (!shipment) return jsonError(404, "Envío no encontrado");

  const codigo = shipment.notes?.startsWith("VIA-") ? shipment.notes.split(" ")[0] : shipment.id.slice(-8).toUpperCase();

  return Response.json({
    codigoViaje: codigo,
    estado: shipment.status,
    transportista: shipment.transporterActor,
    puntoCarga: { nombre: shipment.warehouseActor.name, direccion: shipment.warehouseActor.address, contacto: shipment.warehouseActor.whatsapp, lat: shipment.warehouseActor.lat, lng: shipment.warehouseActor.lng },
    puntoDescarga: { nombre: shipment.reliefActor.name, direccion: shipment.reliefActor.address, contacto: shipment.reliefActor.whatsapp, lat: shipment.reliefActor.lat, lng: shipment.reliefActor.lng },
    manifiesto: shipment.shipmentItem.map((i) => ({ insumo: i.name, cantidad: i.quantity, unidad: i.unit })),
    createdAt: shipment.createdAt,
  });
}
