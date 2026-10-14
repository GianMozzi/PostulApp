export const STATUSES = ["wishlist", "applied", "interview", "technical", "offer", "rejected"] as const;
export type Status = (typeof STATUSES)[number];
export const LABELS: Record<Status, string> = {
  wishlist: "Guardada", applied: "Postulado", interview: "Entrevista",
  technical: "Prueba técnica", offer: "Oferta", rejected: "Rechazado",
};
export interface Application {
  id: number; title: string; company: string; location: string;
  modality: "remote" | "hybrid" | "onsite"; priority: "low" | "medium" | "high";
  status: Status; experience: "junior" | "semi" | "senior" | null;
  technologies: string | null; language: string | null;
  applied_date: string | null; interview_date: string | null;
  contact: string | null; next_step: string | null; notes: string | null;
}
export type Draft = Partial<Application>;
export type Filters = { q?: string; modality?: string; experience?: string; technology?: string; language?: string };

export const tok = {
  get: () => localStorage.getItem("token"),
  set: (t: string) => localStorage.setItem("token", t),
  clear: () => localStorage.removeItem("token"),
};

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(tok.get() ? { Authorization: `Bearer ${tok.get()}` } : {}) },
  });
  if (res.status === 401 && !url.startsWith("/api/auth")) { tok.clear(); location.reload(); }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Error de red");
  return res.status === 204 ? (undefined as T) : res.json();
}
const post = <T>(url: string, body: unknown) => req<T>(url, { method: "POST", body: JSON.stringify(body) });

export const api = {
  login: async (email: string, password: string) => tok.set((await post<{ token: string }>("/api/auth/login", { email, password })).token),
  register: async (name: string, email: string, password: string) =>
    tok.set((await post<{ token: string }>("/api/auth/register", { name, email, password })).token),
  list: (f: Filters = {}) => req<Application[]>(`/api/applications?${new URLSearchParams(Object.entries(f).filter(([, v]) => v) as string[][])}`),
  monthly: () => req<{ m: string; n: number }[]>("/api/applications/stats/monthly"),
  create: (d: Draft) => post<Application>("/api/applications", d),
  update: (id: number, d: Draft) => req<Application>(`/api/applications/${id}`, { method: "PUT", body: JSON.stringify(d) }),
  remove: (id: number) => req<void>(`/api/applications/${id}`, { method: "DELETE" }),
};
