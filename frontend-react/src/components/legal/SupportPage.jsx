import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LifeBuoy, Mail, MessageCircle, BookOpen, Lock, FileText, CreditCard, CheckCircle2 } from '../shared/Icons';
import DolphinLogo from '../shared/DolphinLogo';

const FAQS = [
  {
    category: 'Getting Started',
    items: [
      { q: 'How do I create a startup profile?', a: 'After logging in as a founder, navigate to "Startup Profile" in the sidebar. Fill in your startup name, problem statement, target users, and industry, then click Save. Your profile will be visible to investors and providers once you reach 70% validation score.' },
      { q: 'What is the validation process?', a: 'Dolphin uses a 5-stage AI-powered validation system: Idea Validation, Problem Definition, Solution Development, Market Validation, and Business Model Validation. Each stage has 10 questions scored by Gemini AI. You need 70% or above to pass each stage and unlock the next.' },
      { q: 'How long does validation take?', a: 'Each stage takes 10–30 minutes to complete. The AI evaluates your answers instantly. You can retake any stage to improve your score. Completing all 5 stages typically takes 2–5 hours spread over multiple sessions.' },
    ],
  },
  {
    category: 'Account & Profile',
    items: [
      { q: 'How do I upload a profile picture?', a: 'Go to Settings → Account Settings. Click on your profile picture or the upload area. Select a JPG or PNG file (max 5MB). Your picture will be uploaded to our secure cloud storage and displayed across the platform.' },
      { q: 'Can I change my role after registration?', a: 'No, your role (founder, investor, or service provider) is set during registration and cannot be changed. If you need a different role, please create a new account with a different email address.' },
      { q: 'How do I delete my account?', a: 'Go to Settings → Danger Zone → Delete Account. Type "DELETE" to confirm. Your account and all associated data will be permanently removed within 30 days. This action cannot be undone.' },
    ],
  },
  {
    category: 'Investors & Providers',
    items: [
      { q: 'Why can\'t I see investors and providers?', a: 'Access to the Investors & Providers section is gated at 70% overall validation score. Complete all 5 validation stages with scores of 70% or above to unlock this feature.' },
      { q: 'How do I send a connection request?', a: 'Navigate to Investors & Providers, find a profile you\'re interested in, and click "Connect." Write a personalized message explaining why you\'d like to connect. The recipient will be notified and can accept or decline.' },
      { q: 'What happens after a connection is accepted?', a: 'Once a connection request is accepted, you can chat directly with the other party through the in-app messaging system. You\'ll also see a "Chat" button on their profile.' },
    ],
  },
  {
    category: 'Posts & Community',
    items: [
      { q: 'What types of posts can I create?', a: 'You can create posts with 4 types: "Needs Service" (looking for a service provider), "Needs Investment" (seeking funding), "Offering Service" (providers advertising services), and "Looking to Invest" (investors seeking opportunities). You can also attach images and videos.' },
      { q: 'How does the feed algorithm work?', a: 'The feed shows all posts from the community. You can filter by "All Posts" to see everything, or "My Posts" to see only your own posts. Posts are sorted by newest first.' },
    ],
  },
  {
    category: 'Reward Points',
    items: [
      { q: 'How do I earn reward points?', a: 'Reward points are earned by completing tasks in the Growth Roadmap (unlocked after completing all 5 validation stages). Each task awards a specific number of points. Points are displayed in the top navigation bar.' },
      { q: 'What can I do with reward points?', a: 'Reward points reflect your engagement and progress on the platform. They are displayed on your profile and may be used for future premium features. Points cannot be converted to cash.' },
    ],
  },
  {
    category: 'Technical Issues',
    items: [
      { q: 'The page is showing a blank screen after login. What should I do?', a: 'Try clearing your browser cache and cookies, then log in again. If the issue persists, try a different browser or incognito mode. Ensure you have a stable internet connection. Contact support if the problem continues.' },
      { q: 'My profile picture is not displaying. How do I fix it?', a: 'Profile pictures are hosted on Cloudinary. If your picture isn\'t showing, try re-uploading it in Settings. Ensure the file is JPG or PNG and under 5MB. Check your internet connection as images require a stable connection to load.' },
      { q: 'I\'m not receiving email notifications. What should I do?', a: 'Check your spam/junk folder for emails from support@pacificdev.in. Add this address to your contacts. Ensure email notifications are enabled in your Settings. If you still don\'t receive emails, contact our support team.' },
    ],
  },
];

