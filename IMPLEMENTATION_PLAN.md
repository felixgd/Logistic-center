# Implementation Plan: Security, QA, and Feature Improvements

This document outlines the step-by-step plan to implement the changes and improvements identified in the Quality Assurance and Security Audit (`qa_testing_report.md`) and the Product/UX Feedback (`product_feedback.md`).

---

## 📅 Roadmap Overview

| Phase | Title | Target Endpoints / Files | Description |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Critical Security & Crash Fixes** | `/api/verificar/enviar`, `/api/actores/register`, `/api/public/submit` | Fix code leaks, database constraint crashes, and generic error boundaries. |
| **Phase 2** | **Strict Validation & Sanitization** | `lib/validation.ts`, `/api/public/submit`, `/api/actores/register` | Implement coordinate validation and numeric bounds checks. |
| **Phase 3** | **Venezuela Location Estandardization** | `lib/locations.ts`, registration/submission pages | Add dropdown structures for Venezuelan states and municipalities. |
| **Phase 4** | **Offline Resilience & UX Polish** | PWA config, simple list view, WhatsApp templates | Ensure high-performance loading under 2G/3G networks and pre-fill SMS/WhatsApp. |

---

## 🛠️ Detailed Tasks & Code Changes

### Phase 1: Critical Security & Crash Fixes

#### 1.1 Secure Verification Code Leak
*   **File:** `app/api/verificar/enviar/route.ts`
*   **Action:** Ensure the verification code is never returned in the JSON response if the environment is production, even if `IS_OTP_MOCKED` is enabled.
*   **Code Change:**
    ```typescript
    const isProduction = process.env.NODE_ENV === "production";
    return Response.json({
      mensaje: mocked ? "Modo de prueba activo" : "Código enviado",
      expiresIn: 600,
      mocked,
      code: (mocked && !isProduction) ? code : undefined,
    });
    ```

#### 1.2 Graceful Handling of Duplicate Registration (Duplicate Phone)
*   **File:** `app/api/actores/register/route.ts`
*   **Action:** Before creating a new user, check if a user with the requested `phone` already exists. Return a friendly `400 Bad Request` instead of letting Prisma crash with a unique constraint failure.
*   **Code Change:**
    ```typescript
    const existingPhone = await prisma.user.findUnique({ where: { phone: targetPhone } });
    if (existingPhone) {
      return jsonError(400, "The phone number is already registered to another account.");
    }
    ```

#### 1.3 Safe Error Boundaries (Info Leak Prevention)
*   **Files:** All files in `app/api/` (specifically register, login, and submit routes).
*   **Action:** Replace `error.message` with a generic message when logging database or system errors to prevent Prisma schema leaks.
*   **Code Change:**
    ```typescript
    } catch (error: any) {
      console.error("API error details:", error);
      return jsonError(500, "An internal server error occurred.");
    }
    ```

---

### Phase 2: Strict Validation & Sanitization

#### 2.1 Coordinate and Boundary Validation
*   **File:** `lib/validation.ts`
*   **Action:** Add validation function for latitude and longitude.
*   **Code:**
    ```typescript
    export function validateCoordinates(lat: unknown, lng: unknown): { valid: boolean; lat: number | null; lng: number | null; error?: string } {
      if (lat === null || lat === undefined || lng === null || lng === undefined) {
        return { valid: true, lat: null, lng: null };
      }
      const numLat = Number(lat);
      const numLng = Number(lng);
      if (isNaN(numLat) || isNaN(numLng)) {
        return { valid: false, lat: null, lng: null, error: "Coordinates must be valid numbers" };
      }
      if (numLat < -90 || numLat > 90) {
        return { valid: false, lat: null, lng: null, error: "Latitude must be between -90 and 90" };
      }
      if (numLng < -180 || numLng > 180) {
        return { valid: false, lat: null, lng: null, error: "Longitude must be between -180 and 180" };
      }
      return { valid: true, lat: numLat, lng: numLng };
    }
    ```
*   **File:** `app/api/public/submit/route.ts` & `app/api/actores/register/route.ts`
*   **Action:** Import and run `validateCoordinates(lat, lng)`. If invalid, return `400 Bad Request`.

---

### Phase 3: Venezuela Location Estandardization

#### 3.1 Pre-defined Location Lists
*   **File:** Create `lib/locations.ts`
*   **Action:** Structure a dictionary mapping Venezuelan states to their respective municipalities.
*   **Example Data Structure:**
    ```typescript
    export const VENEZUELAN_STATES: Record<string, string[]> = {
      "Distrito Capital": ["Libertador"],
      "Miranda": ["Chacao", "Baruta", "Sucre", "El Hatillo", "Plaza", "Zamora", ...],
      "Sucre": ["Bermúdez", "Cajigal", "Sucre", "Valdez", ...],
      // Add other earthquake-affected states (Sucre, Monagas, Nueva Esparta, etc.)
    };
    ```
*   **Pages:** Render these states and municipalities as HTML Select elements in the registration and help-request forms, replacing text inputs to prevent typo fragmentation.

---

### Phase 4: Offline Resilience & UX Polish

#### 4.1 WhatsApp Message Templates
*   **Component:** Update the map cards and list items.
*   **Action:** Format the WhatsApp link to include pre-filled text with cargo, quantity, and urgency details.
*   **Formula:**
    ```typescript
    const text = encodeURIComponent(`Hello, I saw your post on Logistic Central. I want to coordinate the transfer of ${quantity} ${unit} of ${itemName}.`);
    const waUrl = `https://wa.me/${whatsapp}?text=${text}`;
    ```

#### 4.2 Lightweight List View
*   **Page:** `app/page.tsx`
*   **Action:** Provide a toggle button "Switch to List View" (Vista de Lista) that hides the heavy interactive Leaflet map and shows a clean, paginated table of requests and shipments, speeding up load times on slow mobile networks.
