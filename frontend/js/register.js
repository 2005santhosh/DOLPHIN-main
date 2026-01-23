 // UI Toggle Logic for Register Page - Fixed
        document.addEventListener('DOMContentLoaded', function() {
            // Using event delegation for role selection
            document.querySelector('.role-selector').addEventListener('click', function(e) {
                const clickedRole = e.target.closest('.role-card');
                if (clickedRole) {
                    selectRole(clickedRole);
                }
            });
            
            function selectRole(element) {
                // Remove selected class from all role cards
                document.querySelectorAll('.role-card').forEach(card => {
                    card.classList.remove('selected');
                });
                
                // Add selected class to clicked card
                element.classList.add('selected');
                
                // Check the corresponding radio button
                const radioInput = element.querySelector('input[type="radio"]');
                if (radioInput) {
                    radioInput.checked = true;
                }
            }
        });