export default function SupportPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '', category: 'general' });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || '/api';

  const toggleFaq = (key) => setOpenFaq(prev => prev === key ? null : key);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/support/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to send');
      setSubmitted(true);
    } catch (err) {
      // Show error but still mark as submitted so user knows we tried
      alert(err.message || 'Failed to send message. Please email us directly at support@pacificdev.in');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 64, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #E5E7EB', zIndex: 100, display: 'flex', alignItems: 'center', padding: '0 2rem' }}>
        <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: '#111827', fontWeight: 700, fontSize: '1.25rem' }}>
            <DolphinLogo size={28} textColor="#111827" />
          </a>
          <button
            onClick={() => {
              // Go back to previous page if there is one, otherwise go to home
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/');
              }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
            onMouseEnter={e => e.currentTarget.style.color = '#0D9488'}
            onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}>
            ← Back
          </button>
        </div>
      </nav>

      <div style={{ paddingTop: 64 }}>
        {/* Hero */}
        <div style={{ background: 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)', padding: 'clamp(3rem, 8vw, 5rem) 1rem clamp(2.5rem, 6vw, 4rem)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 300, height: 300, background: 'rgba(255,255,255,0.05)', borderRadius: '50%', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -80, left: -40, width: 250, height: 250, background: 'rgba(255,255,255,0.05)', borderRadius: '50%', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ width: 72, height: 72, background: 'rgba(255,255,255,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <LifeBuoy size={36} color="white" />
            </div>
            <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', fontWeight: 800, color: 'white', marginBottom: '1rem', letterSpacing: '-0.025em' }}>Support Center</h1>
            <p style={{ fontSize: 'clamp(0.95rem, 2.5vw, 1.125rem)', color: 'rgba(255,255,255,0.85)', maxWidth: '36rem', margin: '0 auto 2rem' }}>
              We're here to help. Find answers to common questions or reach out to our team.
            </p>
            {/* Quick contact cards */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', maxWidth: '48rem', margin: '0 auto' }}>
              {[
                { icon: <Mail size={22} color="white" />, label: 'Email Us', value: 'support@pacificdev.in', sub: 'Response in 24h' },
                { icon: <MessageCircle size={22} color="white" />, label: 'Live Chat', value: 'In-app messaging', sub: '9am–6pm IST' },
                { icon: <BookOpen size={22} color="white" />, label: 'Help Center', value: 'FAQs below', sub: 'Guides & tutorials' },
              ].map(({ icon, label, value, sub }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', borderRadius: 12, padding: '1rem 1.25rem', minWidth: 130, flex: '1 1 130px', border: '1px solid rgba(255,255,255,0.2)', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>{icon}</div>
                  <p style={{ color: 'white', fontWeight: 600, margin: '0 0 2px', fontSize: '0.9rem' }}>{label}</p>
                  <p style={{ color: 'rgba(255,255,255,0.75)', margin: 0, fontSize: '0.8rem' }}>{value}</p>
                  <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0, fontSize: '0.75rem' }}>{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem 1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: '2.5rem' }}>
            {/* FAQ */}
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', marginBottom: '0.5rem' }}>Frequently Asked Questions</h2>
              <p style={{ color: '#6B7280', marginBottom: '2rem', fontSize: '0.9rem' }}>Find quick answers to the most common questions.</p>

              {FAQS.map((cat) => (
                <div key={cat.category} style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>{cat.category}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {cat.items.map((item, i) => {
                      const key = `${cat.category}-${i}`;
                      const isOpen = openFaq === key;
                      return (
                        <div key={key} style={{ background: 'white', borderRadius: 10, border: `1px solid ${isOpen ? '#0D9488' : '#E5E7EB'}`, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                          <button onClick={() => toggleFaq(key)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: '0.75rem' }}>
                            <span style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem', lineHeight: 1.4 }}>{item.q}</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isOpen ? '#0D9488' : '#9CA3AF'} strokeWidth="2.5" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                          {isOpen && (
                            <div style={{ padding: '0 1.25rem 1rem', color: '#4B5563', fontSize: '0.875rem', lineHeight: 1.7, borderTop: '1px solid #F3F4F6' }}>
                              <p style={{ margin: '0.75rem 0 0' }}>{item.a}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Contact Form */}
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', marginBottom: '0.5rem' }}>Contact Support</h2>
              <p style={{ color: '#6B7280', marginBottom: '2rem', fontSize: '0.9rem' }}>Can't find your answer? Send us a message and we'll get back to you within 24 hours.</p>

              {submitted ? (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '2.5rem', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                    <CheckCircle2 size={48} color="#059669" />
                  </div>
                  <h3 style={{ color: '#065F46', fontWeight: 700, marginBottom: '0.5rem' }}>Message Sent!</h3>
                  <p style={{ color: '#047857', fontSize: '0.9rem' }}>Thank you for reaching out. Our support team will respond to <strong>{contactForm.email}</strong> within 24 hours. You can also reach us directly at <strong>support@pacificdev.in</strong>.</p>
                  <button onClick={() => setSubmitted(false)} style={{ marginTop: '1.5rem', padding: '0.625rem 1.5rem', background: '#0D9488', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>Full Name *</label>
                      <input required value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} placeholder="John Doe" style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>Email Address *</label>
                      <input required type="email" value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))} placeholder="you@example.com" style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>Category *</label>
                    <select required value={contactForm.category} onChange={e => setContactForm(p => ({ ...p, category: e.target.value }))} style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: 'white' }}>
                      <option value="general">General Inquiry</option>
                      <option value="technical">Technical Issue</option>
                      <option value="billing">Billing & Payments</option>
                      <option value="account">Account & Profile</option>
                      <option value="validation">Validation System</option>
                      <option value="bug">Bug Report</option>
                      <option value="feature">Feature Request</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>Subject *</label>
                    <input required value={contactForm.subject} onChange={e => setContactForm(p => ({ ...p, subject: e.target.value }))} placeholder="Brief description of your issue" style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>Message *</label>
                    <textarea required value={contactForm.message} onChange={e => setContactForm(p => ({ ...p, message: e.target.value }))} placeholder="Please describe your issue in detail. Include any error messages, steps to reproduce, and what you expected to happen." rows={5} style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: '0.875rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  </div>
                  <button type="submit" disabled={sending} style={{ padding: '0.75rem 1.5rem', background: '#0D9488', color: 'white', border: 'none', borderRadius: 8, cursor: sending ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.9rem', transition: 'background 0.2s', opacity: sending ? 0.7 : 1 }}
                    onMouseEnter={e => { if (!sending) e.target.style.background = '#0F766E'; }} onMouseLeave={e => e.target.style.background = '#0D9488'}>
                    {sending ? 'Sending…' : 'Send Message →'}
                  </button>
                  <p style={{ fontSize: '0.78rem', color: '#9CA3AF', margin: 0, textAlign: 'center' }}>We typically respond within 24 hours on business days.</p>
                </form>
              )}

              {/* Additional resources */}
              <div style={{ marginTop: '2rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', marginBottom: '1rem' }}>Other Resources</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[
                    { icon: <Lock size={16} />, label: 'Privacy Policy', href: '/privacy' },
                    { icon: <FileText size={16} />, label: 'Terms of Service', href: '/terms' },
                    { icon: <CreditCard size={16} />, label: 'Refund Policy', href: '/refund-policy' },
                  ].map(({ icon, label, href }) => (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'white', borderRadius: 8, border: '1px solid #E5E7EB', textDecoration: 'none', color: '#374151', fontSize: '0.875rem', fontWeight: 500, transition: 'border-color 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#0D9488'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}>
                      {icon}{label}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" style={{ marginLeft: 'auto' }}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer style={{ borderTop: '1px solid #E5E7EB', padding: '2rem 1.5rem', textAlign: 'center', color: '#9CA3AF', fontSize: '0.875rem' }}>
        <p>© {new Date().getFullYear()} Dolphin. All rights reserved.</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.75rem' }}>
          <a href="/privacy" target="_blank" style={{ color: '#6B7280', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/terms" target="_blank" style={{ color: '#6B7280', textDecoration: 'none' }}>Terms of Service</a>
          <a href="/refund-policy" target="_blank" style={{ color: '#6B7280', textDecoration: 'none' }}>Refund Policy</a>
        </div>
      </footer>
    </div>
  );
}
