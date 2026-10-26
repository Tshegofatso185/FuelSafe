"use client";

// Session token used when the browser refuses to store our cookie (e.g. inside
// an embedded preview frame). It lives in memory and, where the browser allows
// it, in sessionStorage so a reload in the same tab keeps the driver signed in.
const STORAGE_KEY = "fuelsafe_session_token";
let memoryToken: string | null = null;

export function setFallbackToken(token: string | null) {
  memoryToken = token;
  try {
    if (token) window.sessionStorage.setItem(STORAGE_KEY, token);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked in frames as well; memory still works.
  }
}

export function getFallbackToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    memoryToken = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    memoryToken = null;
  }
  return memoryToken;
}

/**
 * fetch() for our own API. When a fallback token is held it is sent three
 * ways (Authorization header, X-FuelSafe-Session header, `st` query param)
 * because embedded previews can block cookies and proxies can strip headers.
 * Every request also gets a unique `_` param so no proxy or browser cache can
 * replay an old "signed out" answer.
 */
export function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(input, window.location.href);
  url.searchParams.set("_", `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const headers = new Headers(init.headers);
  const token = getFallbackToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("X-FuelSafe-Session", token);
    url.searchParams.set("st", token);
  }
  if (init.method && init.method !== "GET" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url.toString(), { ...init, headers, credentials: "include", cache: "no-store" });
}
