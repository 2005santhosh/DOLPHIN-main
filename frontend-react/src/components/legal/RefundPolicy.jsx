export default function RefundPolicy() {
  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #E5E7EB' }}>
        <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '0 1.5rem', height: '4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: '#111827' }}>
            <span style={{ fontSize: '1.5rem' }}>🐬</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>Dolphin</span>
          </a>
          <button onClick={() => window.close()} style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem 1rem', borderRadius: 8 }}
            onMouseEnter={e => e.target.style.color = '#4F46E5'} onMouseLeave={e => e.target.style.color = '#6B7280'}>
            ← Close
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '42rem', margin: '0 auto', padding: '4rem 1.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ width: 64, height: 64, background: '#FEF2F2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '1.75rem' }}>💳</div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 700, color: '#111827', marginBottom: '0.75rem', letterSpacing: '-0.025em' }}>Refund Policy</h1>
          <p style={{ fontSize: '1.125rem', color: '#6B7280', marginBottom: '1rem' }}>Our policy on payments, subscriptions, and refunds</p>
          <span style={{ display: 'inline-block', padding: '0.375rem 1rem', background: '#EEF2FF', color: '#4F46E5', borderRadius: 9999, fontSize: '0.875rem', fontWeight: 500 }}>Last updated: March 2026</span>
        </div>

        {/* No Refund Banner */}
        <div style={{ padding: '1.25rem 1.5rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, marginBottom: '2.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>⚠️</span>
          <div>
            <p style={{ fontWeight: 700, color: '#991B1B', fontSize: '1rem', margin: '0 0 0.25rem' }}>No Refund Policy</p>
            <p style={{ color: '#B91C1C', fontSize: '0.9rem', margin: 0, lineHeight: 1.6 }}>
              All payments made to Dolphin are <strong>final and non-refundable</strong>. By completing a purchase or subscription, you acknowledge and agree to this no-refund policy.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          <Section title="1. Overview">
            <p>This Refund Policy governs all financial transactions on the Dolphin platform. Dolphin provides a digital service — a startup validation and networking platform — and as such, all fees paid are for access to digital services that are delivered immediately upon payment.</p>
            <p style={{ marginTop: '0.75rem' }}>By making any payment on the Dolphin platform, you expressly acknowledge that you have read, understood, and agreed to this Refund Policy in its entirety.</p>
          </Section>

          <Section title="2. No Refund Policy">
            <p style={{ padding: '1rem 1.25rem', background: '#FEF2F2', borderRadius: 8, borderLeft: '4px solid #EF4444', color: '#7F1D1D', fontWeight: 500, lineHeight: 1.7 }}>
              ALL FEES PAID TO DOLPHIN ARE STRICTLY NON-REFUNDABLE. THIS INCLUDES, WITHOUT LIMITATION:
            </p>
            <ul style={{ marginTop: '1rem' }}>
              <li><strong>Subscription fees</strong> — monthly, quarterly, or annual plans</li>
              <li><strong>One-time access fees</strong> — for premium features or content</li>
              <li><strong>Upgrade fees</strong> — for moving to a higher tier plan</li>
              <li><strong>Add-on purchases</strong> — for additional features or services</li>
              <li><strong>Partial period fees</strong> — if you cancel mid-subscription period</li>
            </ul>
            <p style={{ marginTop: '1rem' }}>This policy applies regardless of:</p>
            <ul style={{ marginTop: '0.5rem' }}>
              <li>Whether you have used the service or not</li>
              <li>The reason for cancellation or dissatisfaction</li>
              <li>The duration of your subscription</li>
              <li>Technical issues on your end (device, internet connection, etc.)</li>
            </ul>
          </Section>

          <Section title="3. Rationale for No-Refund Policy">
            <p>Dolphin's no-refund policy exists because:</p>
            <ul style={{ marginTop: '0.75rem' }}>
              <li><strong>Immediate Digital Delivery:</strong> Upon payment, you immediately gain access to our platform, AI validation tools, and networking features. The service is delivered instantly and cannot be "returned."</li>
              <li><strong>Infrastructure Costs:</strong> Your payment covers ongoing server costs, AI processing (Gemini API), cloud storage (Cloudinary), and database hosting that are incurred immediately.</li>
              <li><strong>Platform Access:</strong> Access to validated startup profiles, investor connections, and provider networks is granted immediately and cannot be revoked retroactively.</li>
              <li><strong>AI Validation Processing:</strong> Each validation submission consumes AI processing resources that are non-recoverable.</li>
            </ul>
          </Section>

          <Section title="4. Exceptions">
            <p>We may, at our sole and absolute discretion, consider exceptions in the following extremely limited circumstances:</p>
            <ul style={{ marginTop: '0.75rem' }}>
              <li><strong>Duplicate Charges:</strong> If you were charged twice for the same transaction due to a technical error on our payment processor's side, we will refund the duplicate charge after verification.</li>
              <li><strong>Unauthorized Transactions:</strong> If you can demonstrate that a payment was made without your authorization and you report it within 48 hours of the transaction, we will investigate and may issue a refund if fraud is confirmed.</li>
            </ul>
            <p style={{ marginTop: '0.75rem', padding: '0.875rem 1rem', background: '#FFFBEB', borderRadius: 8, borderLeft: '3px solid #F59E0B', color: '#92400E', fontSize: '0.9rem' }}>
              <strong>Important:</strong> Dissatisfaction with the service, change of mind, or failure to use the service does not qualify as an exception to this policy.
            </p>
          </Section>

          <Section title="5. Subscription Cancellation">
            <p>You may cancel your subscription at any time through the Settings page of your dashboard. Upon cancellation:</p>
            <ul style={{ marginTop: '0.75rem' }}>
              <li>Your subscription will remain active until the end of the current billing period</li>
              <li>You will not be charged for subsequent billing periods</li>
              <li><strong>No refund will be issued for the remaining days of the current billing period</strong></li>
              <li>Your account data will be retained for 30 days after cancellation before deletion</li>
            </ul>
          </Section>

          <Section title="6. Account Termination by Dolphin">
            <p>If Dolphin terminates your account due to a violation of our Terms of Service:</p>
            <ul style={{ marginTop: '0.75rem' }}>
              <li>No refund will be issued for any remaining subscription period</li>
              <li>You forfeit all reward points and platform credits</li>
              <li>You may not create a new account without express written permission from Dolphin</li>
            </ul>
          </Section>

          <Section title="7. Chargebacks">
            <p>If you initiate a chargeback or payment dispute with your bank or credit card company without first contacting us, we reserve the right to:</p>
            <ul style={{ marginTop: '0.75rem' }}>
              <li>Immediately suspend or terminate your account</li>
              <li>Dispute the chargeback with supporting documentation</li>
              <li>Pursue recovery of the disputed amount plus any fees incurred</li>
              <li>Report the dispute to credit bureaus where applicable</li>
            </ul>
            <p style={{ marginTop: '0.75rem' }}>We strongly encourage you to contact us at <strong>support@pacificdev.in</strong> before initiating any payment dispute.</p>
          </Section>

          <Section title="8. How to Request a Review">
            <p>If you believe you qualify for an exception under Section 4, you must:</p>
            <ol style={{ marginTop: '0.75rem' }}>
              <li>Contact us within <strong>48 hours</strong> of the transaction</li>
              <li>Email <strong>support@pacificdev.in</strong> with subject line: "Refund Review Request - [Your Account Email]"</li>
              <li>Provide your transaction ID, account email, and a detailed explanation</li>
              <li>Include any supporting evidence (screenshots, bank statements)</li>
            </ol>
            <p style={{ marginTop: '0.75rem' }}>We will review your request within 5–7 business days and respond with our decision. Our decision is final.</p>
          </Section>

          <Section title="9. Currency and Taxes">
            <p>All prices are displayed in Indian Rupees (INR) unless otherwise stated. You are responsible for any applicable taxes, duties, or levies imposed by your local jurisdiction. Dolphin is not responsible for currency conversion fees charged by your bank or payment provider.</p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>Dolphin reserves the right to modify this Refund Policy at any time. Changes will be effective immediately upon posting to the platform. Your continued use of the Service after any changes constitutes acceptance of the new policy. We recommend reviewing this policy periodically.</p>
          </Section>

          <Section title="11. Contact Us">
            <p>For billing inquiries or to request a refund review:</p>
            <div style={{ marginTop: '1rem', padding: '1.25rem', background: '#F9FAFB', borderRadius: 12, border: '1px solid #E5E7EB' }}>
              <p><strong>Dolphin Platform — Billing</strong></p>
              <p style={{ marginTop: '0.5rem' }}>📧 Email: <a href="mailto:support@pacificdev.in" style={{ color: '#4F46E5' }}>support@pacificdev.in</a></p>
              <p style={{ marginTop: '0.25rem' }}>⏱ Response time: 5–7 business days</p>
              <p style={{ marginTop: '0.25rem' }}>🌐 Website: <a href="https://dolphinorg.in" style={{ color: '#4F46E5' }}>dolphinorg.in</a></p>
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
