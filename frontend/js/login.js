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
            if (type === 'password') {
                eyeIcon.style.display = 'block';
                eyeSlashIcon.style.display = 'none';
            } else {
                eyeIcon.style.display = 'none';
                eyeSlashIcon.style.display = 'block';
            }
        });

       // login.html <script>

// ==========================================
// 1. PASSWORD VISIBILITY TOGGLE (Keep your existing code)
// ==========================================
// ... (your existing toggle code) ...

// ==========================================
// 2. FORM SUBMISSION HANDLER (FIXED FOR MOBILE)
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
                // CRITICAL: Allows the browser to set the HttpOnly Cookie
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
            
            // =======================================================
            // CRITICAL FIX FOR MOBILE CACHING ISSUES
            // =======================================================
            
            // 1. Nuclear clear of all storage
            localStorage.clear();
            sessionStorage.clear();
            
            // 2. Set the fresh user data
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // 3. Determine Redirect
            const role = data.user.role;
            let redirectUrl = 'dashboard.html'; // Default

            if (role === 'admin') redirectUrl = 'admin-dashboard.html';
            else if (role === 'investor') redirectUrl = 'investor-dashboard.html';
            else if (role === 'provider') redirectUrl = 'provider-dashboard.html';
            // Founder is default
            
            // 4. Force Redirect with Cache Busting
            // Using 'replace' prevents the user from going back to the login page
            // The timestamp forces the browser to treat it as a new URL, bypassing cache
            window.location.replace(redirectUrl + '?t=' + Date.now());

        } catch (error) {
            console.error('❌ Login error:', error);
            submitButton.textContent = originalButtonText;
            submitButton.disabled = false;
            alert(`Login failed: ${error.message}`);
        }
    });
}
//window.location.href = redirectUrl + '?v=' + Date.now();