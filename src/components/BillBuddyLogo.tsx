export function BillBuddyLogo({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="6" width="20" height="14" rx="3" />
      <path d="M2 10h20" />
      <circle cx="16" cy="14" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
