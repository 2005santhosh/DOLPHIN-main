/**
 * FeaturedBadge — shown on profile cards whose owner is payment-verified.
 * Signals to the viewer that this profile has boosted placement.
 */
export default function FeaturedBadge({ style = {} }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)',
      border: '1px solid #6EE7B7',
      borderRadius: 9999,
      fontSize: '0.68rem',
      fontWeight: 700,
      color: '#065F46',
      letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {/* small star icon */}
      <svg width="9" height="9" viewBox="0 0 24 24" fill="#10B981" stroke="none">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
      Featured
    </span>
  );
}
