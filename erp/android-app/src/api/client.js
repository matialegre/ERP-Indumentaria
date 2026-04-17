// API client — conecta al backend ERP en 190.211.201.217:8001
import * as SecureStore from "expo-secure-store";

export const API_BASE = "http://190.211.201.217:8001/api/v1";

async function getToken() {
  try {
    return await SecureStore.getItemAsync("erp_token");
  } catch {
    return null;
  }
}

async function request(endpoint, options = {}) {
  const token = await getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 204) return null;

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const detail = data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
          ? detail.map((d) => d.msg || d.message || JSON.stringify(d)).join("; ")
          : `Error ${res.status}`;
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") throw new Error("Sin respuesta del servidor (timeout)");
    if (err.message === "Network request failed") throw new Error("Sin conexión — verificá tu red");
    throw err;
  }
}

export const api = {
  get: (url) => request(url),
  post: (url, data) => request(url, { method: "POST", body: JSON.stringify(data) }),
  put: (url, data) => request(url, { method: "PUT", body: JSON.stringify(data) }),
  patch: (url, data) =>
    request(url, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  delete: (url) => request(url, { method: "DELETE" }),
};
