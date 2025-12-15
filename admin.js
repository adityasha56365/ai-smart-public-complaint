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

// ================= SYSTEM ACTIVITY LOG =================
function loadActivityLog() {
    const logContainer = document.getElementById('activityLog');
    if (!logContainer || !window.firebaseDB) return;

    logContainer.innerHTML = '<p style="color:var(--text-secondary); padding:20px;">Loading recent activities...</p>';

    // Load activities from both complaints and activity log
    firebaseDB.collection('complaints')
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                logContainer.innerHTML = '<p style="color:var(--text-secondary); padding:20px;">No recent activities</p>';
                return;
            }

            const activities = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                const ts = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
                activities.push({
                    type: 'complaint_created',
                    message: `New complaint "${data.title || 'Untitled'}" submitted by ${data.authorEmail || 'Unknown'}`,
                    timestamp: ts,
                    complaintId: doc.id
                });
            });

            // Also check for status updates (if we track them)
            firebaseDB.collection('activityLog')
                .orderBy('timestamp', 'desc')
                .limit(10)
                .get()
                .then(activitySnap => {
                    activitySnap.forEach(doc => {
                        const data = doc.data();
                        activities.push({
                            type: data.type || 'activity',
                            message: data.message || 'System activity',
                            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(),
                            complaintId: data.complaintId
                        });
                    });

                    // Sort by timestamp and display
                    activities.sort((a, b) => b.timestamp - a.timestamp);
                    activities.splice(10); // Keep only 10 most recent

                    displayActivityLog(activities, logContainer);
                })
                .catch(() => {
                    // If activityLog collection doesn't exist, just show complaint activities
                    displayActivityLog(activities, logContainer);
                });
        })
        .catch(err => {
            console.error('Error loading activity log:', err);
            logContainer.innerHTML = '<p style="color:var(--danger); padding:20px;">Error loading activities</p>';
        });
}

function displayActivityLog(activities, container) {
    if (activities.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary); padding:20px;">No recent activities</p>';
        return;
    }

    container.innerHTML = activities.map(activity => {
        const icon = activity.type === 'complaint_created' ? '📋' : 
                    activity.type === 'status_updated' ? '🔄' :
                    activity.type === 'complaint_resolved' ? '✅' :
                    activity.type === 'complaint_rejected' ? '❌' : '📝';
        
        return `
            <div class="activity-item" style="padding:16px; border-bottom:1px solid var(--border-color); display:flex; gap:12px; align-items:flex-start;">
                <div style="font-size:20px;">${icon}</div>
                <div style="flex:1;">
                    <div style="color:var(--text-primary); margin-bottom:4px;">${activity.message}</div>
                    <div style="color:var(--text-secondary); font-size:12px;">${timeAgo(activity.timestamp)}</div>
                </div>
            </div>
        `;
    }).join('');
}

