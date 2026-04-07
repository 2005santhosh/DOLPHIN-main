////// Initialize Lucide icons
lucide.createIcons();

// Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('SW Registered'))
            .catch(err => console.log('SW Failed', err));
    });
}

// ==========================================
// PWA INSTALL
// ==========================================
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('install-btn');
    const installBtnMobile = document.getElementById('install-btn-mobile');
    if (installBtn) installBtn.style.display = 'flex';
    if (installBtnMobile) installBtnMobile.style.display = 'flex';
});
const handleInstallClick = () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') console.log('User accepted A2HS');
        deferredPrompt = null;
        const installBtn = document.getElementById('install-btn');
        const installBtnMobile = document.getElementById('install-btn-mobile');
        if (installBtn) installBtn.style.display = 'none';
        if (installBtnMobile) installBtnMobile.style.display = 'none';
    });
};
document.getElementById('install-btn')?.addEventListener('click', handleInstallClick);
document.getElementById('install-btn-mobile')?.addEventListener('click', handleInstallClick);

// ==========================================
// MOBILE MENU
// ==========================================
const menuBtn = document.getElementById('mobile-menu-btn');
const closeBtn = document.getElementById('mobile-close-btn');
const mobileNav = document.getElementById('mobile-nav');
const overlay = document.getElementById('overlay');

function openMenu() {
    mobileNav.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}
function closeMenu() {
    mobileNav.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}
menuBtn.addEventListener('click', openMenu);
closeBtn.addEventListener('click', closeMenu);
overlay.addEventListener('click', closeMenu);
document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', closeMenu);
});

// ==========================================
// LIQUID HEADER MORPH
// ==========================================
const mainHeader = document.getElementById('main-header');
const heroPhoto = document.getElementById('hero-photo');
let lastScroll = 0;

// Detect if desktop layout is active
function isDesktop() {
    return window.innerWidth >= 768;
}

window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    if (scrollY > 60) {
        mainHeader.classList.add('floating');
    } else {
        mainHeader.classList.remove('floating');
    }
    // Parallax hero photo — only on mobile (absolute positioning)
    if (heroPhoto && !isDesktop() && scrollY < window.innerHeight) {
        heroPhoto.style.transform = `translateY(calc(-50% + ${scrollY * 0.12}px))`;
    }
    lastScroll = scrollY;
}, { passive: true });

// Reset photo transform on resize between breakpoints
window.addEventListener('resize', () => {
    if (heroPhoto && isDesktop()) {
        heroPhoto.style.transform = '';
    }
}, { passive: true });

// ==========================================
// MAGNETIC BUTTONS
// ==========================================
document.querySelectorAll('.magnetic-btn').forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translate(0, 0)';
        btn.style.transition = 'transform 0.5s var(--spring)';
        setTimeout(() => { btn.style.transition = ''; }, 500);
    });
});

// ==========================================
// SCROLL REVEAL
// ==========================================
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('active');
    });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ==========================================
// SMOOTH SCROLL
// ==========================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offset = 80;
            const top = target.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    });
});

// ==========================================
// STATS ANIMATION
// ==========================================
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
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
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
}, { threshold: 0.5 });
document.querySelectorAll('.stat-item').forEach(item => statsObserver.observe(item));

// ==========================================
// BOTTOM NAV ACTIVE STATE
// ==========================================
const sections = document.querySelectorAll('section[id]');
const bottomNavItems = document.querySelectorAll('.bottom-nav-item:not(.cta-item)');
const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const id = entry.target.id;
            bottomNavItems.forEach(item => {
                item.classList.toggle('active', item.getAttribute('href') === `#${id}`);
            });
        }
    });
}, { threshold: 0.3 });
sections.forEach(s => sectionObserver.observe(s));