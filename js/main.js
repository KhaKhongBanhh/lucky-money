document.addEventListener('DOMContentLoaded', function() {
    const customerNameInput = document.getElementById('customerName');
    const continueBtn = document.getElementById('continueBtn');
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    const adminModal = document.getElementById('adminModal');
    const adminLoginForm = document.getElementById('adminLoginForm');
    const closeModal = document.querySelector('.close');
    const loginError = document.getElementById('loginError');

    // Continue button - redirect to spinner page
    continueBtn.addEventListener('click', function() {
        const name = customerNameInput.value.trim();
        if (name === '') {
            alert('Vui lòng nhập họ tên của bạn!');
            customerNameInput.focus();
            return;
        }
        
        // Save name to sessionStorage and redirect
        sessionStorage.setItem('playerName', name);
        window.location.href = 'spinner.html';
    });

    // Enter key support
    customerNameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            continueBtn.click();
        }
    });

    // Open admin modal
    adminLoginBtn.addEventListener('click', function() {
        adminModal.classList.add('show');
    });

    // Close modal
    closeModal.addEventListener('click', function() {
        adminModal.classList.remove('show');
        loginError.textContent = '';
    });

    // Close modal when clicking outside
    adminModal.addEventListener('click', function(e) {
        if (e.target === adminModal) {
            adminModal.classList.remove('show');
            loginError.textContent = '';
        }
    });

    // Admin login
    adminLoginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('adminEmail').value;
        const password = document.getElementById('adminPassword').value;
        
        try {
            await auth.signInWithEmailAndPassword(email, password);
            window.location.href = 'admin.html';
        } catch (error) {
            console.error('Login error:', error);
            
            // Hiển thị thông báo lỗi chi tiết
            let errorMessage = '';
            switch (error.code) {
                case 'auth/operation-not-allowed':
                    errorMessage = 'Đăng nhập Email/Password chưa được bật. Vui lòng liên hệ admin!';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'Email không tồn tại!';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Mật khẩu không đúng!';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Email không hợp lệ!';
                    break;
                case 'auth/invalid-credential':
                    errorMessage = 'Email hoặc mật khẩu không đúng!';
                    break;
                default:
                    errorMessage = 'Đăng nhập thất bại! Vui lòng thử lại.';
            }
            loginError.textContent = errorMessage;
        }
    });

    // Check if already logged in
    auth.onAuthStateChanged(function(user) {
        if (user) {
            // User is signed in, could redirect to admin
            console.log('User logged in:', user.email);
        }
    });
});
