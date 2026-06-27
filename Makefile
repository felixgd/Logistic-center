.PHONY: dev build up down install db-push db-studio db-seed lint logs

# Entorno
-include .env
export

# Desarrollo
dev:
	npm run dev

build:
	npm run build

# Docker
up:
	docker compose up -d

down:
	docker compose down

# Dependencias
install:
	npm install
	npm run db:generate

# Base de datos
db-push:
	npm run db:push

db-studio:
	npm run db:studio

db-seed:
	npm run db:seed

# Calidad
lint:
	npm run lint

# Logs
logs:
	docker compose logs -f
