# Logística Acopio

Sistema centralizado de logística para centros de acopio post-desastres.
Plataforma que conecta donantes, centros de acopio, transporte y beneficiarios para gestionar la cadena de suministro humanitaria en tiempo real.

## Stack

- **Framework:** Next.js 14 (App Router)
- **ORM:** Prisma + PostgreSQL (Neon)
- **Autenticación:** JWT
- **Mensajería:** NATS.io (eventos)
- **Infraestructura:** Docker, Vercel

## Requisitos

- Node.js 20+
- Docker Desktop (opcional, para PostgreSQL y NATS local)
- Una cuenta en [Neon](https://neon.tech) (producción)

## Inicio rápido

```bash
# 1. Copiar variables de entorno
cp .env.example .env

# 2. Iniciar dependencias locales (PostgreSQL + NATS)
make up

# 3. Instalar dependencias y generar Prisma Client
make install

# 4. Aplicar esquema de base de datos
make db-push

# 5. (Opcional) Sembrar datos de prueba
make db-seed

# 6. Iniciar servidor de desarrollo
make dev
```

## Uso sin Docker

Si prefieres usar tu propia instancia de PostgreSQL, modifica `DATABASE_URL` en `.env` y omite `make up`.

## Comandos disponibles

| Comando | Descripción |
|---------|-------------|
| `make dev` | Inicia servidor de desarrollo |
| `make build` | Compila para producción |
| `make up` | Levanta PostgreSQL y NATS con Docker |
| `make down` | Detiene contenedores Docker |
| `make install` | Instala dependencias npm y genera Prisma Client |
| `make db-push` | Sincroniza esquema Prisma con la BD |
| `make db-studio` | Abre Prisma Studio |
| `make db-seed` | Ejecuta script de datos de prueba |
| `make lint` | Ejecuta linter |
| `make logs` | Muestra logs de Docker |

## Estructura

```
app/              # Next.js App Router (rutas y API)
  api/            # Endpoints REST
  (rutas)/        # Páginas de la aplicación
components/       # Componentes React
lib/              # Utilidades compartidas
prisma/           # Esquema y migraciones
public/           # Archivos estáticos
scripts/          # Scripts auxiliares
styles/           # Estilos globales
```

## Variables de entorno

Ver `.env.example` para la lista completa. Las principales:

- `DATABASE_URL` — Conexión a PostgreSQL
- `JWT_SECRET` — Secreto para firmar tokens
- `WHATSAPP_API_TOKEN` — Token de API de WhatsApp
- `NATS_URL` — URL del servidor NATS (opcional)

## Licencia

MIT
