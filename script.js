// script.js - Unified Auth Script (Login/Register) [FINAL FIXED VERSION]

// ================== UI HELPERS ==================

function switchAuthTab(tab) {
    document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';

    document.getElementById('loginForm').setAttribute('aria-hidden', tab !== 'login');
    document.getElementById('registerForm').setAttribute('aria-hidden', tab !== 'register');

    document.querySelectorAll('.auth-tab').forEach((btn, i) => {
        btn.classList.toggle(
            'active',
            (i === 0 && tab === 'login') || (i === 1 && tab === 'register')
        );
    });

    clearMessages();
}

function toggleOtpLogin() {
    const section = document.getElementById('otpLoginSection');
    const shown = document.getElementById('useOtp').checked;
    section.classList.toggle('active', shown);
    section.setAttribute('aria-hidden', !shown);
}

function moveToNext(current) {
    if (current.value.length === 1) {
        const next = current.nextElementSibling;
        if (next && next.classList.contains('otp-input')) next.focus();
    }
}

function showError(msg) {
    const el = document.getElementById('errorMsg');
    el.textContent = msg;
    el.classList.add('show');
    document.getElementById('successMsg').classList.remove('show');
    setTimeout(() => el.classList.remove('show'), 4000);
}

function showSuccess(msg) {
    const el = document.getElementById('successMsg');
    el.textContent = msg;
    el.classList.add('show');
    document.getElementById('errorMsg').classList.remove('show');
    setTimeout(() => el.classList.remove('show'), 4000);
}

function clearMessages() {
    document.getElementById('errorMsg')?.classList.remove('show');
    document.getElementById('successMsg')?.classList.remove('show');
}

// ================== LOGIN ==================

function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showError('Please enter email and password');
        return;
    }

    showSuccess('Signing in...');

    firebaseAuth
        .signInWithEmailAndPassword(email, password)
        .then(async (cred) => {
            const user = cred.user;

            // 🔥 Fetch Firestore user profile
            const docSnap = await firebaseDB.collection('users').doc(user.uid).get();

            if (!docSnap.exists) {
                throw new Error('User profile not found in database');
            }

            const userData = docSnap.data();

            // ✅ ROLE-BASED CHECK (FIXED)
            const role = userData.role || 'user';
            const isAdmin = role === 'admin';

            // Store session
            localStorage.setItem(
                'user',
                JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    role: role,
                    isAdmin: isAdmin,
                    loggedIn: true,
                })
            );

            showSuccess('Login successful! Redirecting...');

            setTimeout(() => {
                if (isAdmin) {
                    window.location.href = 'admin-dashboard.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
            }, 800);
        })
        .catch((err) => {
            localStorage.removeItem('user');
            showError(err.message || 'Login failed');
        });
}

// ================== REGISTER ==================

function handleRegister() {
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;

    if (!firstName || !lastName || !email || !phone || !password || !confirmPassword) {
        showError('Please fill all fields');
        return;
    }

    if (password !== confirmPassword) {
        showError('Passwords do not match');
        return;
    }

    if (password.length < 8) {
        showError('Password must be at least 8 characters');
        return;
    }

    if (!agreeTerms) {
        showError('Please agree to Terms & Conditions');
        return;
    }

    showSuccess('Creating account...');

    firebaseAuth
        .createUserWithEmailAndPassword(email, password)
        .then(async (cred) => {
            const uid = cred.user.uid;

            // ✅ DEFAULT ROLE = USER
            await firebaseDB.collection('users').doc(uid).set({
                uid,
                firstName,
                lastName,
                email,
                phone,
                role: 'user', // 🔥 IMPORTANT
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            });

            await firebaseAuth.signOut();
            localStorage.removeItem('user');

            showSuccess('Account created successfully! Please login.');
            switchAuthTab('login');

            // Clear fields
            document.getElementById('firstName').value = '';
            document.getElementById('lastName').value = '';
            document.getElementById('regEmail').value = '';
            document.getElementById('regPhone').value = '';
            document.getElementById('regPassword').value = '';
            document.getElementById('regConfirmPassword').value = '';
        })
        .catch((err) => showError(err.message || 'Registration failed'));
}

// ================== PASSWORD STRENGTH ==================

function checkPasswordStrength(input) {
    const bar = document.getElementById('strengthBar');
    if (!bar) return;

    bar.className = 'password-strength-bar';

    if (input.value.length < 8) return;
    if (input.value.length < 12) bar.classList.add('weak');
    else if (input.value.length < 16) bar.classList.add('medium');
    else bar.classList.add('strong');
}

// ================== SESSION MESSAGE ==================

window.addEventListener('load', () => {
    const user = localStorage.getItem('user');
    if (user) {
        const u = JSON.parse(user);
        if (u.loggedIn) {
            showSuccess('Welcome back, ' + (u.email || 'User'));
        }
    }
});
