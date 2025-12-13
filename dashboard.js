// dashboard.js - FULL UPDATED VERSION (USER DASHBOARD)

// ===============================
// Global State
// ===============================
let currentUser = null;

// ===============================
// Helper Functions
// ===============================
function showError(msg) {
    console.error("ERROR:", msg);
    alert("Error: " + msg);
}

function showSuccess(msg) {
    console.log("SUCCESS:", msg);
    alert(msg);
}

function timeAgo(date) {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

// ===============================
// Navigation / Tabs
// ===============================
function switchTab(tabName, navItem) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    const tab = document.getElementById(tabName);
    if (tab) tab.style.display = 'block';

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    if (navItem) navItem.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===============================
// Complaint Card UI
// ===============================
function createComplaintElement(id, data) {
    const wrapper = document.createElement('div');
    wrapper.className = 'complaint-item';
    wrapper.dataset.status = (data.status || 'pending').toLowerCase();

    const ts = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();

    wrapper.innerHTML = `
        <div>
            <div style="display:flex;gap:10px;margin-bottom:6px;">
                <span style="color:#00d4ff;font-weight:600;">
                    #${id.slice(0,6).toUpperCase()}
                </span>
                <span style="font-size:11px;background:rgba(0,212,255,.15);
                    padding:2px 6px;border-radius:4px;">
                    ${data.category || 'General'}
                </span>
            </div>

            <div class="complaint-title">${data.title || '(No title)'}</div>
            <div class="complaint-desc">${data.description || ''}</div>

            <div class="complaint-meta">
                📍 ${data.location || 'N/A'} |
                🕒 ${timeAgo(ts)} |
                📌 ${(data.status || 'pending').toUpperCase()}
            </div>
        </div>
    `;
    return wrapper;
}

// ===============================
// USER DASHBOARD STATS (USER ONLY)
// ===============================
function loadComplaintStats() {
    const grid = document.querySelector('.stats-grid');
    if (!grid || !window.firebaseDB || !currentUser) return;

    grid.innerHTML = '<p style="padding:20px;">Loading stats…</p>';

    firebaseDB
        .collection('complaints')
        .where('authorId', '==', currentUser.uid)
        .onSnapshot(snapshot => {
            let total = 0;
            let pending = 0;
            let inProgress = 0;
            let resolved = 0;

            snapshot.forEach(doc => {
                total++;
                const s = (doc.data().status || 'pending').toLowerCase();
                if (s === 'resolved') resolved++;
                else if (s === 'in-progress') inProgress++;
                else pending++;
            });

            const rate = total ? Math.round((resolved / total) * 100) : 0;

            grid.innerHTML = `
                <div class="stat-card">
                    <div class="stat-label">📤 Total</div>
                    <div class="stat-value">${total}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">⏳ Pending</div>
                    <div class="stat-value">${pending}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">🛠 In Progress</div>
                    <div class="stat-value">${inProgress}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">✅ Resolved</div>
                    <div class="stat-value">${resolved}</div>
                    <div class="stat-change">${rate}% success</div>
                </div>
            `;
        }, err => {
            console.error(err);
            grid.innerHTML = '<p style="color:red;padding:20px;">Failed to load stats</p>';
        });
}

// ===============================
// Recent Complaints (USER ONLY – NO INDEX REQUIRED)
// ===============================
function loadRecentComplaints() {
    const el = document.getElementById('recentComplaintsList');
    if (!el || !window.firebaseDB || !currentUser) return;

    el.innerHTML = '<p>Loading recent complaints…</p>';

    firebaseDB
        .collection('complaints')
        .where('authorId', '==', currentUser.uid)
        .limit(5)
        .onSnapshot(snapshot => {
            el.innerHTML = '';

            if (snapshot.empty) {
                el.innerHTML = '<p>No complaints yet.</p>';
                return;
            }

            snapshot.forEach(doc => {
                el.appendChild(createComplaintElement(doc.id, doc.data()));
            });
        }, err => {
            console.error(err);
            el.innerHTML = '<p>Error loading recent complaints</p>';
        });
}

// ===============================
// My Complaints (USER ONLY)
// ===============================
function loadMyComplaints() {
    const el = document.getElementById('myComplaintsList');
    if (!el || !window.firebaseDB || !currentUser) {
        el.innerHTML = '<p>Please login again.</p>';
        return;
    }

    el.innerHTML = '<p>Loading your complaints…</p>';

    firebaseDB
        .collection('complaints')
        .where('authorId', '==', currentUser.uid)
        .onSnapshot(snapshot => {
            el.innerHTML = '';

            if (snapshot.empty) {
                el.innerHTML = '<p>You have not submitted any complaints.</p>';
                return;
            }

            snapshot.forEach(doc => {
                el.appendChild(createComplaintElement(doc.id, doc.data()));
            });
        }, err => {
            console.error(err);
            el.innerHTML = '<p>Error loading complaints</p>';
        });
}

// ===============================
// Submit Complaint
// ===============================
function handleComplaintSubmit(e) {
    e.preventDefault();

    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const category = document.getElementById('category').value;
    const priority = document.getElementById('priority').value;
    const location = document.getElementById('location').value;

    if (!title || !description || !location) {
        showError('All fields are required');
        return;
    }

    firebaseDB.collection('complaints').add({
        title,
        description,
        category,
        priority,
        location,
        status: 'pending',
        progress: 0,

        authorId: currentUser.uid,
        authorEmail: currentUser.email,

        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        showSuccess('Complaint submitted successfully');
        switchTab(
            'my-complaints',
            document.querySelector('[data-tab="my-complaints"]')
        );
    })
    .catch(err => showError(err.message));
}

// ===============================
// Auth Guard + Init
// ===============================
document.addEventListener('DOMContentLoaded', () => {

    document.querySelectorAll('.nav-item').forEach(item => {
        const tab = item.dataset.tab;
        item.addEventListener('click', e => {
            e.preventDefault();
            switchTab(tab, item);
        });
    });

    const submitBtn = document.getElementById('submitComplaintBtn');
    if (submitBtn) submitBtn.addEventListener('click', handleComplaintSubmit);

    firebaseAuth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        currentUser = user;

        loadComplaintStats();
        loadRecentComplaints();
        loadMyComplaints();

        switchTab(
            'dashboard',
            document.querySelector('[data-tab="dashboard"]')
        );
    });
});
