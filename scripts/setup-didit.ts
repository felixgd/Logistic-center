/**
 * Script de configuración de Didit KYC
 *
 * Este script realiza el registro programático en Didit y crea los recursos necesarios.
 *
 * Uso:
 *   1. Configura las variables de entorno DIDIT_EMAIL y DIDIT_PASSWORD
 *   2. Ejecuta: npx tsx scripts/setup-didit.ts
 *
 * Flujo:
 *   1. Registra una cuenta en Didit (POST /auth/v2/programmatic/register/)
 *   2. Te envía un código OTP al email
 *   3. Ingresa el código cuando se te solicite
 *   4. Obtiene la API key
 *   5. Crea un workflow KYC con OCR + LIVENESS + FACE_MATCH + AML
 *   6. Crea un webhook destination
 *
 * Requisitos:
 *   - Node.js 18+
 *   - Un email real y accesible (no @example.com, @test, etc.)
 *   - Una URL pública para el webhook (ngrok en desarrollo)
 */

const DIDIT_AUTH_API = "https://apx.didit.me/auth/v2";
const DIDIT_VERIFICATION_API = "https://verification.didit.me/v3";

interface RegisterResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  organization: { uuid: string; name: string };
  application: { uuid: string; name: string; client_id: string; api_key: string };
}

async function main() {
  const email = process.env.DIDIT_EMAIL;
  const password = process.env.DIDIT_PASSWORD;

  if (!email || !password) {
    console.error("Error: Configura DIDIT_EMAIL y DIDIT_PASSWORD en tu .env");
    console.error("El password debe tener: 8+ chars, mayúscula, minúscula, dígito, carácter especial");
    process.exit(1);
  }

  console.log("\n=== Registro programático en Didit ===\n");

  // Step 1: Register
  console.log("1. Registrando cuenta en Didit...");
  const registerRes = await fetch(`${DIDIT_AUTH_API}/programmatic/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!registerRes.ok) {
    const err = await registerRes.text();
    console.error(`  Error de registro: ${err}`);
    process.exit(1);
  }

  const registerData = await registerRes.json();
  console.log(`  ✅ Registro exitoso. Se ha enviado un código OTP a ${email}`);

  // Step 2: Verify email
  console.log("\n2. Verificando email...");
  const readline = (await import("readline")).default;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const code = await new Promise<string>((resolve) => {
    rl.question("  Ingresa el código OTP de 6 caracteres: ", (answer) => {
      resolve(answer.trim());
    });
  });

  const verifyRes = await fetch(`${DIDIT_AUTH_API}/programmatic/verify-email/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });

  if (!verifyRes.ok) {
    const err = await verifyRes.text();
    console.error(`  Error de verificación: ${err}`);
    rl.close();
    process.exit(1);
  }

  const verifyData: RegisterResult = await verifyRes.json();
  console.log("  ✅ Email verificado");
  console.log(`  📋 API Key: ${verifyData.application.api_key}`);
  console.log(`  📋 Client ID: ${verifyData.application.client_id}`);
  console.log(`  📋 Org UUID: ${verifyData.organization.uuid}`);
  console.log(`  📋 App UUID: ${verifyData.application.uuid}`);

  // Step 3: Create KYC workflow
  // Note: Workflow creation via API may not be available.
  // The user may need to create it via the Didit Console.
  console.log("\n3. Workflow KYC");
  console.log("  Para crear el workflow KYC, ve al Didit Console:");
  console.log("  https://business.didit.me/workflows");
  console.log("  1. Crea un workflow tipo KYC");
  console.log("  2. Agrega OCR, LIVENESS (PASSIVE), FACE_MATCH, AML");
  console.log("  3. Publica el workflow");
  console.log("  4. Copia el Workflow ID (UUID)");

  let workflowId = "";
  const wfRl = readline.createInterface({ input: process.stdin, output: process.stdout });
  workflowId = await new Promise<string>((resolve) => {
    wfRl.question("  Ingresa el Workflow ID del Console: ", (answer) => {
      resolve(answer.trim());
    });
  });
  wfRl.close();

  // Step 4: Create webhook destination
  console.log("\n4. Creando webhook destination...");
  const webhookUrl = process.env.DIDIT_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("  DIDIT_WEBHOOK_URL no está configurado.");
    console.log("  Crea el webhook destination manualmente en:");
    console.log("  https://business.didit.me/api-webhooks");
    console.log("  URL del webhook: tu URL pública + /api/webhooks/didit");
    console.log("  Eventos: status.updated");
  } else {
    const destRes = await fetch(`${DIDIT_VERIFICATION_API}/webhook/destinations/`, {
      method: "POST",
      headers: {
        "x-api-key": verifyData.application.api_key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        label: "Logistic Center KYC",
        url: webhookUrl,
        webhook_version: "v3",
        subscribed_events: ["status.updated"],
      }),
    });

    if (!destRes.ok) {
      const err = await destRes.text();
      console.error(`  Error al crear webhook: ${err}`);
    } else {
      const destData = await destRes.json();
      console.log("  ✅ Webhook destination creado");
      console.log(`  📋 Webhook Secret: ${destData.secret_shared_key || "Revisa el Console"}`);
    }
  }

  // Output final configuration
  console.log("\n\n=== Configuración para .env ===\n");
  console.log(`DIDIT_API_KEY=${verifyData.application.api_key}`);
  console.log(`DIDIT_WORKFLOW_ID=${workflowId}`);
  console.log(`DIDIT_WEBHOOK_SECRET=<webhook_secret_key_del_console>`);

  rl.close();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
