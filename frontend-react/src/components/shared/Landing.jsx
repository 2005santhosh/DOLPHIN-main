import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../styles/landing.css';
import {
  Users, TrendingUp, BarChart2, CheckCircle2, Clock,
  Target, Puzzle, ShieldCheck, Lock, Map, Smartphone,
  Download, Menu, X, Mail, Home, Zap,
} from '../shared/Icons';

const Landing = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [headerFloating, setHeaderFloating] = useState(false);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const deferredPromptRef = useRef(null);

  // Don't redirect from landing page - let users browse
  // Only redirect if they try to access auth pages while logged in

  // Handle logout
  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // PWA Install
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPromptRef.current) return;

    deferredPromptRef.current.prompt();
    const { outcome } = await deferredPromptRef.current.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted A2HS');
    }
    
    deferredPromptRef.current = null;
    setShowInstallButton(false);
  };

  // Header scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setHeaderFloating(window.scrollY > 60);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll reveal
  useEffect(() => {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

    return () => revealObserver.disconnect();
  }, []);

  // Stats animation
  useEffect(() => {
    const animateValue = (element, start, end, duration) => {
      let startTimestamp = null;
      const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.floor(eased * (end - start) + start);
        element.textContent = value.toLocaleString();
        if (progress < 1) window.requestAnimationFrame(step);
      };
      window.requestAnimationFrame(step);
    };

    const statsObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !entry.target.dataset.animated) {
            const statNumber = entry.target.querySelector('.stat-number');
            if (statNumber) {
              const text = statNumber.textContent;
              const number = parseInt(text.replace(/\D/g, ''));
              if (!isNaN(number)) {
                animateValue(statNumber, 0, number, 1800);
                entry.target.dataset.animated = 'true';
              }
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    document.querySelectorAll('.stat-item').forEach((item) => statsObserver.observe(item));

    return () => statsObserver.disconnect();
  }, []);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
    document.body.style.overflow = !mobileMenuOpen ? 'hidden' : '';
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    document.body.style.overflow = '';
  };

  return (
    <div className="landing-page">
      {/* Header */}
      <header id="main-header" className={headerFloating ? 'floating' : ''}>
        <div className="logo">
          <span className="logo-dot"></span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '0.3rem' }}>
            <path d="M21 12c0 1.2-4 6-9 6s-9-4.8-9-6c0-1.2 4-6 9-6s9 4.8 9 6z"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
          Dolphin
        </div>
        <nav className="desktop-nav">
          <a href="#features" className="nav-link">Features</a>
          <a href="#how-it-works" className="nav-link">How It Works</a>
          {showInstallButton && (
            <button id="install-btn" onClick={handleInstallClick} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Download size={15} /> Install
            </button>
          )}
          {isAuthenticated ? (
            <>
              <Link to={
                user?.role === 'founder' ? '/dashboard' :
                user?.role === 'investor' ? '/investor-dashboard' :
                user?.role === 'provider' ? '/provider-dashboard' :
                '/dashboard'
              } className="btn btn-glass">Dashboard</Link>
              <button onClick={handleLogout} className="btn btn-lime">Log Out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-glass">Log In</Link>
              <Link to="/register" className="btn btn-lime">Start Free</Link>
            </>
          )}
        </nav>
        <div className="mobile-nav-right">
          {isAuthenticated ? (
            <Link
              to={
                user?.role === 'founder' ? '/dashboard' :
                user?.role === 'investor' ? '/investor-dashboard' :
                user?.role === 'provider' ? '/provider-dashboard' :
                '/dashboard'
              }
              className="btn btn-glass btn-sm mobile-login-btn"
            >
              Dashboard
            </Link>
          ) : (
            <Link to="/login" className="btn btn-glass btn-sm mobile-login-btn">Log In</Link>
          )}
          <button className="menu-toggle" onClick={toggleMobileMenu} aria-label="Open Menu">
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      <nav className={`mobile-nav ${mobileMenuOpen ? 'active' : ''}`}>
        <div className="mobile-nav-header">
          <div className="logo">
            <span className="logo-dot"></span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '0.3rem' }}>
              <path d="M21 12c0 1.2-4 6-9 6s-9-4.8-9-6c0-1.2 4-6 9-6s9 4.8 9 6z"/>
              <circle cx="12" cy="12" r="2"/>
            </svg>
            Dolphin
          </div>
          <button className="menu-close" onClick={closeMobileMenu} aria-label="Close Menu">
            <X size={22} />
          </button>
        </div>
        <div className="mobile-nav-links">
          <a href="#features" className="mobile-nav-link" onClick={closeMobileMenu} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Smartphone size={17} /> Features
          </a>
          <a href="#how-it-works" className="mobile-nav-link" onClick={closeMobileMenu} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Map size={17} /> How It Works
          </a>
          <Link to="/support" className="mobile-nav-link" onClick={closeMobileMenu} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Mail size={17} /> Support
          </Link>
        </div>
        <div className="mobile-nav-actions">
          {showInstallButton && (
            <button id="install-btn-mobile" onClick={handleInstallClick} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Download size={15} /> Install App
            </button>
          )}
          <Link to="/login" className="btn btn-glass btn-block" onClick={closeMobileMenu}>Log In</Link>
          <Link to="/register" className="btn btn-lime btn-block" onClick={closeMobileMenu}>Get Started Free</Link>
        </div>
      </nav>
      <div className={`overlay ${mobileMenuOpen ? 'active' : ''}`} onClick={closeMobileMenu}></div>

      <main>
        {/* Hero */}
        <section className="hero">
          <div className="hero-glow"></div>
          <div className="hero-glow-2"></div>
          <div className="hero-content">
            <div className="hero-badge">
              <span className="hero-badge-dot"><Zap size={12} /></span>
              Trusted by 50+ Founders
            </div>
            <h1>
              The right connection<br />
              can <span className="lime-text">change everything.</span>
            </h1>
            <p className="hero-desc">
              Find clients, collaborations, and opportunities through meaningful connections.
            </p>
            <div className="hero-cta">
              <Link to="/register" className="btn btn-lime btn-lg magnetic-btn">
                Start Your Journey →
              </Link>
              <a href="#how-it-works" className="btn btn-glass btn-lg">See How It Works</a>
            </div>
          </div>
          <div className="hero-photo-container" id="hero-photo">
            <img src="https://t3.ftcdn.net/jpg/10/71/27/66/360_F_1071276681_8fvfScFZQHgcmPOvVc4Bqb8sWbp85dOH.jpg" alt="Founder working" loading="eager" />
            <div className="hero-photo-overlay"></div>
          </div>
        </section>

        {/* Trust Bar */}
        <div className="trust-bar">
          <div className="trust-scroll">
            <div className="trust-chip stat-item">
              <span className="trust-chip-icon lime-bg"><Users size={16} /></span>
              <span><span className="trust-chip-number stat-number">50</span>+ Founders</span>
            </div>
            <div className="trust-chip stat-item">
              <span className="trust-chip-icon blue-bg"><TrendingUp size={16} /></span>
              <span><span className="trust-chip-number stat-number">2</span>L+ Raised</span>
            </div>
            <div className="trust-chip stat-item">
              <span className="trust-chip-icon white-bg"><BarChart2 size={16} /></span>
              <span><span className="trust-chip-number stat-number">4</span> Stages</span>
            </div>
            <div className="trust-chip stat-item">
              <span className="trust-chip-icon lime-bg"><CheckCircle2 size={16} /></span>
              <span><span className="trust-chip-number stat-number">70</span>%+ Validation</span>
            </div>
            <div className="trust-chip">
              <span className="trust-chip-icon blue-bg"><Clock size={16} /></span>
              <span>3x Faster to PMF</span>
            </div>
          </div>
        </div>

        {/* Connection Line */}
        <div className="connection-line reveal">
          <svg viewBox="0 0 1200 80" preserveAspectRatio="none" fill="none">
            <defs>
              <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#D4FF00" stopOpacity="0" />
                <stop offset="30%" stopColor="#D4FF00" stopOpacity="0.6" />
                <stop offset="70%" stopColor="#2563eb" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path d="M0,40 C200,10 400,70 600,40 C800,10 1000,70 1200,40" stroke="url(#lineGrad)" strokeWidth="1.5" fill="none" filter="url(#glow)" />
          </svg>
        </div>

        {/* Features Bento */}
        <section className="features-section" id="features">
          <div className="section-label reveal">
            <span className="section-label-line"></span>
            Core Capabilities
          </div>
          <h2 className="section-heading reveal reveal-d1">Built for the<br />modern ecosystem</h2>
          <p className="section-sub reveal reveal-d2">Three integrated engines connecting founders, freelancers, and investors to eliminate guesswork from the startup journey.</p>

          <div className="bento-grid">
            <div className="bento-card wide reveal">
              <div className="bento-card-icon lime"><Target size={22} /></div>
              <h3>Validation Engine</h3>
              <p>Stage-gated roadmap with AI-powered verification to ensure product-market fit at every milestone. No more guessing.</p>
              <div className="bento-metric">
                <span className="bento-metric-value">94%</span>
                <span className="bento-metric-label">Accuracy Rate</span>
              </div>
              <div className="bento-card-photo">
                <img src="https://www.getfused.com/wp-content/uploads/Walk-Before-You-Run.png" alt="Data validation" loading="lazy" />
                <div className="bento-card-photo-overlay"></div>
              </div>
            </div>

            <div className="bento-card reveal reveal-d1">
              <div className="bento-card-icon blue"><TrendingUp size={22} /></div>
              <h3>Investor Discovery</h3>
              <p>Curated pipeline connecting VCs with funding-ready startups scoring 70%+ validation.</p>
              <div className="bento-card-visual">
                <div className="mini-avatar"><img src="https://picsum.photos/seed/avatar-inv1/64/64.jpg" alt="Investor" loading="lazy" /></div>
                <div className="mini-avatar"><img src="https://picsum.photos/seed/avatar-inv2/64/64.jpg" alt="Investor" loading="lazy" /></div>
                <div className="mini-avatar"><img src="https://picsum.photos/seed/avatar-inv3/64/64.jpg" alt="Investor" loading="lazy" /></div>
                <div className="mini-badge">+</div>
              </div>
            </div>

            <div className="bento-card reveal reveal-d2">
              <div className="bento-card-icon white"><Puzzle size={22} /></div>
              <h3>Freelancer Marketplace</h3>
              <p>Vetted legal, tech, and design professionals verified for quality and startup-fit. Connect with experts who understand your needs.</p>
              <div className="bento-card-visual">
                <span style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: '100px', background: 'var(--lime-dim)', color: 'var(--lime)', fontWeight: 600 }}>Legal</span>
                <span style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: '100px', background: 'rgba(37,99,235,0.15)', color: '#60a5fa', fontWeight: 600 }}>Tech</span>
                <span style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: '100px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-dim)', fontWeight: 600 }}>Design</span>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="benefits-section">
          <div className="section-label reveal">
            <span className="section-label-line"></span>
            Why Dolphin
          </div>
          <h2 className="section-heading reveal reveal-d1">Stability, scale<br />& absolute trust</h2>
          <p className="section-sub reveal reveal-d2">A state-driven platform designed to de-risk your journey with full transparency.</p>

          <div className="benefits-grid">
            <div className="benefit-card reveal">
              <div className="benefit-card-glow lime"></div>
              <div className="benefit-icon lime"><ShieldCheck size={22} /></div>
              <h3>De-Risked Growth</h3>
              <p>Every milestone is AI-verified and admin-reviewed to protect against data falsification and ensure genuine progress.</p>
            </div>
            <div className="benefit-card reveal reveal-d1">
              <div className="benefit-card-glow blue"></div>
              <div className="benefit-icon blue"><Lock size={22} /></div>
              <h3>Secure Interactions</h3>
              <p>Strict role-based access control and comprehensive interaction tracking ensure trust between all stakeholders.</p>
            </div>
            <div className="benefit-card reveal reveal-d2">
              <div className="benefit-card-glow lime"></div>
              <div className="benefit-icon white"><BarChart2 size={22} /></div>
              <h3>Total Transparency</h3>
              <p>Complete audit trails for every startup profile, keeping all stakeholders aligned on metrics and validation status.</p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="process-section" id="how-it-works">
          <div className="section-label reveal">
            <span className="section-label-line"></span>
            The Roadmap
          </div>
          <h2 className="section-heading reveal reveal-d1">Four stages to<br />validation</h2>
          <p className="section-sub reveal reveal-d2">Our proven framework ensures founder-investor fit and operational excellence.</p>

          <div className="process-scroll">
            <div className="process-card reveal">
              <div className="process-card-number">01</div>
              <h3>Idea Clarity & Problem Validation</h3>
              <p>Define your core thesis and validate the pain point with supporting data. Complete AI-powered assessments to measure idea quality.</p>
            </div>
            <div className="process-connector"><div className="process-connector-line"></div></div>
            <div className="process-card reveal reveal-d1">
              <div className="process-card-number">02</div>
              <h3>Customer Discovery & Interviews</h3>
              <p>Conduct 20+ qualitative interviews to verify solution-market fit with structured frameworks and analysis tools.</p>
            </div>
            <div className="process-connector"><div className="process-connector-line"></div></div>
            <div className="process-card reveal reveal-d2">
              <div className="process-card-number">03</div>
              <h3>MVP Development & Testing</h3>
              <p>Build and test solution hypotheses with early adopters. Track key metrics and iterate based on real user feedback.</p>
            </div>
            <div className="process-connector"><div className="process-connector-line"></div></div>
            <div className="process-card reveal reveal-d3">
              <div className="process-card-number">04</div>
              <h3>Traction & Funding Readiness</h3>
              <p>Achieve measurable traction and finalize pitch-ready financials. Connect with investors seeking validated opportunities.</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="cta-section">
          <div className="cta-card reveal">
            <div className="cta-card-glow"></div>
            <div className="cta-card-grid"></div>
            <div className="cta-content">
              <h2>Ready to validate<br />your idea?</h2>
              <p>Join 50+ founders, freelancers, and investors turning startup dreams into fundable realities.</p>
              <div className="magnetic-btn-wrap">
                <Link to="/register" className="btn btn-lime btn-lg magnetic-btn">
                  Get Started Free →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer>
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="logo"><span className="logo-dot"></span> Dolphin</div>
            <p>The platform for meaningful connections between founders, freelancers, and investors.</p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Mail size={14} /> <a href="mailto:support@pacificdev.in" style={{ color: 'inherit' }}>support@pacificdev.in</a>
            </p>
          </div>
          <div className="footer-col">
            <h4>Platform</h4>
            <ul>
              <li><Link to="/register">For Founders</Link></li>
              <li><Link to="/register">For Investors</Link></li>
              <li><Link to="/register">For Freelancers</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Resources</h4>
            <ul>
              <li><Link to="/support">Support</Link></li>
              <li><Link to="/refund-policy">Refund Policy</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <ul>
              <li><Link to="/privacy">Privacy Policy</Link></li>
              <li><Link to="/terms">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 Dolphin. All rights reserved.</p>
        </div>
      </footer>

        <nav className="bottom-nav">
          <a href="#features" className="bottom-nav-item active" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <Smartphone size={18} />
            <span>Features</span>
          </a>
          <a href="#how-it-works" className="bottom-nav-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <Map size={18} />
            <span>Roadmap</span>
          </a>
          <Link to="/register" className="bottom-nav-item cta-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <Zap size={18} />
            <span>Start</span>
          </Link>
        </nav>
    </div>
  );
};

export default Landing;
