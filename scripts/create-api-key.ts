/**
 * Script de generación de API keys para comunicación API-a-API.
 *
 * No hay rol admin en el sistema, así que la creación de keys se hace por CLI.
 *
 * Uso:
 *   npm run apikey:create -- "<nombre de la app>" "<propósito>"
 *
 * Ejemplo:
 *   npm run apikey:create -- "App de Donantes" "Leer viajes y eventos"
 *
 * La key en claro se imprime UNA sola vez. En la BD solo se guarda su hash
 * SHA-256; si se pierde, hay que generar otra y revocar la anterior.
 */
import { PrismaClient } from "@prisma/client";
import { generateApiKey, hashApiKey } from "../lib/apikey";

const prisma = new PrismaClient();

async function main() {
  const [name, purpose] = process.argv.slice(2);

  if (!name || !purpose) {
    console.error('Uso: npm run apikey:create -- "<nombre de la app>" "<propósito>"');
    process.exit(1);
  }

  const key = generateApiKey();
  const keyHash = hashApiKey(key);

  const record = await prisma.api_key.create({
    data: { name, purpose, keyHash },
  });

  console.log("\n✅ API key creada. Guárdala ahora — NO se vuelve a mostrar:\n");
  console.log(`   ${key}\n`);
  console.log(`   id:         ${record.id}`);
  console.log(`   trackingId: ${record.trackingId}`);
  console.log(`   name:       ${record.name}`);
  console.log(`   purpose:    ${record.purpose}\n`);
  console.log("Envíala en el header 'x-api-key' junto con el JWT (Authorization: Bearer ...).\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
