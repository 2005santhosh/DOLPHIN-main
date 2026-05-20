import { Lock, Mail, Globe } from '../shared/Icons';

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #E5E7EB' }}>
        <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '0 1.5rem', height: '4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: '#111827' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12c0 1.2-4 6-9 6s-9-4.8-9-6c0-1.2 4-6 9-6s9 4.8 9 6z"/><circle cx="12" cy="12" r="2"/></svg>
            <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>Dolphin</span>
          </a>
          <button onClick={() => window.close()} style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem 1rem', borderRadius: 8, transition: 'color 0.2s' }}
            onMouseEnter={e => e.target.style.color = '#4F46E5'} onMouseLeave={e => e.target.style.color = '#6B7280'}>
            ← Close
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '42rem', margin: '0 auto', padding: '4rem 1.5rem' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ width: 64, height: 64, background: '#EEF2FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}><Lock size={28} color="#4F46E5" /></div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 700, color: '#111827', marginBottom: '0.75rem', letterSpacing: '-0.025em' }}>Privacy Policy</h1>
          <p style={{ fontSize: '1.125rem', color: '#6B7280', marginBottom: '1rem' }}>How we collect, use, and protect your information</p>
          <span style={{ display: 'inline-block', padding: '0.375rem 1rem', background: '#EEF2FF', color: '#4F46E5', borderRadius: 9999, fontSize: '0.875rem', fontWeight: 500 }}>Last updated: March 2026</span>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          <Section title="1. Introduction">
            <p>Dolphin ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform — a startup validation and networking service connecting founders, investors, and service providers.</p>
            <p style={{ marginTop: '0.75rem' }}>By using Dolphin, you agree to the collection and use of information in accordance with this policy. If you do not agree, please discontinue use of our services.</p>
          </Section>

          <Section title="2. Information We Collect">
            <SubSection title="2.1 Information You Provide">
              <ul>
                <li><strong>Account Information:</strong> Name, email address, password, and role (founder, investor, or service provider)</li>
                <li><strong>Profile Information:</strong> Profile picture, bio, company details, expertise, and professional background</li>
                <li><strong>Startup Information:</strong> Business name, problem statement, target users, industry, and validation responses</li>
                <li><strong>Communications:</strong> Messages sent through our in-app chat system</li>
                <li><strong>Content:</strong> Posts, media uploads, and other content you create on the platform</li>
              </ul>
            </SubSection>
            <SubSection title="2.2 Information Collected Automatically">
              <ul>
                <li><strong>Usage Data:</strong> Pages visited, features used, time spent, and interaction patterns</li>
                <li><strong>Device Information:</strong> IP address, browser type, operating system, and device identifiers</li>
                <li><strong>Cookies:</strong> Session tokens and authentication cookies for secure login</li>
              </ul>
            </SubSection>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul style={{ marginTop: '0.75rem' }}>
              <li>Provide, operate, and maintain the Dolphin platform</li>
              <li>Process your registration and manage your account</li>
              <li>Facilitate connections between founders, investors, and service providers</li>
              <li>Send transactional emails (OTP verification, password resets, notifications)</li>
              <li>Improve our AI-powered validation scoring system</li>
              <li>Detect and prevent fraud, abuse, and security incidents</li>
              <li>Comply with legal obligations</li>
              <li>Respond to your support requests and inquiries</li>
            </ul>
            <p style={{ marginTop: '0.75rem', padding: '0.875rem 1rem', background: '#F0FDF4', borderRadius: 8, borderLeft: '3px solid #10B981', color: '#065F46', fontSize: '0.9rem' }}>
              <strong>We do not sell, rent, or trade your personal data to third parties for marketing purposes.</strong>
            </p>
          </Section>

          <Section title="4. Data Sharing and Disclosure">
            <p>We may share your information in the following limited circumstances:</p>
            <ul style={{ marginTop: '0.75rem' }}>
              <li><strong>With Other Users:</strong> Profile information visible to other platform users as part of the networking features (e.g., your name and profile picture when you send a connection request)</li>
              <li><strong>Service Providers:</strong> Third-party vendors who assist us in operating the platform (e.g., Cloudinary for image storage, MongoDB Atlas for database hosting). These parties are bound by confidentiality agreements.</li>
              <li><strong>Legal Requirements:</strong> When required by law, court order, or governmental authority</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets, with prior notice to you</li>
              <li><strong>Safety:</strong> To protect the rights, property, or safety of Dolphin, our users, or the public</li>
            </ul>
          </Section>

          <Section title="5. Data Security">
            <p>We implement industry-standard security measures to protect your data:</p>
            <ul style={{ marginTop: '0.75rem' }}>
              <li>JWT-based authentication with 30-day token expiration</li>
              <li>HttpOnly cookies to prevent XSS attacks</li>
              <li>bcrypt password hashing (12 rounds)</li>
              <li>HTTPS encryption for all data in transit</li>
              <li>Rate limiting to prevent brute-force attacks</li>
              <li>MongoDB Atlas with encryption at rest</li>
            </ul>
            <p style={{ marginTop: '0.75rem' }}>Despite these measures, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security.</p>
          </Section>

          <Section title="6. Data Retention">
            <p>We retain your personal data for as long as your account is active or as needed to provide services. Specifically:</p>
            <ul style={{ marginTop: '0.75rem' }}>
              <li><strong>Account Data:</strong> Retained until you delete your account</li>
              <li><strong>Messages:</strong> Retained for the duration of the connection between users</li>
              <li><strong>Posts and Content:</strong> Retained until you delete them or your account</li>
              <li><strong>Audit Logs:</strong> Retained for 12 months for security purposes</li>
            </ul>
            <p style={{ marginTop: '0.75rem' }}>Upon account deletion, we will delete or anonymize your personal data within 30 days, except where retention is required by law.</p>
          </Section>

          <Section title="7. Your Rights">
            <p>Depending on your location, you may have the following rights:</p>
            <ul style={{ marginTop: '0.75rem' }}>
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong>Correction:</strong> Update or correct inaccurate personal data</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data ("right to be forgotten")</li>
              <li><strong>Portability:</strong> Receive your data in a structured, machine-readable format</li>
              <li><strong>Objection:</strong> Object to certain types of processing</li>
              <li><strong>Withdrawal of Consent:</strong> Withdraw consent at any time where processing is based on consent</li>
            </ul>
            <p style={{ marginTop: '0.75rem' }}>To exercise any of these rights, contact us at <strong>support@pacificdev.in</strong>. We will respond within 30 days.</p>
          </Section>

          <Section title="8. Cookies">
            <p>We use the following types of cookies:</p>
            <ul style={{ marginTop: '0.75rem' }}>
              <li><strong>Essential Cookies:</strong> Required for authentication and security (HttpOnly session cookies)</li>
              <li><strong>Functional Cookies:</strong> Remember your preferences and settings</li>
            </ul>
            <p style={{ marginTop: '0.75rem' }}>We do not use advertising or tracking cookies. You can control cookies through your browser settings, but disabling essential cookies may affect platform functionality.</p>
          </Section>

          <Section title="9. Children's Privacy">
            <p>Dolphin is not intended for users under the age of 18. We do not knowingly collect personal information from children. If we become aware that a child under 18 has provided us with personal information, we will delete it immediately.</p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by email or through a prominent notice on the platform. Your continued use of Dolphin after changes become effective constitutes acceptance of the updated policy.</p>
          </Section>

          <Section title="11. Contact Us">
            <p>If you have questions about this Privacy Policy or our data practices, please contact us:</p>
            <div style={{ marginTop: '1rem', padding: '1.25rem', background: '#F9FAFB', borderRadius: 12, border: '1px solid #E5E7EB' }}>
              <p><strong>Dolphin Platform</strong></p>
              <p style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Mail size={14} /> Email: <a href="mailto:support@pacificdev.in" style={{ color: '#4F46E5' }}>support@pacificdev.in</a></p>
              <p style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Globe size={14} /> Website: <a href="https://dolphinorg.in" style={{ color: '#4F46E5' }}>dolphinorg.in</a></p>
            </div>
          </Section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #E5E7EB' }}>{title}</h2>
      <div style={{ color: '#4B5563', lineHeight: 1.75, fontSize: '0.9375rem' }}>{children}</div>
    </section>
  );
}

function SubSection({ title, children }) {
  return (
    <div style={{ marginTop: '1rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>{title}</h3>
      <div style={{ color: '#4B5563', lineHeight: 1.75 }}>{children}</div>
    </div>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: '1px solid #E5E7EB', padding: '2rem 1.5rem', textAlign: 'center', color: '#9CA3AF', fontSize: '0.875rem' }}>
      <p>© {new Date().getFullYear()} Dolphin. All rights reserved.</p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.75rem' }}>
        <a href="/privacy" target="_blank" style={{ color: '#6B7280', textDecoration: 'none' }}>Privacy Policy</a>
        <a href="/terms" target="_blank" style={{ color: '#6B7280', textDecoration: 'none' }}>Terms of Service</a>
        <a href="/refund-policy" target="_blank" style={{ color: '#6B7280', textDecoration: 'none' }}>Refund Policy</a>
        <a href="/support" target="_blank" style={{ color: '#6B7280', textDecoration: 'none' }}>Support</a>
      </div>
    </footer>
  );
}
