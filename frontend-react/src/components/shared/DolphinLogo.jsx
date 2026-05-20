/**
 * DolphinLogo — official Dolphin brand logo component.
 *
 * Props:
 *   size      — height of the icon in px (default 36)
 *   showText  — show "Dolphin" wordmark beside the icon (default true)
 *   textColor — wordmark color (default '#111827')
 *   light     — use white text, for dark backgrounds
 *   iconOnly  — render only the dolphin icon, no text
 *   className — CSS class on wrapper
 *   style     — inline style on wrapper
 *
 * Files used:
 *   /logo-icon.svg — transparent background, just the dolphin (for navbars, auth pages)
 *   /logo.svg      — black background with DOLPHIN text (for favicon, standalone brand use)
 */
export default function DolphinLogo({
  size = 36,
  showText = true,
  textColor,
  light = false,
  iconOnly = false,
  className = '',
  style = {},
}) {
  const resolvedColor = textColor || (light ? '#FFFFFF' : '#111827');

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(size * 0.2),
        lineHeight: 1,
        textDecoration: 'none',
        ...style,
      }}
    >
      {/* Transparent-background dolphin icon */}
      <img
        src="/logo-icon.svg"
        alt="Dolphin"
        width={Math.round(size * 1.5)}
        height={size}
        style={{
          objectFit: 'contain',
          display: 'block',
          flexShrink: 0,
        }}
      />
      {!iconOnly && showText && (
        <span
          style={{
            fontWeight: 700,
            fontSize: Math.round(size * 0.58),
            color: resolvedColor,
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
          }}
        >
          Dolphin
        </span>
      )}
    </span>
  );
}

/**
 * DolphinIcon — just the dolphin, no text, transparent background.
 * Convenience export for places that only need the icon.
 */
export function DolphinIcon({ size = 36, style = {} }) {
  return (
    <img
      src="/logo-icon.svg"
      alt="Dolphin icon"
      width={Math.round(size * 1.5)}
      height={size}
      style={{ objectFit: 'contain', display: 'block', flexShrink: 0, ...style }}
    />
  );
}
