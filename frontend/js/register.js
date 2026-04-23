lucide.createIcons();

const API_URL = 'https://api.dolphinorg.in/api';

// ==========================================
// TOAST
// ==========================================
const toastEl = document.getElementById('toast');
let toastTimeout;
function showToast(message, type = 'error') {
  clearTimeout(toastTimeout);
  toastEl.textContent = message;
  toastEl.className = `toast toast-${type} show`;
  toastTimeout = setTimeout(() => toastEl.classList.remove('show'), 3500);
}

// ==========================================
// FIELD VALIDATION
// ==========================================
function showFieldError(fieldId, errorId) {
  document.getElementById(fieldId)?.classList.add('input-error');
  document.getElementById(errorId)?.classList.add('visible');
}
function clearFieldError(fieldId, errorId) {
  document.getElementById(fieldId)?.classList.remove('input-error');
  document.getElementById(errorId)?.classList.remove('visible');
}
function clearAllErrors() {
  document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
  document.querySelectorAll('.field-error').forEach(el => el.classList.remove('visible'));
}

['name', 'email', 'password'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', () => clearFieldError(id, `${id}-error`));
});

// ==========================================
// ROLE SELECTION
// ==========================================
const roleButtons = document.querySelectorAll('.role-btn');
const selectedRoleInput = document.getElementById('selected-role');
let selectedRole = 'founder';

roleButtons.forEach(button => {
  button.addEventListener('click', () => {
    roleButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    selectedRole = button.dataset.role;
    selectedRoleInput.value = selectedRole;
  });
});

// ==========================================
// PASSWORD TOGGLE
// ==========================================
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('toggle-password');
const eyeIcon = togglePasswordBtn.querySelector('.eye-icon');
const eyeSlashIcon = togglePasswordBtn.querySelector('.eye-slash-icon');

togglePasswordBtn.addEventListener('click', () => {
  const isPassword = passwordInput.getAttribute('type') === 'password';
  passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
  eyeIcon.style.display = isPassword ? 'none' : 'block';
  eyeSlashIcon.style.display = isPassword ? 'block' : 'none';
});

// ==========================================
// OTP MODAL
// ==========================================

// Inject modal HTML into the page (add this to your body in register.html too, if preferred)
function createOtpModal() {
  const existing = document.getElementById('otp-modal');
  if (existing) return;

  const modal = document.createElement('div');
  modal.id = 'otp-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Email verification');
  modal.style.cssText = `
    display:none; position:fixed; inset:0; z-index:9999;
    background:rgba(0,0,0,0.5); align-items:center; justify-content:center;
  `;
  modal.innerHTML = `
    <div style="background:var(--color-background-primary,#fff);border-radius:16px;
                padding:2rem 1.75rem;width:360px;max-width:92vw;text-align:center;
                border:0.5px solid rgba(0,0,0,0.1);">
      <div style="width:48px;height:48px;border-radius:50%;background:#E6F1FB;
                  margin:0 auto 1rem;display:flex;align-items:center;justify-content:center;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#185FA5"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
      </div>
      <h2 style="font-size:18px;font-weight:500;margin:0 0 6px;">Check your email</h2>
      <p style="font-size:13px;color:#666;margin:0 0 1.5rem;line-height:1.5;">
        We sent a 6-digit code to<br><strong id="otp-email-display"></strong>
      </p>

      <div id="otp-boxes" style="display:flex;gap:8px;justify-content:center;margin-bottom:1.25rem;">
        ${[0,1,2,3,4,5].map(() => `
          <input type="text" maxlength="1" inputmode="numeric"
            style="width:44px;height:52px;text-align:center;font-size:22px;font-weight:500;
                   border:0.5px solid #ccc;border-radius:8px;outline:none;
                   background:var(--color-background-secondary,#f5f5f5);
                   color:var(--color-text-primary,#1a1a1a);" />
        `).join('')}
      </div>

      <div id="otp-error-msg" style="display:none;color:#c0392b;font-size:13px;margin-bottom:12px;"></div>

      <p id="otp-timer" style="font-size:13px;color:#666;margin:0 0 12px;"></p>

      <button id="otp-verify-btn"
        style="width:100%;padding:11px;font-size:15px;font-weight:500;background:#1a1a1a;
               color:#fff;border:none;border-radius:8px;cursor:pointer;margin-bottom:1rem;">
        Verify email
      </button>

      <p style="font-size:13px;color:#666;">
        Didn't receive it?
        <button id="otp-resend-btn"
          style="background:none;border:none;color:#185FA5;font-weight:500;
                 font-size:13px;cursor:pointer;padding:0;display:inline;">
          Resend code
        </button>
      </p>
    </div>
  `;
  document.body.appendChild(modal);
}

let otpEmail = '';
let otpTimerInterval = null;

function showOtpModal(email) {
  otpEmail = email;
  createOtpModal();

  const modal = document.getElementById('otp-modal');
  modal.style.display = 'flex';
  document.getElementById('otp-email-display').textContent = email;
  document.getElementById('otp-error-msg').style.display = 'none';

  // Clear boxes
  document.querySelectorAll('#otp-boxes input').forEach(b => {
    b.value = '';
    b.style.borderColor = '#ccc';
  });
  document.querySelectorAll('#otp-boxes input')[0].focus();

  startOtpTimer(10 * 60);
  wireOtpBoxes(); // ← no argument needed anymore

  document.getElementById('otp-verify-btn').onclick = () => submitOtp(); // ← no argument
  document.getElementById('otp-resend-btn').onclick = () => resendOtp();
}

function wireOtpBoxes() {
  const boxes = document.querySelectorAll('#otp-boxes input');
  
  boxes.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/[^0-9]/g, '');
      if (inp.value && i < 5) boxes[i + 1].focus();
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !inp.value && i > 0) boxes[i - 1].focus();
    });
    inp.addEventListener('paste', e => {
      const paste = (e.clipboardData || window.clipboardData)
        .getData('text').replace(/\D/g, '').slice(0, 6);
      if (paste.length === 6) {
        boxes.forEach((b, j) => b.value = paste[j] || '');
        boxes[5].focus();
        e.preventDefault();
      }
    });
  });
}
function startOtpTimer(seconds) {
  clearInterval(otpTimerInterval);
  const timerEl = document.getElementById('otp-timer');
  let remaining = seconds;

  function tick() {
    const m = String(Math.floor(remaining / 60)).padStart(2, '0');
    const s = String(remaining % 60).padStart(2, '0');
    if (timerEl) {
      timerEl.innerHTML = remaining > 0
        ? `Code expires in <strong>${m}:${s}</strong>`
        : '<span style="color:#c0392b">Code expired — please resend</span>';
    }
    if (remaining <= 0) clearInterval(otpTimerInterval);
    remaining--;
  }
  tick();
  otpTimerInterval = setInterval(tick, 1000);
}

