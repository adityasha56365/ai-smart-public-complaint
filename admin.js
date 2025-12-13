// admin.js - FINAL WORKING ADMIN DASHBOARD LOGIC

// ================= GLOBAL STATE =================
let currentAdminUser = null;

const COMPLAINT_STATUSES = [
    'pending',
    'in-progress',
    'resolved',
    'rejected'
];

// ================= HELPERS =================
function showError(msg) {
    console.error(msg);
    alert("Error: " + msg);
}

function showSuccess(msg) {
    console.log(msg);
    alert(msg);
}

function timeAgo(date) {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

// ================= NAVIGATION =================
function switchAdminTab(tabName, navItem) {
    document.querySelectorAll('.tab-content')
        .forEach(t => t.style.display = 'none');

    const tab = document.getElementById(tabName);
    if (tab) tab.style.display = 'block';

    document.querySelectorAll('.nav-item')
        .forEach(n => n.classList.remove('active'));

    if (navItem) navItem.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function filterAdminComplaints(status, btn) {
    document.querySelectorAll('.filter-btn')
        .forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');

    document.querySelectorAll('.admin-complaint-item').forEach(item => {
        item.style.display =
            status === 'all' || item.dataset.status === status
                ? 'flex'
                : 'none';
    });
}

// ================= LOGOUT =================
function adminLogout() {
    firebaseAuth.signOut().finally(() => {
        localStorage.clear();
        window.location.href = 'index.html';
    });
}

// ================= ADMIN STATS =================
function loadAdminStats() {
    const grid = document.getElementById('adminStatsGrid');
    if (!grid || !window.firebaseDB) return;

    grid.innerHTML =
        '<p style="padding:30px;text-align:center;">Loading statistics…</p>';

    firebaseDB.collection('complaints').onSnapshot(snapshot => {
        let stats = {
            total: 0,
            pending: 0,
            inProgress: 0,
            resolved: 0,
            rejected: 0
        };

        snapshot.forEach(doc => {
            stats.total++;
            const s = (doc.data().status || 'pending').toLowerCase();
            if (s === 'resolved') stats.resolved++;
            else if (s === 'in-progress') stats.inProgress++;
            else if (s === 'rejected') stats.rejected++;
            else stats.pending++;
        });

        grid.innerHTML = `
            <div class="stat-card">
                <div class="stat-label">📤 Total</div>
                <div class="stat-value">${stats.total}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">⏳ Pending</div>
                <div class="stat-value">${stats.pending}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">🛠 In Progress</div>
                <div class="stat-value">${stats.inProgress}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">✅ Resolved</div>
                <div class="stat-value">${stats.resolved}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">🚫 Rejected</div>
                <div class="stat-value">${stats.rejected}</div>
            </div>
        `;
    });
}

// ================= COMPLAINT UI =================
function createAdminComplaintElement(id, data) {
    const el = document.createElement('div');
    el.className = 'admin-complaint-item complaint-item';
    el.dataset.status = (data.status || 'pending').toLowerCase();

    const ts = data.createdAt?.toDate
        ? data.createdAt.toDate()
        : new Date();

    el.innerHTML = `
        <div class="admin-complaint-details">
            <div class="complaint-meta-row">
                <span class="meta-id">#${id.slice(0,6).toUpperCase()}</span>
                <span class="meta-category">${data.category || 'General'}</span>
            </div>

            <div class="complaint-title">
                ${data.title || 'No title'}
            </div>

            <div class="complaint-desc">
                ${data.description || ''}
            </div>

            <div class="complaint-footer">
                👤 ${data.authorEmail || 'Unknown'} |
                📍 ${data.location || 'N/A'} |
                🕒 ${timeAgo(ts)}
            </div>
        </div>

        <div class="admin-actions">
            <select
                class="status-dropdown"
                onchange="updateComplaintStatus('${id}', this.value)">
                ${COMPLAINT_STATUSES.map(s => `
                    <option value="${s}"
                        ${s === el.dataset.status ? 'selected' : ''}>
                        ${s.replace('-', ' ').toUpperCase()}
                    </option>
                `).join('')}
            </select>
        </div>
    `;
    return el;
}

// ================= LOAD ALL COMPLAINTS =================
function loadAllComplaints() {
    const list = document.getElementById('allComplaintsList');
    if (!list || !window.firebaseDB) return;

    list.innerHTML =
        '<p style="padding:30px;text-align:center;">Loading complaints…</p>';

    firebaseDB.collection('complaints')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            list.innerHTML = '';

            if (snapshot.empty) {
                list.innerHTML =
                    '<p style="text-align:center;">No complaints found</p>';
                return;
            }

            snapshot.forEach(doc => {
                list.appendChild(
                    createAdminComplaintElement(doc.id, doc.data())
                );
            });
        });
}

// ================= UPDATE STATUS =================
function updateComplaintStatus(id, status) {
    firebaseDB.collection('complaints')
        .doc(id)
        .update({
            status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => {
            console.log('Updated:', id, status);
        })
        .catch(err => {
            console.error(err);
            showError('Failed to update status');
        });
}

// ================= AUTH GUARD =================
function checkAdminAuth() {
    firebaseAuth.onAuthStateChanged(async user => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        const snap = await firebaseDB
            .collection('users')
            .doc(user.uid)
            .get();

        if (!snap.exists || snap.data().role !== 'admin') {
            alert('Access denied. Admin only.');
            window.location.href = 'dashboard.html';
            return;
        }

        currentAdminUser = user;

        loadAdminStats();
        loadAllComplaints();
        switchAdminTab('overview',
            document.querySelector('[data-tab="overview"]')
        );
    });
}

// ================= INIT =================
document.addEventListener('DOMContentLoaded', checkAdminAuth);