function logActivity(type, message, complaintId = null) {
    if (!window.firebaseDB || !currentAdminUser) return;
    
    firebaseDB.collection('activityLog').add({
        type,
        message,
        complaintId,
        adminId: currentAdminUser.uid,
        adminEmail: currentAdminUser.email,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(err => console.error('Error logging activity:', err));
}

// ================= COMPLAINT UI =================
function createAdminComplaintElement(id, data) {
    const el = document.createElement('div');
    el.className = 'admin-complaint-item complaint-item clickable-complaint';
    el.dataset.status = (data.status || 'pending').toLowerCase();
    el.dataset.complaintId = id;
    el.onclick = () => openComplaintModal(id, data);

    const ts = data.createdAt?.toDate
        ? data.createdAt.toDate()
        : new Date();

    const assignedTo = data.assignedTo || 'Unassigned';
    const priority = data.priority || 'Medium';
    const priorityColor = priority === 'Critical' ? '#d62828' : 
                         priority === 'High' ? '#fb5607' : 
                         priority === 'Medium' ? '#3a86ff' : '#00d4ff';

    el.innerHTML = `
        <div class="admin-complaint-details" style="flex:1;">
            <div class="complaint-meta-row" style="display:flex; gap:12px; margin-bottom:8px; align-items:center; flex-wrap:wrap;">
                <span class="meta-id" style="color:var(--primary-light); font-weight:600;">#${id.slice(0,6).toUpperCase()}</span>
                <span class="meta-category" style="background:rgba(0,212,255,.15); padding:4px 10px; border-radius:12px; font-size:12px;">${data.category || 'General'}</span>
                ${data.subCategory ? `<span class="meta-subcategory" style="background:rgba(131,56,236,.15); padding:4px 10px; border-radius:12px; font-size:11px; color:#8338ec;">${data.subCategory}</span>` : ''}
                <span style="background:${priorityColor}20; color:${priorityColor}; padding:4px 10px; border-radius:12px; font-size:11px; font-weight:600;">${priority}</span>
            </div>

            <div class="complaint-title" style="font-size:16px; font-weight:600; margin-bottom:6px; cursor:pointer;">
                ${data.title || 'No title'}
            </div>

            <div class="complaint-desc" style="color:var(--text-secondary); font-size:13px; margin-bottom:8px; max-height:60px; overflow:hidden;">
                ${data.description || ''}
            </div>

            <div class="complaint-footer" style="display:flex; gap:16px; font-size:12px; color:var(--text-secondary); flex-wrap:wrap;">
                <span>👤 ${data.authorEmail || 'Unknown'}</span>
                <span>📍 ${data.location || 'N/A'}</span>
                <span>🕒 ${timeAgo(ts)}</span>
                <span>👨‍💼 Assigned: ${assignedTo}</span>
            </div>
        </div>

        <div class="admin-actions" style="display:flex; flex-direction:column; gap:8px; min-width:140px;">
            <select
                class="status-dropdown"
                onclick="event.stopPropagation();"
                onchange="updateComplaintStatus('${id}', this.value)">
                ${COMPLAINT_STATUSES.map(s => `
                    <option value="${s}"
                        ${s === el.dataset.status ? 'selected' : ''}>
                        ${s.replace('-', ' ').toUpperCase()}
                    </option>
                `).join('')}
            </select>
            <button class="btn btn-primary" style="padding:8px 12px; font-size:12px;" onclick="event.stopPropagation(); openComplaintModal('${id}', ${JSON.stringify(data).replace(/"/g, '&quot;')})">
                View Details
            </button>
        </div>
    `;
    return el;
}

// ================= COMPLAINT MODAL =================
function openComplaintModal(id, data) {
    // Close any existing modal
    const existingModal = document.getElementById('complaintModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'complaintModal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.85); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
        backdrop-filter: blur(4px);
    `;
    modal.onclick = (e) => {
        if (e.target === modal) closeComplaintModal();
    };

    const ts = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
    const updatedTs = data.updatedAt?.toDate ? data.updatedAt.toDate() : null;
    const priority = data.priority || 'Medium';
    const priorityColor = priority === 'Critical' ? '#d62828' : 
                         priority === 'High' ? '#fb5607' : 
                         priority === 'Medium' ? '#3a86ff' : '#00d4ff';
    const status = (data.status || 'pending').toLowerCase();
    const statusColor = status === 'resolved' ? '#3a86ff' : 
                       status === 'rejected' ? '#d62828' : 
                       status === 'in-progress' ? '#fb5607' : '#00d4ff';

    // Format media display
    let mediaHTML = '';
    if (data.media && Array.isArray(data.media) && data.media.length > 0) {
        mediaHTML = `
            <div style="margin-top:24px;">
                <h3 style="font-size:14px; color:var(--text-secondary); margin-bottom:12px; font-weight:600;">📸 Attached Media (${data.media.length})</h3>
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:12px;">
                    ${data.media.map((media, idx) => {
                        if (media.type === 'image') {
                            return `<div style="position:relative; border-radius:8px; overflow:hidden; border:1px solid var(--border-color);">
                                <img src="${media.url}" alt="${media.name || 'Image'}" style="width:100%; height:150px; object-fit:cover; cursor:pointer;" onclick="window.open('${media.url}', '_blank')">
                            </div>`;
                        } else if (media.type === 'video') {
                            return `<div style="position:relative; border-radius:8px; overflow:hidden; border:1px solid var(--border-color);">
                                <video src="${media.url}" controls style="width:100%; height:150px; object-fit:cover;"></video>
                            </div>`;
                        }
                        return '';
                    }).join('')}
                </div>
            </div>
        `;
    }

    modal.innerHTML = `
        <div style="background:linear-gradient(135deg, var(--bg-card), rgba(0,212,255,0.05)); border:1px solid var(--border-color); border-radius:20px; max-width:900px; width:100%; max-height:90vh; overflow-y:auto; padding:0; position:relative; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
            <!-- Header -->
            <div style="background:linear-gradient(135deg, rgba(0,212,255,0.1), rgba(131,56,236,0.1)); border-bottom:1px solid var(--border-color); padding:24px 32px; border-radius:20px 20px 0 0; position:sticky; top:0; z-index:10;">
                <button onclick="closeComplaintModal()" style="position:absolute; top:20px; right:20px; background:rgba(0,0,0,0.3); border:1px solid var(--border-color); color:var(--text-primary); font-size:20px; cursor:pointer; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:50%; transition:all 0.3s ease;" onmouseover="this.style.background='rgba(214,40,40,0.3)'; this.style.borderColor='#d62828'" onmouseout="this.style.background='rgba(0,0,0,0.3)'; this.style.borderColor='var(--border-color)'">×</button>
                
                <div style="display:flex; align-items:center; gap:16px; margin-bottom:16px; flex-wrap:wrap;">
                    <div style="width:48px; height:48px; background:linear-gradient(135deg, var(--primary), var(--accent)); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:24px; box-shadow:0 4px 12px rgba(0,212,255,0.3);">📋</div>
                    <div style="flex:1;">
                        <h2 style="font-size:26px; margin-bottom:4px; color:var(--primary-light); font-weight:700;">${escapeHtml(data.title || 'Untitled Complaint')}</h2>
                        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
                            <span style="background:rgba(0,212,255,.2); color:var(--primary-light); padding:6px 14px; border-radius:20px; font-size:12px; font-weight:600; border:1px solid rgba(0,212,255,0.3);">${escapeHtml(data.category || 'General')}</span>
                            ${data.subCategory ? `<span style="background:rgba(131,56,236,.2); color:#8338ec; padding:6px 14px; border-radius:20px; font-size:12px; font-weight:600; border:1px solid rgba(131,56,236,0.3);">${escapeHtml(data.subCategory)}</span>` : ''}
                            <span style="background:rgba(131,56,236,.2); color:#8338ec; padding:6px 14px; border-radius:20px; font-size:12px; font-weight:600; border:1px solid rgba(131,56,236,0.3);">#${id.slice(0,6).toUpperCase()}</span>
                            <span style="background:${statusColor}20; color:${statusColor}; padding:6px 14px; border-radius:20px; font-size:12px; font-weight:700; border:1px solid ${statusColor}40; text-transform:uppercase;">${status.replace('-', ' ')}</span>
                            <span style="background:${priorityColor}20; color:${priorityColor}; padding:6px 14px; border-radius:20px; font-size:12px; font-weight:600; border:1px solid ${priorityColor}40;">${priority} Priority</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Content -->
            <div style="padding:32px;">
                <!-- Description -->
                <div style="margin-bottom:28px;">
                    <h3 style="font-size:16px; color:var(--primary-light); margin-bottom:12px; font-weight:700; display:flex; align-items:center; gap:8px;">
                        <span>📝</span> Description
                    </h3>
                    <div style="background:var(--bg-dark); border:1px solid var(--border-color); border-radius:12px; padding:20px; color:var(--text-primary); line-height:1.7; white-space:pre-wrap;">${escapeHtml(data.description || 'No description provided')}</div>
                </div>

                ${mediaHTML}

                <!-- Details Grid -->
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:20px; margin-bottom:28px;">
                    <div style="background:var(--bg-dark); border:1px solid var(--border-color); border-radius:12px; padding:20px;">
                        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">📂 Category</div>
                        <div style="color:var(--text-primary); font-weight:600; font-size:15px;">${escapeHtml(data.category || 'General')}</div>
                        ${data.subCategory ? `<div style="color:var(--primary-light); font-size:13px; margin-top:4px; font-weight:500;">→ ${escapeHtml(data.subCategory)}</div>` : ''}
                    </div>
                    <div style="background:var(--bg-dark); border:1px solid var(--border-color); border-radius:12px; padding:20px;">
                        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">👤 Author</div>
                        <div style="color:var(--text-primary); font-weight:600; font-size:15px;">${escapeHtml(data.authorEmail || 'Unknown')}</div>
                    </div>
                    <div style="background:var(--bg-dark); border:1px solid var(--border-color); border-radius:12px; padding:20px;">
                        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">📍 Location</div>
                        <div style="color:var(--text-primary); font-weight:600; font-size:15px;">${escapeHtml(data.location || 'N/A')}</div>
                    </div>
                    <div style="background:var(--bg-dark); border:1px solid var(--border-color); border-radius:12px; padding:20px;">
                        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">⚡ Priority</div>
                        <div style="color:${priorityColor}; font-weight:700; font-size:15px;">${priority}</div>
                    </div>
                    <div style="background:var(--bg-dark); border:1px solid var(--border-color); border-radius:12px; padding:20px;">
                        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">🕒 Created</div>
                        <div style="color:var(--text-primary); font-weight:600; font-size:15px;">${timeAgo(ts)}</div>
                        <div style="color:var(--text-secondary); font-size:11px; margin-top:4px;">${ts.toLocaleString()}</div>
                    </div>
                    <div style="background:var(--bg-dark); border:1px solid var(--border-color); border-radius:12px; padding:20px;">
                        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">👨‍💼 Assigned To</div>
                        <div style="color:var(--text-primary); font-weight:600; font-size:15px;">${escapeHtml(data.assignedTo || 'Unassigned')}</div>
                    </div>
                    ${updatedTs ? `<div style="background:var(--bg-dark); border:1px solid var(--border-color); border-radius:12px; padding:20px;">
                        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">🔄 Last Updated</div>
                        <div style="color:var(--text-primary); font-weight:600; font-size:15px;">${timeAgo(updatedTs)}</div>
                        <div style="color:var(--text-secondary); font-size:11px; margin-top:4px;">${updatedTs.toLocaleString()}</div>
                    </div>` : ''}
                    ${data.geolocation ? `<div style="background:var(--bg-dark); border:1px solid var(--border-color); border-radius:12px; padding:20px;">
                        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">🌐 Coordinates</div>
                        <div style="color:var(--text-primary); font-weight:600; font-size:13px;">${data.geolocation.latitude.toFixed(6)}, ${data.geolocation.longitude.toFixed(6)}</div>
                        <a href="https://www.google.com/maps?q=${data.geolocation.latitude},${data.geolocation.longitude}" target="_blank" style="color:var(--primary-light); font-size:11px; text-decoration:none; margin-top:4px; display:inline-block;">View on Map →</a>
                    </div>` : ''}
                </div>

                <!-- Actions -->
                <div style="border-top:2px solid var(--border-color); padding-top:24px; display:flex; gap:12px; flex-wrap:wrap;">
                    <button onclick="assignComplaint('${id}')" class="btn btn-primary" style="flex:1; min-width:140px; padding:14px 20px; font-weight:700;">
                        👤 Assign
                    </button>
                    <button onclick="acceptComplaint('${id}')" class="btn" style="flex:1; min-width:140px; background:rgba(58,134,255,0.2); color:#3a86ff; border:2px solid #3a86ff; padding:14px 20px; font-weight:700;">
                        ✅ Accept
                    </button>
                    <button onclick="rejectComplaint('${id}')" class="btn" style="flex:1; min-width:140px; background:rgba(251,86,7,0.2); color:#fb5607; border:2px solid #fb5607; padding:14px 20px; font-weight:700;">
                        ❌ Reject
                    </button>
                    <button onclick="deleteComplaint('${id}')" class="btn" style="flex:1; min-width:140px; background:rgba(214,40,40,0.2); color:#d62828; border:2px solid #d62828; padding:14px 20px; font-weight:700;">
                        🗑 Delete
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function closeComplaintModal() {
    const modal = document.getElementById('complaintModal');
    if (modal) modal.remove();
}

function assignComplaint(id) {
    const email = prompt('Enter admin email to assign this complaint:');
    if (!email) return;

    firebaseDB.collection('complaints').doc(id).update({
        assignedTo: email,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        logActivity('complaint_assigned', `Complaint assigned to ${email}`, id);
        showSuccess('Complaint assigned successfully');
        closeComplaintModal();
        loadAllComplaints();
    }).catch(err => showError(err.message));
}

function acceptComplaint(id) {
    if (!confirm('Accept this complaint and mark as in-progress?')) return;

    firebaseDB.collection('complaints').doc(id).update({
        status: 'in-progress',
        assignedTo: currentAdminUser.email,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        logActivity('complaint_accepted', 'Complaint accepted and set to in-progress', id);
        showSuccess('Complaint accepted');
        closeComplaintModal();
        loadAllComplaints();
        loadActivityLog();
    }).catch(err => showError(err.message));
}

function deleteComplaint(id) {
    if (!confirm('Are you sure you want to delete this complaint? This action cannot be undone.')) return;

    firebaseDB.collection('complaints').doc(id).delete()
        .then(() => {
            logActivity('complaint_deleted', 'Complaint deleted by admin', id);
            showSuccess('Complaint deleted');
            closeComplaintModal();
            loadAllComplaints();
            loadActivityLog();
        }).catch(err => showError(err.message));
}

function rejectComplaint(id) {
    const reason = prompt('Enter rejection reason (optional):');
    
    firebaseDB.collection('complaints').doc(id).update({
        status: 'rejected',
        rejectionReason: reason || 'No reason provided',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        logActivity('complaint_rejected', `Complaint rejected${reason ? ': ' + reason : ''}`, id);
        showSuccess('Complaint rejected');
        closeComplaintModal();
        loadAllComplaints();
        loadActivityLog();
    }).catch(err => showError(err.message));
}

// ================= LOAD ALL COMPLAINTS =================
let allComplaintsData = [];

function loadAllComplaints() {
    const list = document.getElementById('allComplaintsList');
    if (!list || !window.firebaseDB) return;

    list.innerHTML =
        '<p style="padding:30px;text-align:center;">Loading complaints…</p>';

    firebaseDB.collection('complaints')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            list.innerHTML = '';
            allComplaintsData = [];

            if (snapshot.empty) {
                list.innerHTML =
                    '<p style="text-align:center;">No complaints found</p>';
                return;
            }

            snapshot.forEach(doc => {
                const complaintData = { id: doc.id, ...doc.data() };
                allComplaintsData.push(complaintData);
                list.appendChild(
                    createAdminComplaintElement(doc.id, doc.data())
                );
            });
        });
}

function searchComplaints(query) {
    const list = document.getElementById('allComplaintsList');
    if (!list) return;

    if (!query.trim()) {
        // Show all if search is empty
        list.innerHTML = '';
        allComplaintsData.forEach(complaint => {
            list.appendChild(
                createAdminComplaintElement(complaint.id, complaint)
            );
        });
        return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = allComplaintsData.filter(complaint => {
        const title = (complaint.title || '').toLowerCase();
        const description = (complaint.description || '').toLowerCase();
        const category = (complaint.category || '').toLowerCase();
        const location = (complaint.location || '').toLowerCase();
        const email = (complaint.authorEmail || '').toLowerCase();
        const status = (complaint.status || '').toLowerCase();
        
        return title.includes(lowerQuery) || 
               description.includes(lowerQuery) || 
               category.includes(lowerQuery) || 
               location.includes(lowerQuery) || 
               email.includes(lowerQuery) ||
               status.includes(lowerQuery);
    });

    list.innerHTML = '';
    if (filtered.length === 0) {
        list.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-secondary);">No complaints found matching your search</p>';
        return;
    }

    filtered.forEach(complaint => {
        list.appendChild(
            createAdminComplaintElement(complaint.id, complaint)
        );
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
            logActivity('status_updated', `Complaint status updated to ${status}`, id);
            loadActivityLog();
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
        loadActivityLog();
        loadPerformanceMetrics();
        switchAdminTab('overview',
            document.querySelector('[data-tab="overview"]')
        );
    });
}

// ================= PERFORMANCE METRICS =================
function loadPerformanceMetrics() {
    const container = document.getElementById('performanceMetrics');
    if (!container || !window.firebaseDB) return;

    container.innerHTML = '<p style="color:var(--text-secondary);">Loading metrics...</p>';

    firebaseDB.collection('complaints').get().then(snapshot => {
        const complaints = [];
        snapshot.forEach(doc => complaints.push(doc.data()));

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thisWeek = new Date(today);
        thisWeek.setDate(today.getDate() - 7);
        const thisMonth = new Date(today);
        thisMonth.setMonth(today.getMonth() - 1);

        let todayCount = 0;
        let weekCount = 0;
        let monthCount = 0;
        let resolvedToday = 0;
        let avgResponseTime = 0;
        const responseTimes = [];

        complaints.forEach(comp => {
            const created = comp.createdAt?.toDate ? comp.createdAt.toDate() : new Date();
            const updated = comp.updatedAt?.toDate ? comp.updatedAt.toDate() : null;

            if (created >= today) todayCount++;
            if (created >= thisWeek) weekCount++;
            if (created >= thisMonth) monthCount++;

            if (comp.status === 'resolved' && updated && created >= today) {
                resolvedToday++;
            }

            if (comp.status === 'resolved' && updated) {
                const hours = (updated - created) / (1000 * 60 * 60);
                responseTimes.push(hours);
            }
        });

        avgResponseTime = responseTimes.length > 0
            ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
            : 0;

        container.innerHTML = `
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:12px;">
                <div style="background:var(--bg-dark); border:1px solid var(--border-color); border-radius:8px; padding:16px; text-align:center;">
                    <div style="font-size:24px; font-weight:700; color:var(--primary-light);">${todayCount}</div>
                    <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">Today</div>
                </div>
                <div style="background:var(--bg-dark); border:1px solid var(--border-color); border-radius:8px; padding:16px; text-align:center;">
                    <div style="font-size:24px; font-weight:700; color:#3a86ff;">${weekCount}</div>
                    <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">This Week</div>
                </div>
                <div style="background:var(--bg-dark); border:1px solid var(--border-color); border-radius:8px; padding:16px; text-align:center;">
                    <div style="font-size:24px; font-weight:700; color:#fb5607;">${monthCount}</div>
                    <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">This Month</div>
                </div>
                <div style="background:var(--bg-dark); border:1px solid var(--border-color); border-radius:8px; padding:16px; text-align:center;">
                    <div style="font-size:24px; font-weight:700; color:#51cf66;">${resolvedToday}</div>
                    <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">Resolved Today</div>
                </div>
            </div>
            <div style="margin-top:16px; padding:12px; background:var(--bg-dark); border:1px solid var(--border-color); border-radius:8px;">
                <div style="font-size:12px; color:var(--text-secondary); margin-bottom:4px;">⏱️ Average Response Time</div>
                <div style="font-size:18px; font-weight:700; color:var(--primary-light);">${avgResponseTime}h</div>
            </div>
        `;
    }).catch(err => {
        console.error('Error loading metrics:', err);
        container.innerHTML = '<p style="color:var(--danger);">Error loading metrics</p>';
    });
}

function exportAllComplaints() {
    if (allComplaintsData.length === 0) {
        showError('No complaints to export');
        return;
    }

    const csv = [
        ['ID', 'Title', 'Category', 'Status', 'Priority', 'Location', 'Author', 'Created', 'Description'].join(','),
        ...allComplaintsData.map(c => {
            const created = c.createdAt?.toDate ? c.createdAt.toDate().toLocaleString() : 'N/A';
            return [
                c.id.slice(0, 6),
                `"${(c.title || '').replace(/"/g, '""')}"`,
                c.category || 'N/A',
                c.status || 'pending',
                c.priority || 'Medium',
                `"${(c.location || '').replace(/"/g, '""')}"`,
                c.authorEmail || 'Unknown',
                created,
                `"${(c.description || '').replace(/"/g, '""').substring(0, 100)}"`
            ].join(',');
        })
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `complaints_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showSuccess('Complaints exported successfully!');
}

function refreshDashboard() {
    loadAdminStats();
    loadAllComplaints();
    loadActivityLog();
    loadPerformanceMetrics();
    showSuccess('Dashboard refreshed!');
}

// ================= REPORTS PAGE =================
function loadReports() {
    const content = document.getElementById('reportsContent');
    if (!content || !window.firebaseDB) return;

    content.innerHTML = '<p style="text-align:center; padding:40px;">Loading reports...</p>';

    firebaseDB.collection('complaints').get().then(snapshot => {
        const complaints = [];
        snapshot.forEach(doc => complaints.push({ id: doc.id, ...doc.data() }));

        const stats = calculateReportStats(complaints);
        displayReports(stats, complaints, content);
    }).catch(err => {
        console.error('Error loading reports:', err);
        content.innerHTML = '<p style="color:var(--danger); padding:20px;">Error loading reports</p>';
    });
}

function calculateReportStats(complaints) {
    const stats = {
        total: complaints.length,
        byStatus: { pending: 0, 'in-progress': 0, resolved: 0, rejected: 0 },
        byCategory: {},
        byPriority: { Low: 0, Medium: 0, High: 0, Critical: 0 },
        byMonth: {},
        resolutionTime: [],
        avgResolutionTime: 0,
        topCategories: [],
        topLocations: {}
    };

    complaints.forEach(comp => {
        const status = (comp.status || 'pending').toLowerCase();
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

        const category = comp.category || 'General';
        stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

        const priority = comp.priority || 'Medium';
        stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;

        const location = comp.location || 'Unknown';
        stats.topLocations[location] = (stats.topLocations[location] || 0) + 1;

        const created = comp.createdAt?.toDate ? comp.createdAt.toDate() : new Date();
        const monthKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
        stats.byMonth[monthKey] = (stats.byMonth[monthKey] || 0) + 1;

        if (status === 'resolved' && comp.updatedAt) {
            const updated = comp.updatedAt.toDate ? comp.updatedAt.toDate() : new Date();
            const days = Math.ceil((updated - created) / (1000 * 60 * 60 * 24));
            stats.resolutionTime.push(days);
        }
    });

    stats.avgResolutionTime = stats.resolutionTime.length > 0
        ? Math.round(stats.resolutionTime.reduce((a, b) => a + b, 0) / stats.resolutionTime.length)
        : 0;

    stats.topCategories = Object.entries(stats.byCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat, count]) => ({ category: cat, count }));

    return stats;
}

function displayReports(stats, complaints, container) {
    const resolutionRate = stats.total > 0 
        ? Math.round((stats.byStatus.resolved / stats.total) * 100) 
        : 0;
    const pendingRate = stats.total > 0 
        ? Math.round((stats.byStatus.pending / stats.total) * 100) 
        : 0;
    const inProgressRate = stats.total > 0 
        ? Math.round((stats.byStatus['in-progress'] / stats.total) * 100) 
        : 0;

    container.style.padding = '28px';
    container.style.textAlign = 'left';

    container.innerHTML = `
        <div class="stats-grid" style="margin-bottom:32px;">
            <div class="stat-card" style="background:linear-gradient(135deg, rgba(0,212,255,0.12), rgba(131,56,236,0.08));">
                <div class="stat-label">📊 Total Complaints</div>
                <div class="stat-value" style="color:var(--primary-light);">${stats.total}</div>
                <div class="stat-change">All time complaints</div>
            </div>
            <div class="stat-card" style="background:linear-gradient(135deg, rgba(58,134,255,0.12), rgba(81,207,102,0.08));">
                <div class="stat-label">✅ Resolution Rate</div>
                <div class="stat-value" style="color:#3a86ff;">${resolutionRate}%</div>
                <div class="stat-change">${stats.byStatus.resolved} resolved</div>
            </div>
            <div class="stat-card" style="background:linear-gradient(135deg, rgba(251,86,7,0.12), rgba(255,217,61,0.08));">
                <div class="stat-label">⏱️ Avg Resolution Time</div>
                <div class="stat-value" style="color:#fb5607;">${stats.avgResolutionTime}d</div>
                <div class="stat-change">${stats.resolutionTime.length} resolved cases</div>
            </div>
            <div class="stat-card" style="background:linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,212,255,0.08));">
                <div class="stat-label">⏳ Pending</div>
                <div class="stat-value" style="color:var(--primary-light);">${stats.byStatus.pending}</div>
                <div class="stat-change">${pendingRate}% of total</div>
            </div>
            <div class="stat-card" style="background:linear-gradient(135deg, rgba(251,86,7,0.12), rgba(251,86,7,0.08));">
                <div class="stat-label">🛠 In Progress</div>
                <div class="stat-value" style="color:#fb5607;">${stats.byStatus['in-progress']}</div>
                <div class="stat-change">${inProgressRate}% of total</div>
            </div>
            <div class="stat-card" style="background:linear-gradient(135deg, rgba(214,40,40,0.12), rgba(214,40,40,0.08));">
                <div class="stat-label">🚫 Rejected</div>
                <div class="stat-value" style="color:#d62828;">${stats.byStatus.rejected}</div>
                <div class="stat-change">${stats.total > 0 ? Math.round((stats.byStatus.rejected / stats.total) * 100) : 0}% of total</div>
            </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(450px, 1fr)); gap:24px; margin-bottom:24px;">
            <div class="chart-container" style="background:linear-gradient(135deg, rgba(0,212,255,0.05), rgba(131,56,236,0.03)); border:2px solid var(--border-color);">
                <div class="chart-title" style="font-size:18px; margin-bottom:20px;">📊 Complaints by Status</div>
                <div id="statusChart" style="min-height:300px; padding:20px 0;">
                    ${renderStatusChart(stats.byStatus)}
                </div>
            </div>

            <div class="chart-container" style="background:linear-gradient(135deg, rgba(0,212,255,0.05), rgba(131,56,236,0.03)); border:2px solid var(--border-color);">
                <div class="chart-title" style="font-size:18px; margin-bottom:20px;">📂 Top Categories</div>
                <div id="categoryChart" style="min-height:300px; padding:20px 0;">
                    ${renderCategoryChart(stats.topCategories)}
                </div>
            </div>

            <div class="chart-container" style="background:linear-gradient(135deg, rgba(0,212,255,0.05), rgba(131,56,236,0.03)); border:2px solid var(--border-color);">
                <div class="chart-title" style="font-size:18px; margin-bottom:20px;">⚡ Complaints by Priority</div>
                <div id="priorityChart" style="min-height:300px; padding:20px 0;">
                    ${renderPriorityChart(stats.byPriority)}
                </div>
            </div>

            <div class="chart-container" style="background:linear-gradient(135deg, rgba(0,212,255,0.05), rgba(131,56,236,0.03)); border:2px solid var(--border-color);">
                <div class="chart-title" style="font-size:18px; margin-bottom:20px;">📅 Monthly Trend</div>
                <div id="monthlyChart" style="min-height:300px; padding:20px 0;">
                    ${renderMonthlyChart(stats.byMonth)}
                </div>
            </div>
        </div>

        <div class="chart-container" style="margin-top:24px; background:linear-gradient(135deg, rgba(0,212,255,0.05), rgba(131,56,236,0.03)); border:2px solid var(--border-color);">
            <div class="chart-title" style="font-size:18px; margin-bottom:20px;">📍 Top Locations</div>
            <div style="margin-top:16px;">
                ${renderTopLocations(stats.topLocations)}
            </div>
        </div>
    `;
}

function renderStatusChart(byStatus) {
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    if (total === 0) return '<p style="color:var(--text-secondary);">No data available</p>';

    const colors = {
        pending: '#00d4ff',
        'in-progress': '#fb5607',
        resolved: '#3a86ff',
        rejected: '#d62828'
    };

    return Object.entries(byStatus).map(([status, count]) => {
        const percent = Math.round((count / total) * 100);
        const color = colors[status] || '#666';
        return `
            <div style="margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="text-transform:uppercase; font-weight:600;">${status.replace('-', ' ')}</span>
                    <span style="color:var(--text-secondary);">${count} (${percent}%)</span>
                </div>
                <div style="width:100%; height:24px; background:var(--bg-dark); border-radius:12px; overflow:hidden;">
                    <div style="width:${percent}%; height:100%; background:${color}; transition:width 0.5s ease;"></div>
                </div>
            </div>
        `;
    }).join('');
}

function renderCategoryChart(topCategories) {
    if (topCategories.length === 0) return '<p style="color:var(--text-secondary);">No data available</p>';

    const max = Math.max(...topCategories.map(c => c.count));
    
    return topCategories.map((item, index) => {
        const percent = max > 0 ? Math.round((item.count / max) * 100) : 0;
        const colors = ['#00d4ff', '#8338ec', '#ff006e', '#fb5607', '#3a86ff'];
        return `
            <div style="margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="font-weight:600;">${item.category}</span>
                    <span style="color:var(--text-secondary);">${item.count}</span>
                </div>
                <div style="width:100%; height:20px; background:var(--bg-dark); border-radius:10px; overflow:hidden;">
                    <div style="width:${percent}%; height:100%; background:${colors[index % colors.length]}; transition:width 0.5s ease;"></div>
                </div>
            </div>
        `;
    }).join('');
}

function renderPriorityChart(byPriority) {
    const total = Object.values(byPriority).reduce((a, b) => a + b, 0);
    if (total === 0) return '<p style="color:var(--text-secondary);">No data available</p>';

    const colors = { Critical: '#d62828', High: '#fb5607', Medium: '#3a86ff', Low: '#00d4ff' };

    return Object.entries(byPriority).map(([priority, count]) => {
        const percent = Math.round((count / total) * 100);
        return `
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                <div style="width:60px; text-align:right; font-weight:600;">${priority}</div>
                <div style="flex:1; height:32px; background:var(--bg-dark); border-radius:16px; overflow:hidden; position:relative;">
                    <div style="width:${percent}%; height:100%; background:${colors[priority]}; transition:width 0.5s ease;"></div>
                    <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:12px; font-weight:600;">${count}</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderMonthlyChart(byMonth) {
    const entries = Object.entries(byMonth).sort().slice(-6);
    if (entries.length === 0) return '<p style="color:var(--text-secondary);">No data available</p>';

    const max = Math.max(...entries.map(e => e[1]), 1);
    const colors = ['#00d4ff', '#8338ec', '#ff006e', '#fb5607', '#3a86ff', '#51cf66'];

    return `
        <div style="display:flex; align-items:flex-end; gap:12px; height:200px; padding:20px 0;">
            ${entries.map(([month, count], index) => {
                const height = Math.round((count / max) * 100);
                const color = colors[index % colors.length];
                const monthName = new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                return `
                    <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:8px;">
                        <div style="width:100%; background:var(--bg-dark); border-radius:8px 8px 0 0; height:180px; display:flex; align-items:flex-end; position:relative;">
                            <div style="width:100%; background:${color}; height:${height}%; border-radius:8px 8px 0 0; transition:height 0.5s ease; box-shadow:0 4px 12px ${color}40;"></div>
                            <span style="position:absolute; top:-24px; left:50%; transform:translateX(-50%); font-weight:600; font-size:14px; color:var(--text-primary);">${count}</span>
                        </div>
                        <span style="font-size:11px; color:var(--text-secondary); text-align:center; font-weight:600;">${monthName}</span>
                    </div>
                `;
            }).join('')}
        </div>
        <div style="margin-top:16px; padding:12px; background:var(--bg-dark); border-radius:8px; border:1px solid var(--border-color);">
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px; font-weight:600;">Legend:</div>
            <div style="display:flex; gap:16px; flex-wrap:wrap;">
                ${entries.map(([month, count], index) => {
                    const color = colors[index % colors.length];
                    const monthName = new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' });
                    return `<div style="display:flex; align-items:center; gap:6px;">
                        <div style="width:16px; height:16px; background:${color}; border-radius:4px;"></div>
                        <span style="font-size:11px; color:var(--text-secondary);">${monthName}</span>
                    </div>`;
                }).join('')}
            </div>
        </div>
    `;
}

function renderTopLocations(topLocations) {
    const sorted = Object.entries(topLocations)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    if (sorted.length === 0) return '<p style="color:var(--text-secondary);">No location data available</p>';

    return sorted.map(([location, count], index) => `
        <div style="display:flex; align-items:center; gap:12px; padding:12px; background:var(--bg-dark); border-radius:8px; margin-bottom:8px;">
            <span style="width:24px; text-align:center; font-weight:700; color:var(--primary-light);">#${index + 1}</span>
            <span style="flex:1; font-weight:600;">${location}</span>
            <span style="background:rgba(0,212,255,.15); padding:4px 12px; border-radius:12px; font-weight:600;">${count}</span>
        </div>
    `).join('');
}

function exportReport() {
    showSuccess('Report export functionality coming soon!');
}

// ================= SETTINGS PAGE =================
function loadSettings() {
    const content = document.getElementById('settingsContent');
    if (!content || !currentAdminUser || !window.firebaseDB) return;

    content.innerHTML = '<p style="text-align:center; padding:40px;">Loading settings...</p>';

    firebaseDB.collection('users').doc(currentAdminUser.uid).get()
        .then(doc => {
            const userData = doc.exists ? doc.data() : {};
            displaySettings(userData, content);
        })
        .catch(err => {
            console.error('Error loading settings:', err);
            content.innerHTML = '<p style="color:var(--danger); padding:20px;">Error loading settings</p>';
        });
}

function displaySettings(userData, container) {
    container.innerHTML = `
        <div class="settings-section">
            <div class="settings-section-title">👤 Admin Profile</div>
            <div class="settings-form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">First Name</label>
                        <input type="text" id="adminFirstName" class="form-input" value="${userData.firstName || ''}" placeholder="First Name">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Last Name</label>
                        <input type="text" id="adminLastName" class="form-input" value="${userData.lastName || ''}" placeholder="Last Name">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" id="adminEmail" class="form-input" value="${currentAdminUser.email || ''}" disabled>
                        <div class="ai-suggestion">📧 Email cannot be changed</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Phone</label>
                        <input type="tel" id="adminPhone" class="form-input" value="${userData.phone || ''}" placeholder="Phone Number">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Admin ID</label>
                        <input type="text" class="form-input" value="${currentAdminUser.uid}" disabled>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Role</label>
                        <input type="text" class="form-input" value="${userData.role || 'admin'}" disabled>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Department</label>
                        <input type="text" id="adminDepartment" class="form-input" value="${userData.department || ''}" placeholder="Department">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Position</label>
                        <input type="text" id="adminPosition" class="form-input" value="${userData.position || ''}" placeholder="Position">
                    </div>
                </div>

                <button class="btn btn-primary" onclick="saveAdminProfile()">💾 Save Profile</button>
            </div>
        </div>

        <div class="settings-section">
            <div class="settings-section-title">🔐 Security Settings</div>
            <div class="settings-form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Current Password</label>
                        <input type="password" id="currentPassword" class="form-input" placeholder="Enter current password">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">New Password</label>
                        <input type="password" id="newPassword" class="form-input" placeholder="Enter new password">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Confirm New Password</label>
                        <input type="password" id="confirmNewPassword" class="form-input" placeholder="Confirm new password">
                    </div>
                </div>

                <button class="btn btn-primary" onclick="updateAdminPassword()">🔒 Update Password</button>
            </div>
        </div>

        <div class="settings-section">
            <div class="settings-section-title">⚙ System Configuration</div>
            <div class="settings-form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Auto-assign complaints</label>
                        <select id="autoAssign" class="form-select">
                            <option value="enabled">Enabled</option>
                            <option value="disabled" selected>Disabled</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Default priority for new complaints</label>
                        <select id="defaultPriority" class="form-select">
                            <option value="Low">Low</option>
                            <option value="Medium" selected>Medium</option>
                            <option value="High">High</option>
                            <option value="Critical">Critical</option>
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Email notifications</label>
                        <select id="emailNotifications" class="form-select">
                            <option value="enabled" selected>Enabled</option>
                            <option value="disabled">Disabled</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Activity log retention (days)</label>
                        <input type="number" id="logRetention" class="form-input" value="30" min="7" max="365">
                    </div>
                </div>

                <button class="btn btn-primary" onclick="saveSystemConfig()">💾 Save Configuration</button>
            </div>
        </div>
    `;
}

function saveAdminProfile() {
    const firstName = document.getElementById('adminFirstName').value.trim();
    const lastName = document.getElementById('adminLastName').value.trim();
    const phone = document.getElementById('adminPhone').value.trim();
    const department = document.getElementById('adminDepartment').value.trim();
    const position = document.getElementById('adminPosition').value.trim();

    firebaseDB.collection('users').doc(currentAdminUser.uid).update({
        firstName,
        lastName,
        phone,
        department,
        position,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        showSuccess('Profile updated successfully!');
    }).catch(err => {
        showError(err.message);
    });
}

function updateAdminPassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        showError('All password fields are required');
        return;
    }

    if (newPassword.length < 8) {
        showError('New password must be at least 8 characters');
        return;
    }

    if (newPassword !== confirmPassword) {
        showError('New passwords do not match');
        return;
    }

    const credential = firebase.auth.EmailAuthProvider.credential(
        currentAdminUser.email,
        currentPassword
    );

    currentAdminUser.reauthenticateWithCredential(credential)
        .then(() => currentAdminUser.updatePassword(newPassword))
        .then(() => {
            showSuccess('Password updated successfully!');
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmNewPassword').value = '';
        })
        .catch(err => showError(err.message));
}

