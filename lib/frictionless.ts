import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { sanitizeText } from "@/lib/validation";

interface FrictionlessInput {
  name: string;
  whatsapp: string;
  type: "warehouse" | "relief" | "transporter";
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  vehicleType?: string;
  capacityKg?: number;
}

export async function findOrCreateActor(input: FrictionlessInput) {
  const name = sanitizeText(input.name);
  const whatsapp = sanitizeText(input.whatsapp);
  const type = input.type;
  const address = sanitizeText(input.address);
  const city = sanitizeText(input.city);
  const lat = input.lat;
  const lng = input.lng;
  const vehicleType = sanitizeText(input.vehicleType || "");
  const capacityKg = input.capacityKg;

  // Clean the whatsapp number (remove non-digits or spaces)
  const cleanWhatsapp = whatsapp.replace(/\D/g, "");

  // 1. Check if actor already exists by whatsapp
  let actor = await prisma.actor.findFirst({
    where: { whatsapp: cleanWhatsapp },
    include: { user: true },
  });

  let userId = "";

  if (actor) {
    userId = actor.userId;
    // Update coordinates, address, and city if provided, to keep it current
    actor = await prisma.actor.update({
      where: { id: actor.id },
      data: {
        name, // Allow updating name
        address: address || actor.address,
        city: city || actor.city,
        lat: lat !== null ? lat : actor.lat,
        lng: lng !== null ? lng : actor.lng,
        vehicleType: vehicleType || actor.vehicleType,
        capacityKg: capacityKg !== undefined ? capacityKg : actor.capacityKg,
      },
      include: { user: true },
    });
  } else {
    // 2. Register new user & actor
    const email = `wa_${cleanWhatsapp}_${Date.now().toString(36)}@disaster.acopio`;

    const user = await prisma.user.create({
      data: {
        name,
        email,
      },
    });

    userId = user.id;

    await prisma.account.create({
      data: {
        userId: user.id,
        providerId: "whatsapp_passwordless",
        accountId: email,
      },
    });

    actor = await prisma.actor.create({
      data: {
        userId: user.id,
        type,
        name,
        contactName: name,
        phone: cleanWhatsapp,
        whatsapp: cleanWhatsapp,
        address,
        city,
        lat,
        lng,
        vehicleType: type === "transporter" ? vehicleType || "Camión" : null,
        capacityKg: type === "transporter" ? capacityKg || 500 : null,
      },
      include: { user: true },
    });
  }

  // 3. Sign and return token along with actor details
  const token = signToken({ userId, actorId: actor.id, actorType: actor.type });

  return {
    token,
    actor: {
      id: actor.id,
      type: actor.type,
      name: actor.name,
      whatsapp: actor.whatsapp,
      address: actor.address,
      city: actor.city,
      lat: actor.lat,
      lng: actor.lng,
    },
  };
}
