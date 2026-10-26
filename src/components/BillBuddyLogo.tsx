/**
 * BillBuddy Official Branding Components
 * Derived directly from the official mascot artwork and wordmark.
 */

export function BillBuddyLogo({
  size = 24,
  className = "",
  alt = "BillBuddy Mascot",
}: {
  size?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src="/billbuddy-icon.png"
      alt={alt}
      width={size}
      height={size}
      className={`shrink-0 object-contain select-none ${className}`}
      loading="lazy"
      decoding="async"
    />
  );
}

export function BillBuddyWordmark({
  className = "",
  alt = "BillBuddy — build by Eesub labs",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src="/billbuddy-logo.png"
      alt={alt}
      className={`h-auto max-w-full object-contain select-none ${className}`}
      loading="lazy"
      decoding="async"
    />
  );
}
