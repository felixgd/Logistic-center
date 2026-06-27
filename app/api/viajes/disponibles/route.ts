import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const shipments = await prisma.shipment.findMany({
    where: { status: "proposed", transporterActorId: null },
    include: {
      warehouseActor: { select: { id: true, name: true, address: true, whatsapp: true, city: true, lat: true, lng: true } },
      reliefActor: { select: { id: true, name: true, address: true, whatsapp: true, city: true, lat: true, lng: true } },
      shipmentItem: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const mapped = shipments.map((s) => ({
    id: s.id,
    codigoViaje: s.notes?.startsWith("VIA-") ? s.notes.split(" ")[0] : s.id.slice(-8).toUpperCase(),
    almacen: s.warehouseActor,
    centroAyuda: s.reliefActor,
    insumos: s.shipmentItem,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));

  return Response.json(mapped);
}
