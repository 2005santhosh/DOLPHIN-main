import { FileText, Mail, Globe } from '../shared/Icons';
import DolphinLogo from '../shared/DolphinLogo';

export default function TermsOfService() {
  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #E5E7EB' }}>
        <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '0 1.5rem', height: '4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: '#111827' }}>
            <DolphinLogo size={28} textColor="#111827" />
          </a>
          <button onClick={() => window.close()} style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem 1rem', borderRadius: 8 }}
            onMouseEnter={e => e.target.style.color = '#4F46E5'} onMouseLeave={e => e.target.style.color = '#6B7280'}>
            ← Close
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '42rem', margin: '0 auto', padding: '4rem 1.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ width: 64, height: 64, background: '#EEF2FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}><FileText size={28} color="#4F46E5" /></div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 700, color: '#111827', marginBottom: '0.75rem', letterSpacing: '-0.025em' }}>Terms of Service</h1>
          <p style={{ fontSize: '1.125rem', color: '#6B7280', marginBottom: '1rem' }}>Please read these terms carefully before using Dolphin</p>
          <span style={{ display: 'inline-block', padding: '0.375rem 1rem', background: '#EEF2FF', color: '#4F46E5', borderRadius: 9999, fontSize: '0.875rem', fontWeight: 500 }}>Last updated: March 2026</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          <Section title="1. Acceptance of Terms">
            <p>By accessing or using the Dolphin platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the Service.</p>
            <p style={{ marginTop: '0.75rem' }}>These Terms apply to all users of the Service, including founders, investors, service providers, and administrators. We reserve the right to update these Terms at any time, with notice provided through the platform or by email.</p>
          </Section>

          <Section title="2. Description of Service">
            <p>Dolphin is a startup validation and networking platform that:</p>
            <ul style={{ marginTop: '0.75rem' }}>
              <li>Provides AI-powered startup validation through a 5-stage questionnaire system</li>
              <li>Connects validated founders with investors and service providers</li>
              <li>Offers a community feed for sharing updates and opportunities</li>
              <li>Facilitates in-app messaging between connected users</li>
              <li>Awards reward points for completing validation milestones</li>
            </ul>
          </Section>

          <Section title="3. User Accounts">
            <SubSection title="3.1 Registration">
              <p>To use the Service, you must create an account by providing accurate, complete, and current information. You must verify your email address via OTP before accessing the platform.</p>
            </SubSection>
            <SubSection title="3.2 Account Security">
              <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately at <strong>support@pacificdev.in</strong> of any unauthorized use of your account. We are not liable for any loss resulting from unauthorized use of your account.</p>
            </SubSection>
            <SubSection title="3.3 Account Approval">
              <p>All new accounts are subject to admin approval before gaining full platform access. We reserve the right to reject or suspend accounts at our sole discretion.</p>
            </SubSection>
          </Section>

          <Section title="4. User Conduct">
            <p>You agree not to:</p>
            <ul style={{ marginTop: '0.75rem' }}>
              <li>Use the Service for any unlawful purpose or in violation of any applicable laws</li>
              <li>Post false, misleading, or fraudulent information about yourself or your startup</li>
              <li>Impersonate any person or entity, or misrepresent your affiliation</li>
              <li>Harass, abuse, threaten, or intimidate other users</li>
              <li>Upload malicious code, viruses, or any software that could harm the platform</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Scrape, crawl, or systematically extract data from the platform</li>
              <li>Use the Service to send unsolicited commercial communications (spam)</li>
              <li>Circumvent any rate limiting, security, or access control measures</li>
            </ul>
            <p style={{ marginTop: '0.75rem', padding: '0.875rem 1rem', background: '#FEF2F2', borderRadius: 8, borderLeft: '3px solid #EF4444', color: '#991B1B', fontSize: '0.9rem' }}>
              Violation of these conduct rules may result in immediate account suspension or termination without refund.
            </p>
          </Section>

          <Section title="5. Intellectual Property">
            <SubSection title="5.1 Our Content">
              <p>The Service, including its design, features, functionality, and all content created by Dolphin, is owned by Dolphin and protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or create derivative works without our express written permission.</p>
            </SubSection>
            <SubSection title="5.2 Your Content">
              <p>You retain ownership of content you create and post on the platform. By posting content, you grant Dolphin a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content solely for the purpose of operating the Service.</p>
            </SubSection>
          </Section>

          <Section title="6. Validation System">
            <p>The Dolphin validation system uses AI (Gemini) to score startup responses. You acknowledge that:</p>
            <ul style={{ marginTop: '0.75rem' }}>
              <li>Validation scores are generated by AI and are not guarantees of business success</li>
              <li>Scores are based solely on the quality and completeness of your answers</li>
              <li>A score of 70% or above is required to unlock investor and provider access</li>
              <li>You may retake validation stages to improve your score</li>
              <li>Dolphin is not responsible for investment decisions made based on validation scores</li>
            </ul>
          </Section>

          <Section title="7. Connections and Networking">
            <p>Dolphin facilitates introductions between users but is not a party to any agreements, transactions, or relationships formed through the platform. We are not responsible for:</p>
            <ul style={{ marginTop: '0.75rem' }}>
              <li>The accuracy of information provided by other users</li>
              <li>The outcome of any business relationship formed through the platform</li>
              <li>Any financial transactions between users</li>
              <li>Any disputes arising between users</li>
            </ul>
          </Section>

          <Section title="8. Termination">
            <SubSection title="8.1 By You">
              <p>You may delete your account at any time through the Settings page. Upon deletion, your data will be removed within 30 days, subject to our data retention policy.</p>
            </SubSection>
            <SubSection title="8.2 By Us">
              <p>We may suspend or terminate your account immediately, without prior notice, if you violate these Terms, engage in fraudulent activity, or if we determine that your continued use poses a risk to other users or the platform.</p>
            </SubSection>
          </Section>

          <Section title="9. Disclaimers">
            <p style={{ padding: '0.875rem 1rem', background: '#FFFBEB', borderRadius: 8, borderLeft: '3px solid #F59E0B', color: '#92400E', fontSize: '0.9rem' }}>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. DOLPHIN DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
            </p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, DOLPHIN SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.</p>
            <p style={{ marginTop: '0.75rem' }}>Our total liability to you for any claims arising from these Terms or your use of the Service shall not exceed the amount you paid to Dolphin in the 12 months preceding the claim.</p>
          </Section>

          <Section title="11. Governing Law">
            <p>These Terms are governed by the laws of India. Any disputes arising from these Terms or your use of the Service shall be subject to the exclusive jurisdiction of the courts located in India.</p>
          </Section>

          <Section title="12. Contact">
            <p>For questions about these Terms, contact us:</p>
            <div style={{ marginTop: '1rem', padding: '1.25rem', background: '#F9FAFB', borderRadius: 12, border: '1px solid #E5E7EB' }}>
              <p><strong>Dolphin Platform — Legal</strong></p>
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
