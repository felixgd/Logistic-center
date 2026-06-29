import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  const since = req.nextUrl.searchParams.get("since");
  const sinceDate = since ? new Date(since) : new Date(Date.now() - 30000);

  const events = await prisma.event_log.findMany({
    where: {
      actorId: auth.actorId,
      eventType: { in: ["insumo.registrado", "solicitud.creada", "viaje.creado"] },
      createdAt: { gte: sinceDate },
    },
    orderBy: { createdAt: "asc" },
  });

  interface EventLog {
    id: string;
    eventType: string;
    createdAt: Date;
    payload: string | null;
  }

  return Response.json(
    (events as EventLog[]).map((e) => ({
      id: e.id,
      eventType: e.eventType,
      createdAt: e.createdAt.toISOString(),
      payload: e.payload ? JSON.parse(e.payload) : null,
    }))
  );
}
