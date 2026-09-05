/**
 * Structured console logging so every auth / bill / payment action is traceable
 * during manual QA. Emoji prefixes make the log stream scannable.
 */
type Channel = "auth" | "bill" | "payment" | "data" | "ui";

const ICONS: Record<Channel, string> = {
  auth: "📧",
  bill: "💰",
  payment: "💳",
  data: "🔵",
  ui: "🎨",
};

function stamp(): string {
  return new Date().toISOString().slice(11, 23);
}

export const log = {
  info(channel: Channel, message: string, details?: unknown) {
    console.log(`${ICONS[channel]} [${stamp()}] ${message}`, details ?? "");
  },
  success(message: string, details?: unknown) {
    console.log(`✅ [${stamp()}] ${message}`, details ?? "");
  },
  error(message: string, details?: unknown) {
    console.error(`❌ [${stamp()}] ${message}`, details ?? "");
  },
  warn(message: string, details?: unknown) {
    console.warn(`⚠️ [${stamp()}] ${message}`, details ?? "");
  },
};

/** Times an async call and warns when it takes longer than 2s. */
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const ms = Date.now() - start;
    if (ms > 2000) log.warn(`Slow call: ${label} took ${ms}ms`);
    else log.info("data", `${label} (${ms}ms)`);
    return result;
  } catch (error) {
    log.error(`${label} failed after ${Date.now() - start}ms`, error);
    throw error;
  }
}
