# Project Coding Standards and Guidelines

This file outlines the rules and conventions for AI agents and developers working on the **Logistic Center** project.

## Code Standards
- **Language**: All new code, interfaces, comments, and documentation must be written in **English**.
- **Framework**: Built with **Next.js (App Router)** and **TypeScript**. Ensure type safety and avoid using `any` where possible.
- **Database**: Database interactions must go through **Prisma ORM**.
- **State Management**: Use React Hooks (`useState`, `useEffect`) and SWR for data fetching on the client side.

## Security and Validation Rules
1. **Input Sanitization**:
   - Every user-submitted text field must be sanitized using utility functions in `lib/validation.ts` to prevent Cross-Site Scripting (XSS) and code injection.
2. **Data Type and Bounds Validation**:
   - Always validate coordinates: Latitude must be in the range `[-90, 90]` and Longitude must be in `[-180, 180]`.
   - Always validate quantities: Quantity fields must be non-negative integers.
3. **Database Constraints Handling**:
   - Ensure all database unique constraint violations (e.g. trying to register an actor with an existing phone or email) are caught and handled gracefully, returning a `400 Bad Request` with a user-friendly error message, instead of throwing an unhandled exception that results in a `500 Internal Server Error`.
4. **Information Disclosure Prevention**:
   - Do not leak internal system structures, database schemas, or stack traces (such as Prisma error messages) in API responses. In production environments, replace detailed DB errors with generic errors.

## Git Workflow
- Create feature branches prefixing with `feature/` or `fix/`.
- Commit messages must be written in English, clearly stating the reason and context of the changes.
