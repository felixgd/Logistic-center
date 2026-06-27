import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const requests = await prisma.request.findMany({
    where: { status: "open" },
    include: { actor: { select: { id: true, name: true, address: true, whatsapp: true, city: true, lat: true, lng: true } } },
    orderBy: [{ urgency: "asc" }, { createdAt: "desc" }],
  });
  return Response.json(requests);
}
