export function normalizeSupabaseUrl(raw: string): string {
  if (!raw) return '';
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
