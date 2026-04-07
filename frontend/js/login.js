// Initialize Lucide icons
lucide.createIcons();

// ==========================================
// 1. TOAST SYSTEM
// ==========================================
const toastEl = document.getElementById('toast');
let toastTimeout;

function showToast(message, type = 'error') {
    clearTimeout(toastTimeout);
    toastEl.textContent = message;
    toastEl.className = `toast toast-${type} show`;
    toastTimeout = setTimeout(() => {
        toastEl.classList.remove('show');
    }, 4000);
}

// ==========================================
// 2. FIELD VALIDATION HELPERS
// ==========================================
function showFieldError(fieldId, errorId) {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(errorId);
    if (field) field.classList.add('input-error');
    if (error) error.classList.add('visible');
}

function clearFieldError(fieldId, errorId) {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(errorId);
    if (field) field.classList.remove('input-error');
    if (error) error.classList.remove('visible');
}

function clearAllErrors() {
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    document.querySelectorAll('.field-error').forEach(el => el.classList.remove('visible'));
}

// Real-time error clearing on input
['email', 'password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', () => clearFieldError(id, `${id}-error`));
    }
});

// ==========================================
// 3. PASSWORD VISIBILITY TOGGLE
// ==========================================
const togglePassword = document.getElementById('toggle-password');
const passwordInput = document.getElementById('password');
const eyeIcon = togglePassword.querySelector('.eye-icon');
const eyeSlashIcon = togglePassword.querySelector('.eye-slash-icon');

togglePassword.addEventListener('click', function() {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    eyeIcon.style.display = type === 'password' ? 'block' : 'none';
    eyeSlashIcon.style.display = type === 'password' ? 'none' : 'block';
});

// ==========================================
// 4. CLICKJACKING PROTECTION (Enhanced)
// ==========================================
(function enforceFrameProtection() {
    let frameCheckInterval = setInterval(function() {
        if (window.top !== window.self) {
            try {
                window.top.location = window.self.location;
            } catch (e) {
                document.documentElement.innerHTML = '';
            }
        }
    }, 100);

    setTimeout(function() {
        clearInterval(frameCheckInterval);
    }, 10000);
})();

// ==========================================
// 5. FORM SUBMISSION HANDLER (Secured)
// ==========================================
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAllErrors();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // Validation
        let hasError = false;

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            showFieldError('email', 'email-error');
            hasError = true;
        }

        if (!password) {
            showFieldError('password', 'password-error');
            hasError = true;
        }

        if (hasError) return;

        // Frame-busting check before submit
        if (window.top !== window.self) {
            showToast('Security error: Cannot submit from embedded context', 'error');
            return;
        }

        // Loading state
        const originalContent = loginBtn.innerHTML;
        loginBtn.innerHTML = '<span class="btn-spinner"><span class="spinner"></span>Signing In...</span>';
        loginBtn.disabled = true;

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Server Error: ${response.status}`);
            }

            if (!data.user) {
                throw new Error('Invalid server response: missing user data.');
            }

            console.log('✅ Login Successful! User Role:', data.user.role);

            // Clear storage and save fresh user data
            localStorage.clear();
            sessionStorage.clear();
            localStorage.setItem('user', JSON.stringify(data.user));

            showToast('Login successful!', 'success');

            // Role-based redirect
            const role = data.user.role;
            let redirectUrl = 'dashboard.html';

            if (role === 'admin') redirectUrl = 'admin-dashboard.html';
            else if (role === 'investor') redirectUrl = 'investor-dashboard.html';
            else if (role === 'provider') redirectUrl = 'provider-dashboard.html';

            // Brief delay for toast visibility
            setTimeout(() => {
                window.location.replace(redirectUrl + '?t=' + Date.now());
            }, 500);

        } catch (error) {
            console.error('❌ Login error:', error);
            showToast(error.message || 'Login failed. Please try again.', 'error');
        } finally {
            loginBtn.innerHTML = originalContent;
            loginBtn.disabled = false;
        }
    });
}