// ==========================================
// 1. PASSWORD VISIBILITY TOGGLE
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
// 2. CLICKJACKING PROTECTION (Enhanced)
// ==========================================
(function enforceFrameProtection() {
    // Double-check frame busting on interval (catches late injections)
    let frameCheckInterval = setInterval(function() {
        if (window.top !== window.self) {
            try {
                window.top.location = window.self.location;
            } catch (e) {
                document.documentElement.innerHTML = '';
            }
        }
    }, 100);
    
    // Stop checking after 10 seconds to save resources
    setTimeout(function() {
        clearInterval(frameCheckInterval);
    }, 10000);
    
    // Block window.open from external sources
    const originalOpen = window.open;
    window.open = function() {
        const caller = new Error().stack;
        // Simple heuristic - if called from external script, block
        if (!caller.includes('login.js') && !caller.includes('api.js')) {
            console.warn('Blocked potentially malicious window.open call');
            return null;
        }
        return originalOpen.apply(this, arguments);
    };
})();

// ==========================================
// 3. FORM SUBMISSION HANDLER (Secured)
// ==========================================
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const originalButtonText = loginBtn.textContent;
        
        // Input validation
        if (!email || !password) {
            showError('Please enter both email and password');
            return;
        }
        
        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showError('Please enter a valid email address');
            return;
        }
        
        // Security: Check if we're in an unexpected context
        if (window.top !== window.self) {
            showError('Security error: Cannot submit from embedded context');
            return;
        }
        
        // Disable button and show loading
        loginBtn.textContent = 'Signing In...';
        loginBtn.disabled = true;
        loginBtn.style.opacity = '0.7';

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest' // CSRF indicator
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
            
            // Clear storage and set fresh user data
            localStorage.clear();
            sessionStorage.clear();
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Role-based redirect
            const role = data.user.role;
            let redirectUrl = 'dashboard.html';

            if (role === 'admin') redirectUrl = 'admin-dashboard.html';
            else if (role === 'investor') redirectUrl = 'investor-dashboard.html';
            else if (role === 'provider') redirectUrl = 'provider-dashboard.html';
            
            // Force redirect with cache busting
            window.location.replace(redirectUrl + '?t=' + Date.now());

        } catch (error) {
            console.error('❌ Login error:', error);
            resetButton();
            showError(`Login failed: ${error.message}`);
        }
    });
}

function resetButton() {
    loginBtn.textContent = 'Sign In';
    loginBtn.disabled = false;
    loginBtn.style.opacity = '1';
}

function showError(message) {
    // Remove existing error if any
    const existingError = document.querySelector('.form-error');
    if (existingError) existingError.remove();
    
    // Create error element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'form-error';
    errorDiv.style.cssText = `
        color: #ef4444;
        font-size: 0.875rem;
        margin-top: 0.75rem;
        text-align: center;
        padding: 0.5rem;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 0.375rem;
    `;
    errorDiv.textContent = message;
    
    loginForm.querySelector('.btn').after(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => errorDiv.remove(), 5000);
}