import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const supplies = await prisma.supply.findMany({
    where: { status: "available", quantity: { gt: 0 } },
    include: { actor: { select: { id: true, name: true, address: true, whatsapp: true, city: true, lat: true, lng: true } } },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(supplies);
}
