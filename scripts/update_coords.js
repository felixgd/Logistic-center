const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Mock coordinates around Bogota, Colombia
const coordinates = {
  warehouse: [
    { lat: 4.711, lng: -74.072 }, // Bogota center/north-west
    { lat: 4.726, lng: -74.035 }, // Bogota north-east
  ],
  relief: [
    { lat: 4.698, lng: -74.058 }, // Bogota north
    { lat: 4.654, lng: -74.062 }, // Bogota chapinero
  ],
  transporter: [
    { lat: 4.724, lng: -74.062 }, // Bogota suba
    { lat: 4.718, lng: -74.041 }, // Bogota usaquen
  ],
};

async function main() {
  const actors = await prisma.actor.findMany();
  console.log(`Found ${actors.length} actors in database.`);

  let counts = { warehouse: 0, relief: 0, transporter: 0 };

  for (const actor of actors) {
    const type = actor.type; // 'warehouse', 'relief', 'transporter'
    const coordsList = coordinates[type] || [];
    const index = counts[type] % coordsList.length;
    const coords = coordsList[index];

    if (coords) {
      await prisma.actor.update({
        where: { id: actor.id },
        data: {
          lat: coords.lat,
          lng: coords.lng,
        },
      });
      console.log(`Updated [${type}] ${actor.name} with coordinates lat: ${coords.lat}, lng: ${coords.lng}`);
      counts[type]++;
    } else {
      console.log(`No coordinates configured for type: ${type}`);
    }
  }

  console.log("Database update completed successfully.");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