async function submitOtp(boxes) {
  const boxes = document.querySelectorAll('#otp-boxes input'); // ← query fresh, not from parameter
  const otp = Array.from(boxes).map(b => b.value).join('');
  const errorEl = document.getElementById('otp-error-msg');

  if (otp.length < 6 || otp.split('').some(d => d === '')) {
    errorEl.textContent = 'Please enter all 6 digits.';
    errorEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('otp-verify-btn');
  btn.textContent = 'Verifying...';
  btn.disabled = true;
  errorEl.style.display = 'none';

  try {
    const res = await fetch(`${API_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: otpEmail, otp })
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.message || 'Invalid OTP. Please try again.';
      errorEl.style.display = 'block';
      return;
    }

    // Save user info; token is in HttpOnly cookie
    if (data.user) localStorage.setItem('user', JSON.stringify(data.user));

    clearInterval(otpTimerInterval);
    showToast('Email verified! Welcome to Dolphin 🎉', 'success');

    const role = data.user?.role;
    setTimeout(() => {
      if (role === 'investor') window.location.href = 'investor-dashboard.html';
      else if (role === 'founder') window.location.href = 'dashboard.html';
      else if (role === 'provider') window.location.href = 'provider-dashboard.html';
      else window.location.href = 'dashboard.html';
    }, 800);

  } catch (err) {
    errorEl.textContent = 'Network error. Please try again.';
    errorEl.style.display = 'block';
  } finally {
    btn.textContent = 'Verify email';
    btn.disabled = false;
  }
}

async function resendOtp() {
  const btn = document.getElementById('otp-resend-btn');
  btn.textContent = 'Sending...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_URL}/auth/send-verification-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: otpEmail })
    });

    if (res.ok) {
      showToast('New code sent!', 'success');
      startOtpTimer(10 * 60);
      const boxes = document.querySelectorAll('#otp-boxes input');
      boxes.forEach(b => b.value = '');
      if (boxes[0]) boxes[0].focus();
    } else {
      showToast('Could not resend. Please try again.', 'error');
    }
  } catch {
    showToast('Network error.', 'error');
  } finally {
    btn.textContent = 'Resend code';
    btn.disabled = false;
  }
}

// ==========================================
// FORM SUBMISSION — now triggers OTP flow
// ==========================================
const registerForm = document.getElementById('register-form');
const submitBtn = document.getElementById('submit-btn');

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAllErrors();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  let hasError = false;
  if (!name) { showFieldError('name', 'name-error'); hasError = true; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError('email', 'email-error'); hasError = true;
  }
  if (!password || password.length < 8) { showFieldError('password', 'password-error'); hasError = true; }
  if (hasError) return;

  const originalContent = submitBtn.innerHTML;
  submitBtn.innerHTML = '<span class="btn-spinner"><span class="spinner"></span>Sending OTP...</span>';
  submitBtn.disabled = true;

  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role: selectedRole })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');

    showToast('OTP sent to your email!', 'success');
    showOtpModal(data.email || email);

  } catch (error) {
    showToast(error.message || 'Registration failed. Please try again.', 'error');
  } finally {
    submitBtn.innerHTML = originalContent;
    submitBtn.disabled = false;
  }
});