/**
 * UPI deep-link handoff.
 *
 * We build a standards-compatible `upi://pay` request from real bill data and
 * hand it to the operating system. On Android the OS resolves the intent and
 * shows every installed UPI-compatible app (GPay, PhonePe, Paytm, BHIM, …).
 *
 * IMPORTANT — WEB LIMITATIONS (documented, not faked):
 *  - A browser/PWA cannot enumerate installed Android applications, so this app
 *    never claims a specific app is installed. It offers a single
 *    "Choose UPI App" handoff and lets Android pick.
 *  - A browser cannot receive the UPI response callback, so payment status is
 *    never known to us. The user confirms manually afterwards.
 *  - Desktop browsers and iOS Safari generally cannot resolve `upi://` at all.
 *  - App-picker behaviour, package-targeted intents and payment-result
 *    callbacks REQUIRE a native Android shell (Capacitor / React Native) using
 *    an Android Intent with ACTION_VIEW + the `upi://pay` URI.
 *
 * SECURITY: we never collect a UPI PIN, bank password, card PIN or CVV.
 * The PIN is entered only inside the user's own UPI app.
 */

export type UpiRequest = {
  /** Payee VPA, e.g. "acme@okhdfcbank". */
  payeeVpa: string;
  /** Payee display name. */
  payeeName: string;
  /** Amount in rupees. */
  amount: number;
  /** Short transaction note shown inside the UPI app. */
  note?: string;
  /** Merchant / bill reference id. */
  reference?: string;
};

/** A UPI VPA looks like `handle@provider`. */
export function isValidUpiId(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(value.trim());
}

/** Builds a safely-encoded `upi://pay?...` URI from real bill values. */
export function buildUpiUri({ payeeVpa, payeeName, amount, note, reference }: UpiRequest): string {
  const params = new URLSearchParams();
  params.set("pa", payeeVpa.trim());
  params.set("pn", payeeName.trim().slice(0, 50));
  params.set("am", amount.toFixed(2));
  params.set("cu", "INR");
  if (reference) params.set("tr", reference.replace(/[^a-zA-Z0-9]/g, "").slice(0, 35));
  if (note) params.set("tn", note.trim().slice(0, 50));
  // URLSearchParams encodes spaces as "+"; UPI apps expect %20.
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}

/** True when the current runtime can plausibly resolve a `upi://` intent. */
export function canHandoffUpi(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

/** True for any mobile browser (iOS may still work with some apps). */
export function isMobileRuntime(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Hands the URI to the OS. Uses a same-tab location assignment, which is what
 * Android needs to fire the intent chooser.
 */
export function openUpiApp(uri: string): void {
  if (typeof window === "undefined") return;
  window.location.href = uri;
}
