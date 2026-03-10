        // Role selection functionality 
        const API_URL = "https://dolphin-main-production.up.railway.app/api";
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
        
        // Password toggle functionality
        const passwordInput = document.getElementById('password');
        const togglePasswordBtn = document.getElementById('toggle-password');
        const eyeIcon = togglePasswordBtn.querySelector('.eye-icon');
        const eyeSlashIcon = togglePasswordBtn.querySelector('.eye-slash-icon');
        
        togglePasswordBtn.addEventListener('click', () => {
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
        
        // Form submission handler
        const registerForm = document.getElementById('register-form');
        
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const role = selectedRoleInput.value;
            
            if (!name || !email || !password || !role) {
                alert('All fields are required');
                return;
            }
            
            if (password.length < 8) {
                alert('Password must be at least 8 characters long');
                return;
            }
            
            const submitButton = registerForm.querySelector('.btn');
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = 'Creating Account...';
            submitButton.disabled = true;
            
            try {
                // Using fetch directly for standalone compatibility
                const response = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password, role })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Registration failed');
                }

               console.log('✅ Registration Successful');

// --- ADD THIS: Save Token and User Data ---
if (data.token) {
    localStorage.setItem('token', data.token);
}
if (data.user) {
    localStorage.setItem('user', JSON.stringify(data.user));
}
// -------------------------------------------

// Redirect
if (role === 'investor') window.location.href = 'investor-dashboard.html';
                else if (role === 'founder') window.location.href = 'dashboard.html';
                else if (role === 'provider') window.location.href = 'provider-dashboard.html';
                
            } catch (error) {
                console.error('Registration error:', error);
                alert(`Registration failed: ${error.message}`);
            } finally {
                submitButton.textContent = originalButtonText;
                submitButton.disabled = false;
            }
        });