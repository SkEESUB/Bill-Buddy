export const AUTHORITATIVE_SUPABASE_PROJECT_ID = "ocajeaytrcakzoxavvvg";
export const AUTHORITATIVE_SUPABASE_URL = "https://ocajeaytrcakzoxavvvg.supabase.co";
export const AUTHORITATIVE_PUBLISHABLE_KEY = "sb_publishable_saQROBUNabTGkLIVL7V5gQ_7LMxhJI9";

export function normalizeSupabaseUrl(raw?: string): string {
  if (!raw) return AUTHORITATIVE_SUPABASE_URL;
  const trimmed = raw.trim().replace(/\/$/, '');

  try {
    const parsed = new URL(trimmed);
    // Return ONLY the origin — strips /rest/v1/ /auth/v1/ etc.
    return parsed.origin;
  } catch {
    // Manual fallback if URL parsing fails
    return trimmed
      .replace(/\/rest\/v1\/?$/, '')
      .replace(/\/auth\/v1\/?$/, '')
      .replace(/\/storage\/v1\/?$/, '');
  }
}

