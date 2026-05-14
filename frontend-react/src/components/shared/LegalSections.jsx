/**
 * LegalSections — reusable block for all dashboard Settings pages.
 * Shows Privacy Policy, Terms of Service, Refund Policy, and Support Center
 * as clickable cards that open the full page in a new tab.
 */
export default function LegalSections() {
  const links = [
    {
      href: '/privacy',
      icon: '🔒',
      title: 'Privacy Policy',
      desc: 'How we collect, use, and protect your personal information.',
    },
    {
      href: '/terms',
      icon: '📄',
      title: 'Terms of Service',
      desc: 'Rules and guidelines for using the Dolphin platform.',
    },
    {
      href: '/refund-policy',
      icon: '💳',
      title: 'Refund Policy',
      desc: 'Our no-refund policy for all digital services and subscriptions.',
    },
    {
      href: '/support',
      icon: '🛟',
      title: 'Support Center',
      desc: 'FAQs, contact form, and resources to help you get started.',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {links.map(({ href, icon, title, desc }) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '1rem 1.25rem',
            background: 'var(--bg-surface, white)',
            border: '1px solid var(--border-color, #E5E7EB)',
            borderRadius: 'var(--radius-md, 10px)',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            cursor: 'pointer',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--primary, #84CC16)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border-color, #E5E7EB)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary, #111827)', fontSize: '0.9rem' }}>{title}</p>
            <p style={{ margin: '2px 0 0', color: 'var(--text-secondary, #6B7280)', fontSize: '0.8rem', lineHeight: 1.4 }}>{desc}</p>
          </div>
          {/* External link icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary, #9CA3AF)" strokeWidth="2" style={{ flexShrink: 0 }}>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      ))}
    </div>
  );
}
