# Migraciones de Base de Datos

Este directorio contiene las migraciones SQL para PostgreSQL.

## Uso

### Aplicar la migración inicial

```bash
psql -U tu_usuario -d tu_base_de_datos -f migrations/001_initial_schema.sql
```

O usando la variable `DATABASE_URL`:

```bash
psql $DATABASE_URL -f migrations/001_initial_schema.sql
```

### Notas

- Las tablas siguen el esquema definido en `prisma/schema.prisma`.
- El proyecto utiliza Prisma como ORM. Si prefieres usar las migraciones nativas de Prisma, ejecuta:

  ```bash
  npx prisma migrate dev
  ```

- Las claves foráneas usan `ON DELETE CASCADE` o `SET NULL` según el modelo de datos.
