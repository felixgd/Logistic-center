import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { generateCsrfToken } from "@/lib/csrf";
import { sanitizeText } from "@/lib/validation";
import { createDiditSession } from "@/lib/didit";

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
  documentNumber?: string;
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
        documentNumber: input.documentNumber || actor.documentNumber,
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
        phone: cleanWhatsapp,
        phoneVerified: true,
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
        documentNumber: input.documentNumber || null,
      },
      include: { user: true },
    });
  }

  // 3. Create Didit session for transporters (skip if already verified or mocked)
  const isKycMocked = process.env.IS_KYC_MOCKED === "true";
  let verificationUrl: string | undefined;
  if (actor.type === "transporter" && actor.diditStatus !== "approved") {
    if (isKycMocked) {
      await prisma.actor.update({
        where: { id: actor.id },
        data: { diditStatus: "approved" },
      });
      actor.diditStatus = "approved";
    } else {
      try {
        const session = await createDiditSession(actor.id, actor.user?.email || undefined);
        verificationUrl = session.url;
        await prisma.actor.update({
          where: { id: actor.id },
          data: { diditSessionId: session.session_id, diditStatus: "pending" },
        });
      } catch (err) {
        console.error("Error creating Didit session:", err);
      }
    }
  }

  // 4. Sign and return token along with actor details
  const csrfToken = generateCsrfToken();
  const token = signToken({ userId, actorId: actor.id, actorType: actor.type, csrfToken, diditStatus: actor.diditStatus });

  return {
    token,
    csrfToken,
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
    verificationUrl,
  };
}
