"use client";

export function setCsrfToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("csrfToken", token);
  }
}

export function getCsrfToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("csrfToken");
}

export function clearCsrfToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("csrfToken");
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("csrfToken");
  localStorage.removeItem("actor");
  sessionStorage.clear();
}

export function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const csrfToken = getCsrfToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
  return headers;
}

export async function apiFetch(url: string, options: RequestInit = {}) {
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };
  return fetch(url, { ...options, headers });
}