function saveSystemConfig() {
    const config = {
        autoAssign: document.getElementById('autoAssign').value,
        defaultPriority: document.getElementById('defaultPriority').value,
        emailNotifications: document.getElementById('emailNotifications').value,
        logRetention: parseInt(document.getElementById('logRetention').value) || 30,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: currentAdminUser.uid
    };

    firebaseDB.collection('systemConfig').doc('main').set(config, { merge: true })
        .then(() => {
            showSuccess('System configuration saved successfully!');
        })
        .catch(err => {
            showError(err.message);
        });
}

// ================= TAB SWITCHING ENHANCEMENT =================
// Enhance switchAdminTab to load tab content
const originalSwitchAdminTabFunction = switchAdminTab;
switchAdminTab = function(tabName, navItem) {
    originalSwitchAdminTabFunction(tabName, navItem);
    
    // Load content when switching to specific tabs
    if (tabName === 'reports') {
        setTimeout(() => loadReports(), 100);
    } else if (tabName === 'settings') {
        setTimeout(() => loadSettings(), 100);
    } else if (tabName === 'overview') {
        setTimeout(() => {
            loadActivityLog();
            loadPerformanceMetrics();
        }, 100);
    }
};

// ================= INIT =================
document.addEventListener('DOMContentLoaded', checkAdminAuth);

