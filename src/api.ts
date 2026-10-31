import type { UiConfig } from "./config.js";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiClient = {
  get: <T>(path: string) => Promise<T>;
  post: <T>(
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ) => Promise<T>;
  patch: <T>(path: string, body?: unknown) => Promise<T>;
  del: <T>(path: string) => Promise<T>;
};

export function createApiClient(
  config: UiConfig,
  accessToken: string | null,
): ApiClient {
  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    extra?: Record<string, string>,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(extra ?? {}),
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    let payload: string | undefined;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const res = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers,
      body: payload,
    });
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!res.ok) {
      const msg =
        data &&
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof (data as { error?: { message?: string } }).error?.message ===
          "string"
          ? (data as { error: { message: string } }).error.message
          : res.statusText || `HTTP ${res.status}`;
      throw new ApiError(res.status, msg, data);
    }
    return data as T;
  }

  return {
    get: (path) => request("GET", path),
    post: (path, body, headers) => request("POST", path, body, headers),
    patch: (path, body) => request("PATCH", path, body),
    del: (path) => request("DELETE", path),
  };
}
