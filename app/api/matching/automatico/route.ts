import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError } from "@/lib/auth";
import { publishEvent } from "@/lib/pubsub";

export async function POST(req: NextRequest) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  try {
    const pendientes = await prisma.request.findMany({
      where: { status: "open" },
      include: { actor: { select: { name: true } } },
      orderBy: [{ urgency: "asc" }, { createdAt: "asc" }],
    });

    const resultados: any[] = [];

    for (const r of pendientes) {
      const supplies = await prisma.supply.findMany({
        where: {
          status: "available",
          quantity: { gte: r.quantity },
          name: { contains: r.name, mode: "insensitive" },
        },
        include: { actor: { select: { id: true, name: true } } },
      });

      if (supplies.length > 0) {
        resultados.push({
          requestId: r.id,
          centroAyuda: r.actor.name,
          urgencia: r.urgency,
          categoria: r.category,
          insumo: r.name,
          cantidad: r.quantity,
          almacenes: supplies.map((s) => ({
            almacenId: s.actor.id,
            nombre: s.actor.name,
            supplyId: s.id,
            cantidadDisponible: s.quantity,
          })),
        });
      }
    }

    await publishEvent("matching.automatico.completado", {
      timestamp: new Date().toISOString(),
      solicitudesMatch: resultados.length,
    });

    return Response.json({ totalMatches: resultados.length, matches: resultados });
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
