import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    // 1. Fetch all actors with their coordinates and basic details
    const actors = await prisma.actor.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        address: true,
        city: true,
        lat: true,
        lng: true,
        vehicleType: true,
        capacityKg: true,
        phone: true,
        whatsapp: true,
      },
    });

    // 2. Fetch the 10 most recent supply requests (requests)
    const recentRequests = await prisma.request.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            type: true,
            address: true,
            city: true,
            lat: true,
            lng: true,
          },
        },
      },
    });

    // 3. Fetch the 10 most recent shipments (trips)
    const recentShipments = await prisma.shipment.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        warehouseActor: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            lat: true,
            lng: true,
          },
        },
        reliefActor: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            lat: true,
            lng: true,
          },
        },
        transporterActor: {
          select: {
            id: true,
            name: true,
          },
        },
        shipmentItem: {
          select: {
            id: true,
            name: true,
            quantity: true,
            unit: true,
          },
        },
      },
    });

    // Format the shipments response nicely
    const formattedShipments = recentShipments.map((s) => ({
      id: s.id,
      codigoViaje: s.notes?.startsWith("VIA-") ? s.notes.split(" ")[0] : s.id.slice(-8).toUpperCase(),
      almacen: s.warehouseActor,
      centroAyuda: s.reliefActor,
      transportista: s.transporterActor,
      insumos: s.shipmentItem,
      estado: s.status,
      createdAt: s.createdAt,
    }));

    return Response.json({
      actors,
      recentRequests,
      recentShipments: formattedShipments,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
export const dynamic = "force-dynamic";
