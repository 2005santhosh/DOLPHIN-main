// ==========================================
// CONFIGURATION
// ==========================================
const API_URL = "https://dolphin-main-production.up.railway.app/api";

// ==========================================
// 1. SECURITY: PREVENT MULTIPLE LOGINS
// ==========================================
// Check immediately if user is already logged in
(function checkExistingSession() {
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('user');

    if (token && userJson) {
        try {
            const user = JSON.parse(userJson);
            // Redirect to the correct dashboard instantly
            const redirectUrl = 
                user.role === 'admin' ? 'admin-dashboard.html' :
                user.role === 'investor' ? 'investor-dashboard.html' :
                user.role === 'provider' ? 'provider-dashboard.html' : 
                'dashboard.html';
            
            window.location.replace(redirectUrl);
        } catch (e) {
            // If data is corrupt, clear it
            localStorage.clear();
        }
    }
})();

// ==========================================
// 2. PASSWORD VISIBILITY TOGGLE (ORIGINAL)
// ==========================================
const togglePassword = document.getElementById('toggle-password');
const passwordInput = document.getElementById('password');

// Ensure elements exist before adding listeners
if (togglePassword && passwordInput) {
    const eyeIcon = togglePassword.querySelector('.eye-icon');
    const eyeSlashIcon = togglePassword.querySelector('.eye-slash-icon');

    togglePassword.addEventListener('click', function() {
        // Toggle the type attribute
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);

        // Toggle the icon visibility
        if (type === 'password') {
            eyeIcon.style.display = 'block';
            eyeSlashIcon.style.display = 'none';
        } else {
            eyeIcon.style.display = 'none';
            eyeSlashIcon.style.display = 'block';
        }
    });
}

// ==========================================
// 3. FORM SUBMISSION HANDLER
// ==========================================
const loginForm = document.getElementById('login-form');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const submitButton = loginForm.querySelector('.btn');
        const originalButtonText = submitButton.textContent;
        
        if (!email || !password) {
            alert('Please enter both email and password');
            return;
        }
        
        submitButton.textContent = 'Signing In...';
        submitButton.disabled = true;

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Server Error: ${response.status}`);
            }

            if (!data.user || !data.token) {
                throw new Error('Invalid server response: missing user data or token.');
            }

            console.log('✅ Login Successful! User Role:', data.user.role);
            
            // --- SECURITY FIX: CLEAN STORAGE & SET ROLE ---
            localStorage.clear(); // Clear old data first
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('userRole', data.user.role); // Used for Auth Guard in HTML
            
            // Redirect based on role
            const redirectUrl = 
                data.user.role === 'admin' ? 'admin-dashboard.html' :
                data.user.role === 'investor' ? 'investor-dashboard.html' :
                data.user.role === 'provider' ? 'provider-dashboard.html' : 
                'dashboard.html';
            
            window.location.href = redirectUrl;

        } catch (error) {
            console.error('❌ Login error:', error);
            submitButton.textContent = originalButtonText;
            submitButton.disabled = false;
            alert(`Login failed: ${error.message}`);
        }
    });
}