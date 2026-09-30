// Use same-origin requests. Vite proxies these locally, while Vercel forwards
// them to the Render API. This also keeps OAuth/session cookies first-party.
const API = import.meta.env.VITE_API_URL ?? '';
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...init, credentials: 'include', headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers } });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export const apiOrigin = API;
