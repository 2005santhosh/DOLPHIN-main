/**
 * OnboardingTutorial — shown exactly once when a user first opens their dashboard.
 * Uses localStorage key `dolphin_onboarded_<userId>` to track completion.
 * Never shown again after the user dismisses it.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const STEPS = [
  {
    icon: '🏠',
    title: 'Welcome to Dolphin!',
    desc: 'Connect with founders, investors, and service providers. Here\'s a quick tour of what you can do.',
  },
  {
    icon: '📝',
    title: 'Community Posts',
    desc: 'Share updates, opportunities, and ideas in the Posts section. Like, comment, and share posts from everyone in the community.',
  },
  {
    icon: '🤝',
    title: 'Connect with Anyone',
    desc: 'Send connection requests to founders, investors, or providers. Once connected, start a private chat.',
  },
  {
    icon: '💬',
    title: 'Chat & Bubbles',
    desc: 'Chat 1-on-1 with your connections. Join or create Bubbles — group rooms where multiple people can collaborate.',
  },
  {
    icon: '🏆',
    title: 'Streaks & Leaderboard',
    desc: 'Build daily streaks by staying active. Climb the leaderboard and win cash prizes (top 3 across all users win ₹3,000 / ₹2,000 / ₹1,000)!',
  },
  {
    icon: '✅',
    title: 'Get Verified',
    desc: 'Get a verified badge for ₹99/month. Verified profiles get priority in the feed, higher search visibility, and are eligible for leaderboard prizes.',
  },
];

export default function OnboardingTutorial() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user?._id) return;
    const key = `dolphin_onboarded_${user._id}`;
    const done = localStorage.getItem(key);
    if (!done) {
      // Small delay so dashboard renders first
      setTimeout(() => setVisible(true), 800);
    }
  }, [user?._id]);

  const dismiss = () => {
    if (user?._id) {
      localStorage.setItem(`dolphin_onboarded_${user._id}`, '1');
    }
    setVisible(false);
  };

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99998,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: 'white', borderRadius: 20,
        maxWidth: 420, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        overflow: 'hidden',
        animation: 'tutorial-in 0.3s ease',
      }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, padding: '1.25rem 1.5rem 0', justifyContent: 'center' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 24 : 8, height: 8, borderRadius: 9999,
              background: i === step ? '#84CC16' : '#E5E7EB',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem 2rem 2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', lineHeight: 1 }}>{current.icon}</div>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.2rem', fontWeight: 800, color: '#111827' }}>
            {current.title}
          </h2>
          <p style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', color: '#6B7280', lineHeight: 1.6 }}>
            {current.desc}
          </p>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={dismiss}
              style={{
                flex: 1, padding: '0.625rem', background: 'none',
                border: '1px solid #E5E7EB', borderRadius: 10,
                color: '#9CA3AF', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Skip
            </button>
            <button
              onClick={() => {
                if (isLast) dismiss();
                else setStep(s => s + 1);
              }}
              style={{
                flex: 2, padding: '0.625rem',
                background: 'linear-gradient(135deg,#84CC16,#16A34A)',
                border: 'none', borderRadius: 10,
                color: 'white', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              {isLast ? '🎉 Get Started!' : 'Next →'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tutorial-in {
          from { opacity: 0; transform: scale(0.92) translateY(16px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </div>
  );
}