// ===============================
// Mobile sidebar toggle (responsive)
// ===============================
function toggleSidebar() {
    const sb = document.querySelector('.sidebar');
    if (!sb) return;
    const overlayId = 'mobileOverlay';
    const existing = document.getElementById(overlayId);
    const willOpen = !sb.classList.contains('open');

    sb.classList.toggle('open');

    if (willOpen) {
        if (!existing) {
            const ov = document.createElement('div');
            ov.id = overlayId;
            ov.className = 'mobile-overlay visible';
            ov.onclick = () => toggleSidebar();
            document.body.appendChild(ov);
        } else {
            existing.classList.add('visible');
        }
        document.body.style.overflow = 'hidden';
    } else {
        if (existing) existing.classList.remove('visible');
        setTimeout(() => {
            const el = document.getElementById(overlayId);
            if (el) el.remove();
        }, 300);
        document.body.style.overflow = '';
    }
}

// Close sidebar when clicking outside on small screens
document.addEventListener('click', (e) => {
    try {
        if (window.innerWidth > 768) return;
        const sb = document.querySelector('.sidebar');
        const btn = document.getElementById('mobileMenuBtn');
        if (!sb || !sb.classList.contains('open')) return;
        if (btn && (e.target === btn || btn.contains(e.target))) return;
        if (!sb.contains(e.target)) sb.classList.remove('open');
    } catch (err) {
        // ignore
    }
});