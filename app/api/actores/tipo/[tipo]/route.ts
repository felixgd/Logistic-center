import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError } from "@/lib/auth";

const TIPO_MAP: Record<string, string> = {
  almacen: "warehouse",
  centro_ayuda: "relief",
  transportista: "transporter",
};

export async function GET(req: NextRequest, { params }: { params: { tipo: string } }) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  const dbType = TIPO_MAP[params.tipo];
  if (!dbType) return jsonError(400, "Tipo inválido. Use: almacen, centro_ayuda, transportista");

  const actores = await prisma.actor.findMany({
    where: { type: dbType },
    select: {
      id: true, name: true, contactName: true, phone: true, whatsapp: true,
      address: true, city: true, lat: true, lng: true, vehicleType: true, capacityKg: true,
    },
  });

  return Response.json(actores);
}
