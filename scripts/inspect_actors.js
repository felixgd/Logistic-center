const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const actors = await prisma.actor.findMany();
  console.log(`Found ${actors.length} actors:`);
  actors.forEach(a => {
    console.log(`- [${a.type}] Name: ${a.name}, Address: ${a.address}, Lat: ${a.lat}, Lng: ${a.lng}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
