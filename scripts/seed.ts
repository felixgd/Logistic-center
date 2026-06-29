import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning database...");
  await prisma.shipment_item.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.supply.deleteMany();
  await prisma.request.deleteMany();
  await prisma.actor_user.deleteMany();
  await prisma.affiliate_code.deleteMany();
  await prisma.actor.deleteMany();
  await prisma.user.deleteMany();
  await prisma.phone_verification.deleteMany();

  console.log("Seeding initial development database...");

  // 1. Create a primary dev user
  const user = await prisma.user.create({
    data: {
      name: "Juan Perez",
      phone: "+584121112233",
      phoneVerified: true,
      email: "juan@example.com",
    },
  });

  // 2. Create the Warehouse Actor
  const warehouse = await prisma.actor.create({
    data: {
      userId: user.id,
      type: "warehouse",
      name: "Almacen Central Caracas",
      contactName: "Juan Perez (Coordinador)",
      phone: "+584121112233",
      whatsapp: "584121112233",
      address: "Avenida Urdaneta, Edificio Principal",
      city: "Caracas",
      lat: 10.5050,
      lng: -66.9145,
      verified: true,
    },
  });

  // 3. Create the Relief Center Actor
  const reliefCenter = await prisma.actor.create({
    data: {
      userId: user.id,
      type: "relief",
      name: "Centro de Ayuda Terremoto Cariaco",
      contactName: "Maria Rodriguez",
      phone: "+584249998877",
      whatsapp: "584249998877",
      address: "Plaza Bolivar Cariaco",
      city: "Cariaco",
      lat: 10.4981,
      lng: -63.6686,
      verified: true,
    },
  });

  // 4. Create the Transporter Actor
  const transporter = await prisma.actor.create({
    data: {
      userId: user.id,
      type: "transporter",
      name: "Transportes Logisticos de Oriente",
      contactName: "Carlos Mendoza",
      phone: "+584163334455",
      whatsapp: "584163334455",
      vehicleType: "truck",
      capacityKg: 3500,
      verified: true,
    },
  });

  // 5. Add supplies to the Warehouse
  await prisma.supply.createMany({
    data: [
      {
        userId: user.id,
        actorId: warehouse.id,
        category: "agua",
        name: "Botellas de Agua 1.5L",
        unit: "litros",
        quantity: 1500,
        status: "available",
      },
      {
        userId: user.id,
        actorId: warehouse.id,
        category: "alimentos",
        name: "Lentejas y Granos en lata",
        unit: "unidad",
        quantity: 800,
        status: "available",
      },
      {
        userId: user.id,
        actorId: warehouse.id,
        category: "medicina",
        name: "Kits de Primeros Auxilios",
        unit: "unidad",
        quantity: 150,
        status: "available",
      },
    ],
  });

  // 6. Add requests from the Relief Center
  await prisma.request.createMany({
    data: [
      {
        userId: user.id,
        actorId: reliefCenter.id,
        category: "agua",
        name: "Agua potable para consumo humano",
        unit: "litros",
        quantity: 1000,
        urgency: "alta",
        status: "open",
      },
      {
        userId: user.id,
        actorId: reliefCenter.id,
        category: "alimentos",
        name: "Cajas de raciones secas de alimentos",
        unit: "unidad",
        quantity: 500,
        urgency: "media",
        status: "open",
      },
    ],
  });

  // 7. Add a mock verified code record so phone verification passes locally
  await prisma.phone_verification.create({
    data: {
      phone: "+584121112233",
      code: "000000",
      verified: true,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    },
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
