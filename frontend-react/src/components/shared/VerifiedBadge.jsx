/**
 * VerifiedBadge — standalone component, no dependencies.
 * Import this directly instead of from VerificationModal to avoid circular deps.
 */
export default function VerifiedBadge({ size = 16, style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', ...style }}
      aria-label="Verified"
    >
      <circle cx="12" cy="12" r="12" fill="#84CC16" />
      <polyline
        points="7 12 10.5 15.5 17 9"
        fill="none"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
