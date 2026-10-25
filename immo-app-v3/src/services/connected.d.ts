export interface ApiResult<T> { ok: boolean; status: number; data: T & { detail?: string | object } }
export interface Match { score: number; detail: { critere: string; points: number; max: number; explication: string }[] }
export interface Annonce {
  id_source: string; titre?: string | null; type?: string | null; prix?: number | null;
  surface?: number | null; ville?: string | null; quartier?: string | null; code_postal?: string | null;
  lat?: number | null; lon?: number | null; nb_pieces?: number | null; dpe?: string | null;
  photos?: string[]; description?: string | null; url_source?: string | null;
  jardin?: boolean | null; terrasse?: boolean | null; piscine?: boolean | null; match?: Match;
}
export interface User { id: number; email: string; nom?: string | null; email_verifie: boolean; cree_le?: string }
export interface Credentials { email: string; password: string }
export interface Like { annonce_id: string; type: 'classique' | 'gold'; cree_le: string; annonce: (Omit<Annonce, 'id_source' | 'type' | 'url_source'> & { type_bien?: string; url?: string; source?: string }) | null }
export interface Preview { search_id: string; count: number; prix_min?: number | null; prix_max?: number | null; items?: { type?: string; ville?: string; quartier?: string; surface?: number }[] }
export interface ChatResponse { reply: string; sessionId?: string; require_account?: boolean; complete?: boolean; missing?: string[]; slots?: Record<string, unknown>; suggestions?: string[]; choix?: { type: string; options: string[]; max: number } | null; resultats?: Preview }
export const connected: {
  chat(body: { message: string; sessionId: string; honeypot: string; formTs: number }): Promise<ApiResult<ChatResponse>>;
  results(id: string): Promise<ApiResult<{search_id: string; criteres: Record<string, unknown>; annonces: Annonce[]}>>;
  me(): Promise<ApiResult<User>>;
  login(body: Credentials): Promise<ApiResult<{access_token: string; user: User}>>;
  register(body: Credentials): Promise<ApiResult<{message: string; dev_lien?: string}>>;
  resend(email: string): Promise<ApiResult<{message: string; dev_lien?: string}>>;
  logout(): Promise<ApiResult<{message: string}>>;
  likes(): Promise<ApiResult<Like[]>>;
  like(id: string, type: 'classique' | 'gold'): Promise<ApiResult<unknown>>;
  unlike(id: string): Promise<ApiResult<unknown>>;
};
