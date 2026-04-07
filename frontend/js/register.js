// Initialize Lucide icons
        lucide.createIcons();

        // ==========================================
        // TOAST SYSTEM
        // ==========================================
        const toastEl = document.getElementById('toast');
        let toastTimeout;

        function showToast(message, type = 'error') {
            clearTimeout(toastTimeout);
            toastEl.textContent = message;
            toastEl.className = `toast toast-${type} show`;
            toastTimeout = setTimeout(() => {
                toastEl.classList.remove('show');
            }, 3500);
        }

        // ==========================================
        // FIELD VALIDATION HELPERS
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

        // Real-time error clearing
        ['name', 'email', 'password'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => clearFieldError(id, `${id}-error`));
            }
        });

        // ==========================================
        // ROLE SELECTION
        // ==========================================
        const API_URL = 'https://api.dolphinorg.in/api';
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
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            eyeIcon.style.display = type === 'password' ? 'block' : 'none';
            eyeSlashIcon.style.display = type === 'password' ? 'none' : 'block';
        });

        // ==========================================
        // FORM SUBMISSION
        // ==========================================
        const registerForm = document.getElementById('register-form');
        const submitBtn = document.getElementById('submit-btn');

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAllErrors();

            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const role = selectedRoleInput.value;

            // Validation
            let hasError = false;

            if (!name) {
                showFieldError('name', 'name-error');
                hasError = true;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email || !emailRegex.test(email)) {
                showFieldError('email', 'email-error');
                hasError = true;
            }

            if (!password || password.length < 8) {
                showFieldError('password', 'password-error');
                hasError = true;
            }

            if (hasError) return;

            // Loading state
            const originalContent = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span class="btn-spinner"><span class="spinner"></span>Creating Account...</span>';
            submitBtn.disabled = true;

            try {
                const response = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ name, email, password, role })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Registration failed');
                }

                console.log('✅ Registration Successful');

                // Save ONLY user info; token handled via HttpOnly Cookie
                if (data.user) {
                    localStorage.setItem('user', JSON.stringify(data.user));
                }

                showToast('Account created successfully!', 'success');

                // Redirect after brief delay for toast visibility
                setTimeout(() => {
                    if (role === 'investor') window.location.href = 'investor-dashboard.html';
                    else if (role === 'founder') window.location.href = 'dashboard.html';
                    else if (role === 'provider') window.location.href = 'provider-dashboard.html';
                }, 600);

            } catch (error) {
                console.error('Registration error:', error);
                showToast(error.message || 'Registration failed. Please try again.', 'error');
            } finally {
                submitBtn.innerHTML = originalContent;
                submitBtn.disabled = false;
            }
        });