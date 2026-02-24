/**
 * DASHBOARD.JS - Enhanced with All Missing Functions
 */
// Dashboard Logic

// Global Error Handler for debugging
window.onerror = function (message, source, lineno, colno, error) {
    console.error('Global Error:', message, error);
    // Delay slightly to ensure toast system is ready or create fallback
    setTimeout(() => {
        if (typeof showToast === 'function') {
            showToast(`Error: ${message}`, 'error');
        } else {
            alert(`System Error: ${message}`);
        }
    }, 1000);
    return false;
};

let currentUser = null;
let currentRole = null;
// Mirror on window so loadTargetView (appended later) can read role
Object.defineProperty(window, '_currentUser', { get: () => currentUser });
Object.defineProperty(window, '_currentRole', { get: () => currentRole });
let selectedTargetId = null;
let currentRoleFilter = 'admin'; // Track current users role filter
let currentViewContext = { name: 'main_menu', params: {} }; // Track active view for refresh

// --- TARGET VIEW SPA LOGIC ---

// Global variables for target view (scoped to window to avoid conflicts, or use unique names)
let currentTargetId = null;
let currentWorkspaceId = null;
let currentTargetSchema = [];

window.loadTargetViewLegacy = async function (targetId, workspaceId) {
    console.log(`[SPA] Loading Target View: ID ${targetId}, WS ${workspaceId}`);

    // Ensure modals exist (Safe to call repeatedly due to internal check)
    injectTargetModals();

    currentTargetId = targetId;
    currentWorkspaceId = workspaceId;

    const mainRender = document.getElementById('main-render');
    mainRender.innerHTML = '<div class="loader"></div>';

    try {
        currentViewContext = { name: 'target_view', params: { targetId, workspaceId } };
        // Fetch Data AND Members in parallel
        const [dataRes, membersRes] = await Promise.all([
            fetch(window.API_BASE + `/api/targets/${targetId}/data?workspaceId=${workspaceId}`, { credentials: 'include' }),
            fetch(window.API_BASE + `/api/workspaces/${workspaceId}/members`, { credentials: 'include' })
        ]);

        if (!dataRes.ok) throw new Error('Failed to load target data');
        const data = await dataRes.json();

        let members = [];
        if (membersRes.ok) {
            members = await membersRes.json();
        }

        // --- Prepare Header Members Stack ---
        let membersHTML = '';
        if (members && members.length > 0) {
            members.slice(0, 5).forEach(m => {
                const initial = m.name ? m.name.charAt(0).toUpperCase() : '?';
                membersHTML += `<div class="member-avatar-small" title="${m.name}">${initial}</div>`;
            });
            if (members.length > 5) {
                membersHTML += `<div class="member-avatar-small" style="background:#cbd5e1; color:#334155;">+${members.length - 5}</div>`;
            }
        }

        currentTargetSchema = data.columns;

        // --- Render New Layout ---
        mainRender.innerHTML = `
            <div class="target-view-container">
                
                <!-- HEADER -->
                <div class="target-view-header">
                    <div class="header-left">
                        <div style="display:flex; align-items:flex-start; gap:15px;">
                            <button onclick="loadWorkspaceList()" class="back-link" style="margin-top:5px; font-size: 1.2rem; color: #6366f1;">
                                ◀
                            </button>
                            <div>
                                <h2 style="margin:0; line-height:1.2;">${data.targetName || 'targets'}</h2>
                                <button onclick="loadWorkspaceList()" class="back-link">back to workspace</button>
                            </div>
                        </div>
                    </div>
                    <div class="header-right">
                         <div class="member-stack">
                            ${membersHTML}
                         </div>
                         <div class="history-icon" title="History">
                            🕒
                         </div>
                    </div>
                </div>

                <!-- DATE BAR -->
                <div class="date-context-bar">
                    Date
                </div>

                <!-- METRICS TABLE (PROTOTYPE) -->
                <div class="metrics-section">
                    <table class="metrics-table">
                        <thead>
                            <tr>
                                <th>METRIC</th>
                                <th>TARGET</th>
                                <th>CURRENT</th>
                                <th>STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Post Impressions</td>
                                <td>200</td>
                                <td>0 (0%)</td>
                                <td></td>
                            </tr>
                            <tr>
                                <td>Post Engagements</td>
                                <td></td>
                                <td style="color:#64748b;">Assign Target First</td>
                                <td></td>
                            </tr>
                            <tr>
                                <td>Follower Count</td>
                                <td></td>
                                <td style="color:#64748b;">Assign Target First</td>
                                <td></td>
                            </tr>
                            <tr>
                                <td>Call Booked</td>
                                <td></td>
                                <td style="color:#64748b;">Assign Target First</td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- DATA SPREADSHEET SECTION -->
                <div class="spreadsheet-section">
                    <!-- Toolbar (Keep functionality, plain style) -->
                    <div class="toolbar" style="display: flex; gap: 10px; padding: 10px 15px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; border-radius: 8px 8px 0 0;">
                         <span style="font-weight:600; color:#334155; display:flex; align-items:center; margin-right:auto;">Data</span>
                         ${isTeamOrAbove ? `
                         <button onclick="showAddColumnModal()" class="btn-action" style="background: white; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 4px; font-size: 0.85em; cursor: pointer;">+ Column</button>
                         <button onclick="showAddRowModal()" class="btn-action" style="background: white; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 4px; font-size: 0.85em; cursor: pointer;">+ Row</button>
                         ` : ''}
                         <button onclick="refreshTargetData()" class="btn-action" style="background: none; border: none; font-size: 1.1em; cursor: pointer;">↻</button>
                    </div>

                    <div class="table-container" style="overflow-x: auto; max-height: 500px;">
                        <table id="target-data-table" style="width: 100%; border-collapse: collapse; min-width: 600px;">
                            <thead>
                                <tr id="table-header-row" style="background: #e2e8f0; text-align: left; position: sticky; top: 0;">
                                    <!-- Headers injected here -->
                                </tr>
                            </thead>
                            <tbody id="table-body">
                                <!-- Rows injected here -->
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        `;

        renderTargetTable(data.columns, data.rows, isAdminOrOwner);

    } catch (err) {
        console.error("Error loading target view:", err);
        mainRender.innerHTML = `<div class="error-state">Failed to load target data. <button onclick="loadTargetView(${targetId}, ${workspaceId})">Retry</button></div>`;
    }
};

// EDITABLE columns (allowed by PATCH endpoint)
const EDITABLE_COLS = ['impressions', 'engagements', 'followers', 'profile_views', 'calls_booked'];
const SKIP_COLS = ['id', 'created_at', 'managed_by', 'post'];

// ── Context Menu (right-click on rows/headers) ─────────────────────────────
function ensureCtxMenu() {
    if (document.getElementById('table-ctx-menu')) return;
    const div = document.createElement('div');
    div.id = 'table-ctx-menu';
    document.body.appendChild(div);
    // Close on any click outside
    document.addEventListener('click', () => hideCtxMenu(), true);
    document.addEventListener('contextmenu', () => hideCtxMenu(), true);
}

function showCtxMenu(x, y, items) {
    ensureCtxMenu();
    const menu = document.getElementById('table-ctx-menu');
    menu.innerHTML = items.map((item, i) => {
        if (item === 'sep') return `<div class="ctx-sep"></div>`;
        return `<div class="ctx-item${item.danger ? ' danger' : ''}" data-idx="${i}">${item.icon || ''} ${item.label}</div>`;
    }).join('');
    // Position
    menu.style.display = 'block';
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    menu.style.left = (x + mw > window.innerWidth ? x - mw : x) + 'px';
    menu.style.top = (y + mh > window.innerHeight ? y - mh : y) + 'px';
    // Attach click handlers
    menu.querySelectorAll('.ctx-item').forEach(el => {
        const idx = parseInt(el.dataset.idx);
        if (items[idx] && items[idx].action) {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                hideCtxMenu();
                items[idx].action();
            });
        }
    });
}

function hideCtxMenu() {
    const m = document.getElementById('table-ctx-menu');
    if (m) m.style.display = 'none';
}

// ── Context actions ─────────────────────────────────────────────────────────
window.ctxDeleteRow = async function (rowId) {
    const confirmed = await showConfirmModal({
        title: 'Delete Row',
        subtitle: 'This action cannot be undone',
        message: 'Are you sure you want to permanently delete this row and all its data?',
        confirmText: 'Delete Row',
        confirmColor: '#ef4444',
        icon: '🗑️'
    });
    if (!confirmed) return;
    try {
        const res = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/rows/${rowId}?workspaceId=${currentWorkspaceId}`, {
            method: 'DELETE', credentials: 'include'
        });
        if (res.ok) { showToast('Row deleted', 'success'); refreshTargetData(); }
        else showToast('Delete failed', 'error');
    } catch (e) { showToast('Server error', 'error'); }
};


// ─── Custom Modal Helpers ─────────────────────────────────────────────────────

/**
 * showInputModal({ title, subtitle, label, placeholder, defaultValue, inputType, confirmText, icon })
 * Returns a Promise<string|null> — null if cancelled.
 */
function showInputModal({ title, subtitle = '', label = '', placeholder = '', defaultValue = '', inputType = 'text', confirmText = 'Confirm', icon = '✏️' }) {
    return new Promise((resolve) => {
        const id = '_sys_input_modal_' + Date.now();
        const overlay = document.createElement('div');
        overlay.id = id;
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(3px);animation:fadeInOverlay 0.15s ease;';

        overlay.innerHTML = `
            <div style="background:#fff;border-radius:16px;width:400px;max-width:92vw;box-shadow:0 24px 60px rgba(0,0,0,0.18);animation:slideUpModal 0.18s cubic-bezier(.34,1.56,.64,1);">
                <div style="padding:24px 24px 0;">
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">
                        <div style="width:40px;height:40px;border-radius:12px;background:#f0f9ff;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">${icon}</div>
                        <div>
                            <div style="font-weight:700;color:#0f172a;font-size:1rem;line-height:1.3;">${title}</div>
                            ${subtitle ? `<div style="font-size:0.78rem;color:#64748b;margin-top:2px;">${subtitle}</div>` : ''}
                        </div>
                    </div>
                    <hr style="border:none;border-top:1px solid #f1f5f9;margin:16px 0 14px;">
                    ${label ? `<label style="display:block;font-size:0.78rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">${label}</label>` : ''}
                    <input id="${id}_input" type="${inputType}" value="${defaultValue.replace(/"/g, '&quot;')}" placeholder="${placeholder}"
                        style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:0.95rem;color:#1e293b;box-sizing:border-box;outline:none;transition:border-color 0.2s,box-shadow 0.2s;background:#f8fafc;"
                        onfocus="this.style.borderColor='#0ea5e9';this.style.boxShadow='0 0 0 3px #0ea5e920';"
                        onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none';">
                </div>
                <div style="padding:16px 24px 22px;display:flex;justify-content:flex-end;gap:10px;margin-top:4px;">
                    <button id="${id}_cancel" style="padding:9px 18px;background:#f1f5f9;color:#475569;border:none;border-radius:9px;font-size:0.88rem;font-weight:600;cursor:pointer;"
                        onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">Cancel</button>
                    <button id="${id}_ok" style="padding:9px 20px;background:#0ea5e9;color:#fff;border:none;border-radius:9px;font-size:0.88rem;font-weight:600;cursor:pointer;"
                        onmouseover="this.style.background='#0284c7'" onmouseout="this.style.background='#0ea5e9'">${confirmText}</button>
                </div>
            </div>`;

        if (!document.getElementById('_sys_modal_style')) {
            const style = document.createElement('style');
            style.id = '_sys_modal_style';
            style.textContent = `
                @keyframes fadeInOverlay { from{opacity:0} to{opacity:1} }
                @keyframes slideUpModal { from{opacity:0;transform:translateY(12px) scale(0.97)} to{opacity:1;transform:none} }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(overlay);

        const input = document.getElementById(`${id}_input`);
        const cleanup = (val) => { overlay.remove(); resolve(val); };

        input.focus();
        if (inputType === 'text') { input.select(); }

        document.getElementById(`${id}_ok`).addEventListener('click', () => cleanup(input.value));
        document.getElementById(`${id}_cancel`).addEventListener('click', () => cleanup(null));
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') cleanup(input.value);
            if (e.key === 'Escape') cleanup(null);
        });
        overlay.addEventListener('mousedown', e => { if (e.target === overlay) cleanup(null); });
    });
}

/**
 * showConfirmModal({ title, subtitle, message, confirmText, confirmColor, icon })
 * Returns a Promise<boolean>.
 */
function showConfirmModal({ title, subtitle = '', message = '', confirmText = 'Confirm', confirmColor = '#ef4444', icon = '⚠️' }) {
    return new Promise((resolve) => {
        const id = '_sys_confirm_modal_' + Date.now();
        const overlay = document.createElement('div');
        overlay.id = id;
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(3px);animation:fadeInOverlay 0.15s ease;';

        overlay.innerHTML = `
            <div style="background:#fff;border-radius:16px;width:380px;max-width:92vw;box-shadow:0 24px 60px rgba(0,0,0,0.18);animation:slideUpModal 0.18s cubic-bezier(.34,1.56,.64,1);">
                <div style="padding:24px 24px 0;">
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">
                        <div style="width:40px;height:40px;border-radius:12px;background:#fef2f2;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">${icon}</div>
                        <div>
                            <div style="font-weight:700;color:#0f172a;font-size:1rem;">${title}</div>
                            ${subtitle ? `<div style="font-size:0.78rem;color:#64748b;margin-top:2px;">${subtitle}</div>` : ''}
                        </div>
                    </div>
                    ${message ? `<hr style="border:none;border-top:1px solid #f1f5f9;margin:16px 0 12px;"><p style="font-size:0.88rem;color:#475569;line-height:1.55;margin:0;">${message}</p>` : ''}
                </div>
                <div style="padding:16px 24px 22px;display:flex;justify-content:flex-end;gap:10px;margin-top:4px;">
                    <button id="${id}_cancel" style="padding:9px 18px;background:#f1f5f9;color:#475569;border:none;border-radius:9px;font-size:0.88rem;font-weight:600;cursor:pointer;"
                        onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">Cancel</button>
                    <button id="${id}_ok" style="padding:9px 20px;background:${confirmColor};color:#fff;border:none;border-radius:9px;font-size:0.88rem;font-weight:600;cursor:pointer;"
                        onmouseover="this.style.opacity='0.88'" onmouseout="this.style.opacity='1'">${confirmText}</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        const cleanup = (val) => { overlay.remove(); resolve(val); };

        document.getElementById(`${id}_ok`).addEventListener('click', () => cleanup(true));
        document.getElementById(`${id}_cancel`).addEventListener('click', () => cleanup(false));
        document.addEventListener('keydown', function esc(e) {
            if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', esc); }
        });
        overlay.addEventListener('mousedown', e => { if (e.target === overlay) cleanup(false); });
    });
}

// ─── Row / Column Context Actions ─────────────────────────────────────────────

// Add Row Above: date = rowDate - 1 day
window.ctxAddRowAbove = async function (rowDate) {
    const d = new Date(rowDate);
    d.setDate(d.getDate() - 1);
    const suggested = d.toISOString().split('T')[0];
    const dateVal = await showInputModal({
        title: 'Add Row Above',
        subtitle: 'Insert a new row before the selected date',
        label: 'Date',
        placeholder: 'YYYY-MM-DD',
        defaultValue: suggested,
        inputType: 'date',
        confirmText: 'Add Row',
        icon: '↑'
    });
    if (!dateVal || !dateVal.trim()) return;
    await _postRow(dateVal.trim());
};

// Add Row Below: date = rowDate + 1 day
window.ctxAddRowBelow = async function (rowDate) {
    const d = new Date(rowDate);
    d.setDate(d.getDate() + 1);
    const suggested = d.toISOString().split('T')[0];
    const dateVal = await showInputModal({
        title: 'Add Row Below',
        subtitle: 'Insert a new row after the selected date',
        label: 'Date',
        placeholder: 'YYYY-MM-DD',
        defaultValue: suggested,
        inputType: 'date',
        confirmText: 'Add Row',
        icon: '↓'
    });
    if (!dateVal || !dateVal.trim()) return;
    await _postRow(dateVal.trim());
};

async function _postRow(dateVal) {
    try {
        const res = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/rows?workspaceId=${currentWorkspaceId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ date: dateVal })
        });
        if (res.ok) { showToast('Row added!', 'success'); refreshTargetData(); }
        else { const d = await res.json(); showToast(d.message || 'Failed', 'error'); }
    } catch (e) { showToast('Server error', 'error'); }
}

window.ctxEditDate = async function (rowId, currentDate) {
    const newDate = await showInputModal({
        title: 'Edit Row Date',
        subtitle: 'Change the date for this row',
        label: 'New Date',
        placeholder: 'YYYY-MM-DD',
        defaultValue: currentDate || '',
        inputType: 'date',
        confirmText: 'Update Date',
        icon: '📅'
    });
    if (!newDate || newDate === currentDate) return;
    try {
        const res = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/rows/${rowId}?workspaceId=${currentWorkspaceId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ field: 'date', value: newDate })
        });
        if (res.ok) { showToast('Date updated', 'success'); refreshTargetData(); }
        else showToast('Update failed', 'error');
    } catch (e) { showToast('Server error', 'error'); }
};

// Column order helpers — stored in localStorage keyed by targetId
function getColOrder() {
    try { return JSON.parse(localStorage.getItem(`colOrder_${currentTargetId}`) || 'null'); } catch (e) { return null; }
}
function setColOrder(order) {
    localStorage.setItem(`colOrder_${currentTargetId}`, JSON.stringify(order));
}
function applyColOrder(columns) {
    const order = getColOrder();
    if (!order || order.length === 0) return columns;
    const byName = Object.fromEntries(columns.map(c => [c.name, c]));
    const sorted = order.filter(n => byName[n]).map(n => byName[n]);
    const remaining = columns.filter(c => !order.includes(c.name));
    return [...sorted, ...remaining];
}

// Add Column Left of <anchorCol>
window.ctxAddColumnLeft = async function (anchorCol) {
    const name = await showInputModal({
        title: 'Add Column to the Left',
        subtitle: `Inserting before "${anchorCol.replace(/_/g, ' ')}"`,
        label: 'Column Name',
        placeholder: 'e.g. Conversions',
        confirmText: 'Add Column',
        icon: '←'
    });
    if (!name || !name.trim()) return;
    await _postColumn(name.trim(), anchorCol, 'left');
};

// Add Column Right of <anchorCol>
window.ctxAddColumnRight = async function (anchorCol) {
    const name = await showInputModal({
        title: 'Add Column to the Right',
        subtitle: `Inserting after "${anchorCol.replace(/_/g, ' ')}"`,
        label: 'Column Name',
        placeholder: 'e.g. Conversions',
        confirmText: 'Add Column',
        icon: '→'
    });
    if (!name || !name.trim()) return;
    await _postColumn(name.trim(), anchorCol, 'right');
};

async function _postColumn(name, anchorCol, side) {
    try {
        const res = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/columns?workspaceId=${currentWorkspaceId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, type: 'TEXT' })
        });
        if (!res.ok) { const d = await res.json(); showToast(d.message || 'Failed', 'error'); return; }
        // Update display order
        const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
        const order = getColOrder() || currentTargetSchema.map(c => c.name).filter(n => !SKIP_COLS.includes(n));
        const anchorIdx = order.indexOf(anchorCol);
        if (anchorIdx >= 0) {
            order.splice(side === 'left' ? anchorIdx : anchorIdx + 1, 0, safeName);
        } else {
            order.push(safeName);
        }
        setColOrder(order);
        showToast('Column added!', 'success');
        refreshTargetData();
    } catch (e) { showToast('Server error', 'error'); }
}

window.ctxRenameColumn = async function (colName) {
    const friendly = colName.replace(/_/g, ' ');
    const newName = await showInputModal({
        title: 'Rename Column',
        subtitle: `Currently: "${friendly}"`,
        label: 'New Column Name',
        placeholder: friendly,
        defaultValue: friendly,
        confirmText: 'Rename',
        icon: '✏️'
    });
    if (!newName || newName.trim() === '') return;
    try {
        const res = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/columns/${colName}?workspaceId=${currentWorkspaceId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ newName: newName.trim() })
        });
        if (res.ok) {
            const safeNew = newName.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
            // Update localStorage order
            const order = getColOrder();
            if (order) {
                const idx = order.indexOf(colName);
                if (idx >= 0) order[idx] = safeNew;
                setColOrder(order);
            }
            // Sync label in __allMetrics__ (bi-directional)
            try {
                const { goals } = await getOrInitAllMetrics();
                const m = goals.__allMetrics__.find(x => x.key === colName);
                if (m) { m.label = newName.trim(); m.key = safeNew; }
                await saveGoals(goals);
            } catch (_) { /* don't block on this */ }
            showToast('Column renamed', 'success'); refreshTargetData();
        }
        else { const d = await res.json(); showToast(d.message || 'Failed', 'error'); }
    } catch (e) { showToast('Server error', 'error'); }
};

window.ctxDeleteColumn = async function (colName) {
    const friendly = colName.replace(/_/g, ' ');
    const confirmed = await showConfirmModal({
        title: 'Delete Column',
        subtitle: `"${friendly}"`,
        message: `This will permanently delete the <strong>${friendly}</strong> column and all its data. This action cannot be undone.`,
        confirmText: 'Delete Column',
        confirmColor: '#ef4444',
        icon: '🗑️'
    });
    if (!confirmed) return;
    try {
        const res = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/columns/${colName}?workspaceId=${currentWorkspaceId}`, {
            method: 'DELETE', credentials: 'include'
        });
        if (res.ok) {
            // Update localStorage order
            const order = getColOrder();
            if (order) { setColOrder(order.filter(n => n !== colName)); }
            // Also remove from __allMetrics__ (bi-directional)
            try {
                const { goals } = await getOrInitAllMetrics();
                goals.__allMetrics__ = goals.__allMetrics__.filter(m => m.key !== colName);
                await saveGoals(goals);
            } catch (_) { /* don't block */ }
            showToast('Column deleted', 'success'); refreshTargetData();
        }
        else { const d = await res.json(); showToast(d.message || 'Failed', 'error'); }
    } catch (e) { showToast('Server error', 'error'); }
};




async function _postRow(dateVal) {
    try {
        const res = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/rows?workspaceId=${currentWorkspaceId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ date: dateVal })
        });
        if (res.ok) { showToast('Row added!', 'success'); refreshTargetData(); }
        else { const d = await res.json(); showToast(d.message || 'Failed', 'error'); }
    } catch (e) { showToast('Server error', 'error'); }
}



function renderTargetTable(columns, rows, isAdminOrOwner) {
    const thead = document.getElementById('table-header-row');
    const tbody = document.getElementById('table-body');
    if (!thead || !tbody) return;

    // This function is called from both the legacy and new loadTargetView
    // isAdminOrOwner can be passed in or derived from window.userRole
    if (isAdminOrOwner === undefined) {
        const _role = (window.userRole || 'client').toLowerCase();
        isAdminOrOwner = ['owner', 'ceo', 'admin'].includes(_role);
    }

    // Apply saved display order (from localStorage)
    columns = applyColOrder(columns);

    // COLUMN LABELS (human-friendly)
    const COL_LABELS = {
        date: 'Date',
        impressions: 'Impressions', engagements: 'Engagements',
        followers: 'Followers', profile_views: 'Profile Views', calls_booked: 'Calls Booked'
    };

    // Headers
    let headerHTML = '<th style="padding:10px 14px; font-weight:700; color:#475569; font-size:0.85em; text-transform:uppercase; letter-spacing:0.05em; white-space:nowrap;">#</th>';
    const thObjects = []; // track col names for right-click
    columns.forEach(col => {
        if (SKIP_COLS.includes(col.name)) return;
        const label = COL_LABELS[col.name] || col.name.replace(/_/g, ' ');
        const isProtected = ['date'].includes(col.name);
        headerHTML += `<th data-col="${col.name}" style="padding:10px 14px; font-weight:700; color:#475569; font-size:0.85em; text-transform:uppercase; letter-spacing:0.05em; white-space:nowrap; cursor:${isAdminOrOwner && !isProtected ? 'context-menu' : 'default'};">${label}</th>`;
        thObjects.push({ name: col.name, protected: isProtected });
    });
    if (isAdminOrOwner) {
        headerHTML += '<th style="text-align:right; padding:10px 14px; color:#475569; font-size:0.85em;"></th>';
    }
    thead.innerHTML = headerHTML;

    // Rows
    tbody.innerHTML = '';
    if (!rows || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${columns.length + 2}" style="text-align:center; color:#94a3b8; padding:40px;">No rows yet.</td></tr>`;
        return;
    }

    rows.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.style.cssText = 'border-bottom: 1px solid #f1f5f9; transition: background 0.15s;';
        tr.onmouseenter = () => tr.style.background = '#f8fafc';
        tr.onmouseleave = () => tr.style.background = '';

        // Row number
        let html = `<td style="padding:10px 14px; color:#94a3b8; font-size:0.85em; text-align:center; min-width:36px;">${idx + 1}</td>`;

        columns.forEach(col => {
            if (SKIP_COLS.includes(col.name)) return;

            const rawVal = row[col.name];
            const isDate = col.name === 'date';
            // All non-date, non-skip columns are editable (built-ins + custom)
            const isEditable = !isDate;
            const isNumeric = ['impressions', 'engagements', 'followers', 'profile_views', 'calls_booked'].includes(col.name);

            if (isDate) {
                // Date: display nicely, read-only
                let displayDate = rawVal || '';
                try { displayDate = new Date(rawVal).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); } catch (e) { }
                html += `<td style="padding:10px 14px; color:#334155; font-size:0.9em; font-weight:600; white-space:nowrap;">${displayDate}</td>`;
            } else if (isEditable) {
                const role = (window.userRole || 'client').toLowerCase();
                const canEditCell = ['owner', 'ceo', 'admin'].includes(role);

                const dispVal = (rawVal !== null && rawVal !== undefined) ? String(rawVal) : (isNumeric ? '0' : '');
                const textColor = isNumeric && (rawVal === 0 || rawVal === null || rawVal === undefined) ? '#94a3b8' : '#334155';

                html += `<td style="padding:4px 8px; min-width:80px;">
                    <span contenteditable="${canEditCell}"
                        data-row-id="${row.id}" data-field="${col.name}" data-orig="${dispVal}"
                        style="display:block; padding:6px 10px; border:1px solid transparent; border-radius:4px; min-height:28px; outline:none; font-size:0.9em; color:${textColor}; cursor:${canEditCell ? 'text' : 'default'}; transition: border 0.15s;"
                        onfocus="if(!${canEditCell})return; this.style.border='1px solid #6366f1'; this.style.background='#fafafa'; if(this.textContent==='0' && ${isNumeric}){this.textContent=''; this.style.color='#334155';}"
                        onblur="if(!${canEditCell})return; if(this.textContent.trim()==='' && ${isNumeric}){this.textContent='0'; this.style.color='#94a3b8';} saveCellEdit(this);"
                        onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">  ${dispVal}</span>
                </td>`;
            }
        });



        tr.innerHTML = html;

        // Right-click on row → Add Row Above / Add Row Below / Edit Date / Delete
        const role = (window.userRole || 'client').toLowerCase();
        const canManageRow = ['owner', 'ceo', 'admin'].includes(role);

        if (canManageRow) {
            tr.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const rowDate = row.date || new Date().toISOString().split('T')[0];
                const items = [
                    { icon: '↑', label: 'Add Row Above', action: () => ctxAddRowAbove(rowDate) },
                    { icon: '↓', label: 'Add Row Below', action: () => ctxAddRowBelow(rowDate) },
                    'sep',
                    { icon: '✏️', label: 'Edit Date', action: () => ctxEditDate(row.id, rowDate) },
                    { icon: '🗑️', label: 'Delete Row', danger: true, action: () => ctxDeleteRow(row.id) }
                ];
                showCtxMenu(e.clientX, e.clientY, items);
            });
        }

        tbody.appendChild(tr);
    });

    // Right-click on column headers → Add Left/Right / Rename / Delete
    if (isAdminOrOwner) {
        thead.querySelectorAll('th[data-col]').forEach(th => {
            const colName = th.dataset.col;
            if (colName === 'date') return; // protected
            th.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const items = [
                    { icon: '←', label: 'Add Column Left', action: () => ctxAddColumnLeft(colName) },
                    { icon: '→', label: 'Add Column Right', action: () => ctxAddColumnRight(colName) },
                    'sep',
                    { icon: '✏️', label: 'Rename Column', action: () => ctxRenameColumn(colName) },
                    { icon: '🗑️', label: 'Delete Column', danger: true, action: () => ctxDeleteColumn(colName) }
                ];
                showCtxMenu(e.clientX, e.clientY, items);
            });
        });

        // Right-click on empty area of the table (tbody background)
        const tbl = document.getElementById('target-data-table');
        if (tbl) {
            tbl.addEventListener('contextmenu', (e) => {
                if (e.target.closest('tr') || e.target.closest('th')) return; // handled above
                e.preventDefault();
                const items = [
                    { icon: '➕', label: 'Add Row', action: () => ctxAddRow() },
                    { icon: '➕', label: 'Add Column', action: () => ctxAddColumn() }
                ];
                showCtxMenu(e.clientX, e.clientY, items);
            });
        }
    }
}

window.deleteTargetRow = async function (rowId) {
    const confirmed = await showConfirmModal({
        title: 'Delete Row',
        subtitle: 'This action cannot be undone',
        message: 'Are you sure you want to permanently delete this row and all its data?',
        confirmText: 'Delete Row',
        confirmColor: '#ef4444',
        icon: '🗑️'
    });
    if (!confirmed) return;
    try {
        const res = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/rows/${rowId}?workspaceId=${currentWorkspaceId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (res.ok) {
            refreshTargetData();
        } else {
            const err = await res.json();
            showToast('Failed to delete: ' + (err.message || 'Unknown error'), 'error');
        }
    } catch (e) {
        console.error('Delete row error:', e);
        showToast('Server error deleting row', 'error');
    }
};


// Inline cell save function — called by contenteditable onblur
window.saveCellEdit = async function (spanEl) {
    const rowId = spanEl.dataset.rowId;
    const field = spanEl.dataset.field;
    const origVal = spanEl.dataset.orig;
    const newVal = spanEl.textContent.trim();

    // Reset visual state
    spanEl.style.border = '1px solid transparent';
    spanEl.style.background = '';

    // Skip if unchanged
    if (newVal === origVal) return;

    try {
        const res = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/rows/${rowId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ field, value: newVal }),
            credentials: 'include'
        });

        if (res.ok) {
            spanEl.dataset.orig = newVal; // Update baseline for future change detection
            // Tiny save flash
            spanEl.style.background = '#f0fdf4';
            spanEl.style.border = '1px solid #86efac';
            setTimeout(() => {
                spanEl.style.background = '';
                spanEl.style.border = '1px solid transparent';
            }, 1000);
            // Refresh metrics panel to reflect new sums without full page reload
            doMetricsRefresh();
        } else {
            showToast('Failed to save cell', 'error');
            spanEl.textContent = origVal; // Revert
        }
    } catch (e) {
        console.error('Cell save error:', e);
        spanEl.textContent = origVal;
    }
};

// Lightweight metrics-only refresh (after cell edits)
async function doMetricsRefresh() {
    if (!currentTargetId || !currentWorkspaceId) return;
    try {
        const res = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/data?workspaceId=${currentWorkspaceId}`, { credentials: 'include' });
        const data = await res.json();
        if (!data || !data.rows) return;

        let goalsConfig = {};
        try { goalsConfig = data.goals ? JSON.parse(data.goals) : {}; } catch (e) { }

        // Build key map from __allMetrics__ (handles both defaults & customs)
        const DEFAULT_METRICS = [
            { label: 'Post Impressions', key: 'impressions' },
            { label: 'Post Engagements', key: 'engagements' },
            { label: 'Follower Count', key: 'followers' },
            { label: 'Profile Views', key: 'profile_views' },
            { label: 'Calls Booked', key: 'calls_booked' },
        ];
        const allMetrics = (Array.isArray(goalsConfig.__allMetrics__) && goalsConfig.__allMetrics__.length > 0)
            ? goalsConfig.__allMetrics__
            : [...DEFAULT_METRICS, ...(Array.isArray(goalsConfig.__metrics__) ? goalsConfig.__metrics__ : [])];

        const metricMap = {};
        allMetrics.forEach(m => { metricMap[m.label] = m.key; });

        // Update each metric row without full re-render
        const rows = document.querySelectorAll('.metrics-table tbody tr');
        rows.forEach(tr => {
            const labelEl = tr.cells[0];
            if (!labelEl) return;
            const label = (labelEl.firstChild && labelEl.firstChild.nodeType === 3)
                ? labelEl.firstChild.textContent.trim()
                : labelEl.textContent.trim();
            const colKey = metricMap[label];
            if (!colKey) return;
            const current = data.rows.reduce((s, r) => s + (parseFloat(r[colKey]) || 0), 0);
            const targetVal = parseFloat(goalsConfig[label]) || 0;
            // Columns: 0=label, 1=target input, 2=daily, 3=current, 4=status
            if (tr.cells[3]) tr.cells[3].textContent = current > 0 ? current.toLocaleString() : '0';
            if (tr.cells[4] && targetVal > 0) {
                const pct = Math.round((current / targetVal) * 100);
                const color = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';
                const emoji = pct >= 80 ? '🟢' : pct >= 50 ? '🟡' : '🔴';
                tr.cells[4].innerHTML = `<span style="font-weight:700; color:${color};">${emoji} ${pct}%</span>`;
            }
        });
    } catch (e) { /* silent */ }
}



// target-view.js logic adapted to global scope
window.refreshTargetData = function () {
    if (currentTargetId && currentWorkspaceId) {
        loadTargetView(currentTargetId, currentWorkspaceId);
    }
};

// We need to inject the specific modals for Target View into the DOM if they aren't there, 
// OR reuse/adapt existing modals. 
// For simplicity, let's assume we need to add the "Add Row" and "Add Column" modals to index.html or dashboard.html dynamically or permanently.
// A cleaner approach for this SPA pivot: inject modls into the DOM when view loads, OR check if they exist.

// Let's modify loadTargetView to also inject the modals at the bottom of mainRender content if not handling global modals
// Actually, let's just append them to body or rendering container if they don't exist.
// Since dashboard.html is static, we can't easily edit it blindly. 
// We will create the modals dynamically in JS.

function injectTargetModals() {
    if (document.getElementById('spa-add-row-modal')) return;

    const modalHTML = `
        <div id="spa-add-row-modal" class="modal">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>➕ Add New Entry</h3>
                    <span class="close-btn" onclick="closeSpaModals()">&times;</span>
                </div>
                <div id="spa-add-row-inputs" style="max-height: 60vh; overflow-y: auto; padding: 20px;"></div>
                <div class="modal-footer">
                    <button onclick="closeSpaModals()" class="btn-cancel">Cancel</button>
                    <button onclick="submitTargetRow()" class="btn-save" style="background: #0ea5e9;">Save Entry</button>
                </div>
            </div>
        </div>

        <div id="spa-add-col-modal" class="modal">
            <div class="modal-content" style="max-width: 440px;">
                <div class="modal-header">
                    <h3>📊 Add New Column</h3>
                    <span class="close-btn" onclick="closeSpaModals()">&times;</span>
                </div>
                <div style="padding: 20px; display: flex; flex-direction: column; gap: 16px;">
                    <div class="input-group">
                        <label style="font-weight: 700; color: #1e293b;">Column Name</label>
                        <input type="text" id="spa-new-col-name" placeholder="e.g. Revenue, Status"
                            style="width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box;">
                    </div>
                    <div class="input-group">
                        <label style="font-weight: 700; color: #1e293b;">Data Type</label>
                        <select id="spa-new-col-type" style="width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; background: white;">
                            <option value="TEXT">Text</option>
                            <option value="REAL">Number</option>
                            <option value="DATE">Date</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="closeSpaModals()" class="btn-cancel">Cancel</button>
                    <button onclick="submitTargetColumn()" class="btn-save" style="background: #10b981;">Add Column</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Date Row Modal — quick way to add an extra row with a custom date
    const dateRowModalHTML = `
        <div id="spa-add-date-row-modal" class="modal">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>📅 Add Date Entry</h3>
                    <span class="close-btn" onclick="document.getElementById('spa-add-date-row-modal').style.display='none'">&times;</span>
                </div>
                <div style="padding: 20px; display: flex; flex-direction: column; gap: 16px;">
                    <div class="input-group">
                        <label style="font-weight: 700; color: #1e293b;">Date</label>
                        <input type="date" id="spa-daterow-date"
                            style="width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box;">
                    </div>
                    <div class="input-group">
                        <label style="font-weight: 700; color: #1e293b;">Managed By <span style="font-weight: 400; color: #94a3b8;">(optional)</span></label>
                        <input type="text" id="spa-daterow-managed" placeholder="e.g. Josh"
                            style="width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box;">
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="document.getElementById('spa-add-date-row-modal').style.display='none'" class="btn-cancel">Cancel</button>
                    <button onclick="submitTargetDateRow()" class="btn-save" style="background: #6366f1;">Add Row</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', dateRowModalHTML);
}

// Call this once on load or within loadTargetView
try {
    injectTargetModals();
} catch (e) {
    console.warn("DOM not ready for modals yet");
}

window.showAddRowModal = function () {
    console.log('[AddRow] currentTargetSchema:', currentTargetSchema, '| targetId:', currentTargetId, '| wsId:', currentWorkspaceId);

    if (!currentTargetSchema || !Array.isArray(currentTargetSchema)) {
        showToast('Table schema not loaded. Please wait or refresh.', 'warning');
        return;
    }

    const userColumns = currentTargetSchema.filter(c => c.name !== 'id' && c.name !== 'created_at');
    if (userColumns.length === 0) {
        showToast('No columns found. Please add a column first.', 'warning');
        return;
    }

    const container = document.getElementById('spa-add-row-inputs');
    if (!container) {
        console.error('[AddRow] Container spa-add-row-inputs not found!');
        injectTargetModals(); // Emergency re-inject
        return;
    }

    container.innerHTML = '';

    userColumns.forEach(col => {
        let inputType = 'text';
        if (col.type === 'REAL' || col.type === 'INTEGER') inputType = 'number';
        if (col.type === 'DATE') inputType = 'date';

        container.innerHTML += `
            <div class="input-group" style="margin-bottom: 20px;">
                <label style="display:block; margin-bottom: 8px; font-weight: 700; color: #1e293b;">${col.name.replace(/_/g, ' ').toUpperCase()}</label>
                <input type="${inputType}" name="${col.name}" 
                    style="width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; outline: none; transition: border-color 0.2s;"
                    onfocus="this.style.borderColor='#0ea5e9'" onblur="this.style.borderColor='#cbd5e1'">
            </div>
        `;
    });

    const modal = document.getElementById('spa-add-row-modal');
    if (modal) modal.style.display = 'block';
};

window.showAddColumnModal = function () {
    document.getElementById('spa-add-col-modal').style.display = 'block';
};

window.showAddDateRowModal = function () {
    const modal = document.getElementById('spa-add-date-row-modal');
    if (!modal) { injectTargetModals(); }
    // Default to today
    const d = document.getElementById('spa-daterow-date');
    if (d && !d.value) d.value = new Date().toISOString().split('T')[0];
    document.getElementById('spa-add-date-row-modal').style.display = 'block';
};

window.submitTargetDateRow = async function () {
    const dateVal = document.getElementById('spa-daterow-date')?.value;
    const managedBy = document.getElementById('spa-daterow-managed')?.value || '';
    if (!dateVal) { showToast('Please pick a date', 'warning'); return; }
    try {
        const res = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/rows?workspaceId=${currentWorkspaceId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ date: dateVal, managed_by: managedBy })
        });
        if (res.ok) {
            document.getElementById('spa-add-date-row-modal').style.display = 'none';
            document.getElementById('spa-daterow-date').value = '';
            document.getElementById('spa-daterow-managed').value = '';
            showToast('Row added!', 'success');
            refreshTargetData();
        } else {
            const err = await res.json();
            showToast('Failed: ' + (err.message || 'Error'), 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Server error', 'error');
    }
};

window.closeSpaModals = function () {
    document.getElementById('spa-add-row-modal').style.display = 'none';
    document.getElementById('spa-add-col-modal').style.display = 'none';
};

window.submitTargetRow = async function () {
    console.log('[SubmitRow] Attempting save for target:', currentTargetId, '| wsId:', currentWorkspaceId);
    const inputs = document.querySelectorAll('#spa-add-row-inputs input');
    const rowData = {};
    inputs.forEach(input => {
        rowData[input.name] = input.value;
    });

    try {
        const response = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/rows?workspaceId=${currentWorkspaceId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(rowData)
        });

        if (response.ok) {
            console.log('[SubmitRow] Success');
            closeSpaModals();
            refreshTargetData();
            showToast('Row added successfully!', 'success');
        } else {
            const errData = await response.json().catch(() => ({}));
            console.error('[SubmitRow] API Error:', errData);
            showToast('Failed to add entry: ' + (errData.message || response.status), 'error');
        }
    } catch (err) {
        console.error('[SubmitRow] Network Error:', err);
        showToast('Network error: ' + err.message, 'error');
    }
};

window.submitTargetColumn = async function () {
    const name = document.getElementById('spa-new-col-name').value.trim();
    const type = document.getElementById('spa-new-col-type').value;
    console.log('[SubmitCol] name:', name, '| type:', type, '| targetId:', currentTargetId, '| wsId:', currentWorkspaceId);

    if (!name) return showToast('Column name required', 'warning');

    try {
        const response = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/columns?workspaceId=${currentWorkspaceId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, type })
        });

        if (response.ok) {
            console.log('[SubmitCol] Success');
            closeSpaModals();
            refreshTargetData();
            document.getElementById('spa-new-col-name').value = '';
            showToast('Column added!', 'success');
        } else {
            const data = await response.json().catch(() => ({}));
            console.error('[SubmitCol] API Error:', data);
            showToast('Failed to add column: ' + (data.message || response.status), 'error');
        }
    } catch (err) {
        console.error('[SubmitCol] Network Error:', err);
        showToast('Network error: ' + err.message, 'error');
    }
};

window.deleteTargetRow = async function (rowId) {
    if (!confirm('Are you sure you want to delete this row?')) return;
    try {
        const response = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/rows/${rowId}?workspaceId=${currentWorkspaceId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (response.ok) {
            refreshTargetData();
        } else {
            alert('Failed to delete row');
        }
    } catch (err) {
        alert('Server error');
    }
};

/**
 * Toast Notification System
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
    return container;
}

/**
 * Selection function (unified naming)
 */
function selectTarget(id, element) {
    // UI: Clear previous selection
    document.querySelectorAll('tr').forEach(r => r.classList.remove('selected-row'));

    // UI: Highlight current selection
    element.classList.add('selected-row');

    // DATA: Store ID
    selectedTargetId = id;
}


/**
 * Load Admin Panel
 */
function loadAdminPanel() {
    currentViewContext = { name: 'user_mgmt', params: { roleFilter: 'admin' } };
    loadUserMgmt('admin');
}

/**
 * Renders the User Management table for Owner/Admin
 * @param {string} roleFilter - 'admin', 'team', or 'client'
 */
async function loadUserMgmt(roleFilter) {
    const container = document.getElementById('main-render');
    const title = document.getElementById('view-title');

    currentRoleFilter = roleFilter; // Store for refresh
    currentViewContext = { name: 'user_mgmt', params: { roleFilter } };
    title.textContent = `Managing ${roleFilter.toUpperCase()}S`;

    // Show loading spinner
    container.innerHTML = '<div class="loader-overlay"><div class="spinner"></div></div>';

    try {
        const response = await fetch(window.API_BASE + `/api/users?role=${roleFilter}&t=${Date.now()}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch users');
        }

        const users = await response.json();
        console.log(`[loadUserMgmt] Fetched ${users.length} users for role: ${roleFilter}`);
        console.log('User Data:', users);

        // Build the table with Role Switcher
        const role = window.userRole || 'client';
        const isCEO = role === 'owner' || role === 'ceo';
        const isAdmin = isCEO || role === 'admin';

        let tableHTML = `
        <div class="access-nav" style="margin-bottom: 25px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
            ${isCEO ? `<button data-tab="admin" class="tab-btn ${roleFilter === 'admin' ? 'active' : ''}" style="padding: 8px 16px; border-radius: 6px; border: 1px solid #e2e8f0; background: ${roleFilter === 'admin' ? '#0ea5e9' : 'white'}; color: ${roleFilter === 'admin' ? 'white' : '#64748b'}; cursor: pointer;">Admins</button>` : ''}
            <button data-tab="team" class="tab-btn ${roleFilter === 'team' ? 'active' : ''}" style="padding: 8px 16px; border-radius: 6px; border: 1px solid #e2e8f0; background: ${roleFilter === 'team' ? '#0ea5e9' : 'white'}; color: ${roleFilter === 'team' ? 'white' : '#64748b'}; cursor: pointer;">Team</button>
            <button data-tab="client" class="tab-btn ${roleFilter === 'client' ? 'active' : ''}" style="padding: 8px 16px; border-radius: 6px; border: 1px solid #e2e8f0; background: ${roleFilter === 'client' ? '#0ea5e9' : 'white'}; color: ${roleFilter === 'client' ? 'white' : '#64748b'}; cursor: pointer;">Clients</button>
            
            <button class="btn-add" data-role="${roleFilter}" style="margin-left: auto; padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; display: ${isAdmin ? 'block' : 'none'};">+ Register ${roleFilter.toUpperCase()}</button>
        </div>

        <table class="data-table" style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                <thead style="background: #f8fafc;">
                    <tr>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">ID</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">Full Name</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">Email</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">Role</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">Status</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">Failed Attempts</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">Action</th>
                    </tr>
                </thead>
                <tbody>
        `;

        users.forEach(user => {
            tableHTML += `
                <tr onclick="selectTarget(${user.id}, this)" style="cursor: pointer; transition: background 0.2s;">
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${user.id}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${user.name || 'N/A'}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${user.email}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;"><span class="badge" style="background: #e0f2fe; color: #0369a1; padding: 4px 8px; border-radius: 4px; font-size: 0.85em;">${user.role.toUpperCase()}</span></td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
                        <label class="status-switch">
                            <input type="checkbox" class="status-toggle-checkbox" data-user-id="${user.id}" ${user.status && user.status.toLowerCase() === 'blocked' ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                        <span class="status-text" data-user-id="${user.id}" style="font-size: 0.8em; margin-left: 8px; font-weight: 600; color: ${user.status && user.status.toLowerCase() === 'blocked' ? '#dc2626' : '#16a34a'};">
                            ${user.status && user.status.toLowerCase() === 'blocked' ? 'Blocked' : 'Active'}
                        </span>
                    </td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${user.failed_attempts || 0}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
                         <button class="btn-delete-row" data-id="${user.id}" style="padding: 6px 12px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8em;">Delete</button>
                    </td>
                </tr>
            `;
        });

        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;

        // Add event delegation for toggle switches
        const toggleCheckboxes = container.querySelectorAll('.status-toggle-checkbox');
        toggleCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function (e) {
                e.stopPropagation(); // Prevent row click
                const userId = parseInt(this.dataset.userId);
                console.log(`[Toggle Event] Fired for user ${userId}, checked: ${this.checked}`);
                toggleUserStatusDirect(userId, this);
            });
        });

    } catch (err) {
        container.innerHTML = `<p class="error" style="color: #ef4444; padding: 20px; background: #fef2f2; border-radius: 8px;">Failed to load users. Please check your connection or authorization.</p>`;
        showToast('Error loading users', 'error');
    }
}

// Event Delegation for Dynamic Content
document.addEventListener('click', (e) => {
    // Check for Add User Button
    if (e.target && e.target.classList.contains('btn-add')) {
        e.preventDefault();
        const role = e.target.getAttribute('data-role');
        if (role) {
            console.log('Delegate Click: Opening modal for', role);
            openAddUserModal(role);
        }
    }

    // Check for Tab Buttons (Role Switcher)
    if (e.target && e.target.classList.contains('tab-btn')) {
        e.preventDefault();
        const tab = e.target.getAttribute('data-tab');
        if (tab) {
            console.log('Delegate Click: Switching role tab to', tab);
            // Visual update handled by re-render, but let's log it
            loadUserMgmt(tab);
        }
    }

    // Check for Delete User Buttons
    if (e.target && (e.target.classList.contains('btn-delete-row') || e.target.closest('.btn-delete-row'))) {
        e.preventDefault();
        e.stopPropagation(); // Stop row selection
        const btn = e.target.classList.contains('btn-delete-row') ? e.target : e.target.closest('.btn-delete-row');
        const userId = btn.getAttribute('data-id');
        if (userId) {
            console.log('Delegate Click: Deleting user', userId);
            deleteUser(userId);
        }
    }

    // Check for Close Buttons
    if (e.target && (e.target.classList.contains('close-btn') || e.target.closest('.close-btn'))) {
        e.preventDefault();
        toggleUserModal(false);
        // Also close workspace modal if open
        const wsModal = document.getElementById('workspace-modal');
        if (wsModal) wsModal.style.display = 'none';

        // Also close reset modal
        const resetModal = document.getElementById('resetPasswordModal');
        if (resetModal) resetModal.style.display = 'none';
    }

    // Check for Modal Backdrop Click (to close)
    // DISABLED at user request: Only close via 'X' or Cancel button
    /*
    if (e.target && e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
    */

    // Check for Create Account Button (Event Delegation)
    if (e.target && e.target.id === 'btn-create-user') {
        e.preventDefault();
        console.log('Delegate Click: Create Account Button');
        submitUserRegistration();
    }

    // Check for Cancel Delete Button
    if (e.target && e.target.classList.contains('btn-cancel-delete')) {
        e.preventDefault();
        console.log('Delegate Click: Cancel Delete');
        closeDeleteConfirm();
    }

    // Check for Confirm Delete Button
    if (e.target && e.target.id === 'btn-confirm-delete') {
        e.preventDefault();
        console.log('Delegate Click: Confirm Delete');
        confirmDeleteUser();
    }

    // Check for Cancel Workspace Delete Button
    if (e.target && e.target.classList.contains('btn-cancel-ws-delete')) {
        e.preventDefault();
        console.log('Delegate Click: Cancel Workspace Delete');
        closeWsDeleteConfirm();
    }

    // Check for Confirm Workspace Delete Button
    if (e.target && e.target.id === 'btn-confirm-ws-delete') {
        e.preventDefault();
        console.log('Delegate Click: Confirm Workspace Delete');
        confirmDeleteWorkspace();
    }



    // Check for Cancel Target Button
    if (e.target && e.target.classList.contains('btn-cancel-target')) {
        e.preventDefault();
        closeAddTargetModal();
    }

    // Check for Confirm Target Button
    if (e.target && e.target.id === 'btn-submit-target') {
        e.preventDefault();
        submitNewTarget();
    }

    // Check for Create Sub-Target Button (Legacy)
    if (e.target && e.target.id === 'btn-create-sub-target') {
        e.preventDefault();
        submitNewTarget();
    }

    // Check for Commit Workspace Button
    if (e.target && e.target.id === 'btn-submit-workspace') {
        e.preventDefault();
        submitNewWorkspace();
    }

});

/**
 * Workspace Target Management
 */
let pendingTargetWorkspaceId = null;

function openAddTargetModal(wsId) {
    pendingTargetWorkspaceId = wsId;
    const modal = document.getElementById('addTargetModal');
    if (modal) modal.style.display = 'block';
    // Default: From = today, To = today+6 (one week)
    const today = new Date().toISOString().split('T')[0];
    const endDefault = new Date();
    endDefault.setDate(endDefault.getDate() + 6);
    const endDefaultStr = endDefault.toISOString().split('T')[0];
    const startInput = document.getElementById('new-target-startdate');
    const endInput = document.getElementById('new-target-enddate');
    if (startInput) startInput.value = today;
    if (endInput) endInput.value = endDefaultStr;
    updateTargetDaysPreview();
}

window.updateTargetDaysPreview = function () {
    const start = document.getElementById('new-target-startdate')?.value;
    const end = document.getElementById('new-target-enddate')?.value;
    const preview = document.getElementById('target-days-preview');
    const count = document.getElementById('target-days-count');
    if (!start || !end || !preview || !count) return;
    const s = new Date(start), e = new Date(end);
    if (e >= s) {
        const days = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
        count.textContent = days;
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }
};

function closeAddTargetModal() {
    const modal = document.getElementById('addTargetModal');
    if (modal) modal.style.display = 'none';
    const input = document.getElementById('new-target-name');
    if (input) input.value = '';
    pendingTargetWorkspaceId = null;
}

async function submitNewTarget() {
    const wsId = pendingTargetWorkspaceId;
    const nameInput = document.getElementById('new-target-name');
    const startInput = document.getElementById('new-target-startdate');
    const endInput = document.getElementById('new-target-enddate');

    const targetName = nameInput ? nameInput.value.trim() : '';
    const startDate = startInput ? startInput.value : '';
    const endDate = endInput ? endInput.value : '';

    if (!wsId || !targetName) {
        showToast('Please provide a target name', 'warning');
        return;
    }
    if (!startDate || !endDate) {
        showToast('Please select a date range', 'warning');
        return;
    }
    if (new Date(endDate) < new Date(startDate)) {
        showToast('End date must be after start date', 'warning');
        return;
    }

    try {
        const response = await fetch(window.API_BASE + `/api/workspaces/${wsId}/targets/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetName, startDate, endDate }),
            credentials: 'include'
        });

        if (response.ok) {
            const numDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
            showToast(`✅ Target created! ${numDays} date rows auto-generated.`, 'success');
            closeAddTargetModal();
            loadTargets(wsId);
        } else {
            const data = await response.json();
            showToast(`Error: ${data.message || 'Failed to create target'}`, 'error');
        }
    } catch (err) {
        console.error('Target Creation Error:', err);
        showToast('Server connection failed', 'error');
    }
}

/**
 * Open Add User Modal
 */
function openAddUserModal(roleFilter) {
    console.log('Opening Add User Modal for:', roleFilter);

    // Update Modal Title for Context
    const modalTitle = document.querySelector('#addUserModal .modal-header h3');
    if (modalTitle) {
        modalTitle.textContent = `Register New ${roleFilter ? roleFilter.toUpperCase() : 'USER'}`;
    }

    toggleUserModal(true);
    if (roleFilter) {
        const roleSelect = document.getElementById('new-role');
        if (roleSelect) {
            roleSelect.value = roleFilter;
            // Ensure the dropdown actually updates visually
            roleSelect.dispatchEvent(new Event('change'));
        }
    }
}

/**
 * Toggles the Add User Modal
 */
function toggleUserModal(show) {
    const modal = document.getElementById('addUserModal');
    if (modal) {
        modal.style.display = show ? 'block' : 'none';
        if (!show) {
            const form = document.getElementById('addUserForm');
            if (form) form.reset();
        }
    } else {
        console.error('Modal element #addUserModal not found!');
    }
}

// Expose to window for inline HTML onclicks
window.openAddUserModal = openAddUserModal;
window.toggleUserModal = toggleUserModal;

/**
 * Delete Selected User
 */
let pendingDeleteUserId = null;

function deleteUser(userId) {
    const targetId = userId || selectedTargetId;

    if (!targetId) {
        showToast('Please select a user to delete', 'warning');
        return;
    }

    // Store the user ID for confirmation
    pendingDeleteUserId = targetId;

    // Show custom confirmation modal
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeDeleteConfirm() {
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) {
        modal.style.display = 'none';
    }
    pendingDeleteUserId = null;
}

async function confirmDeleteUser() {
    if (!pendingDeleteUserId) {
        showToast('No user selected for deletion', 'error');
        return;
    }

    const targetId = pendingDeleteUserId;
    closeDeleteConfirm();

    try {
        console.log(`[DELETE] Attempting to delete user ID: ${targetId}`);

        const response = await fetch(window.API_BASE + `/api/users/${targetId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log(`[DELETE] Response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            // Try to get error details from response
            let errorMessage = 'Failed to delete user';
            try {
                const errorData = await response.json();
                console.error('[DELETE] Error response JSON:', errorData);
                errorMessage = errorData.message || errorMessage;
            } catch (jsonError) {
                // If JSON parsing fails, try to get text
                try {
                    const errorText = await response.text();
                    console.error('[DELETE] Error response text:', errorText);
                    errorMessage = errorText || `Error ${response.status}: ${response.statusText}`;
                } catch (textError) {
                    console.error('[DELETE] Could not parse error response');
                    errorMessage = `Error ${response.status}: ${response.statusText}`;
                }
            }
            showToast(errorMessage, 'error');
            return;
        }

        const data = await response.json();
        console.log('[DELETE] Success:', data);

        showToast('User deleted successfully', 'success');
        // Refresh list
        loadUserMgmt(currentRoleFilter);
        selectedTargetId = null;

    } catch (err) {
        console.error('[DELETE] Fetch error:', err);
        showToast(`Delete failed: ${err.message}`, 'error');
    }
}

// Expose functions to window
window.deleteUser = deleteUser;
window.closeDeleteConfirm = closeDeleteConfirm;
window.confirmDeleteUser = confirmDeleteUser;

/**
 * Handle the Add User Form Submission
 */
/**
 * Handle the Add User Form Submission (Direct Call)
 */
async function submitUserRegistration(e) {
    if (e) e.preventDefault();
    console.log('--- User Registration Triggered ---');

    const nameInput = document.getElementById('new-name');
    const emailInput = document.getElementById('new-email');
    const passInput = document.getElementById('new-password');
    const roleInput = document.getElementById('new-role');

    if (!nameInput || !emailInput || !passInput || !roleInput) {
        showToast('Error: Form elements not found', 'error');
        return;
    }

    const userData = {
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        password: passInput.value.trim(),
        role: roleInput.value
    };

    // Validate Role
    const validRoles = ['owner', 'ceo', 'admin', 'team', 'client'];
    if (!validRoles.includes(userData.role)) {
        showToast('Error: Invalid Role Selected', 'error');
        return;
    }

    if (!userData.email || !userData.password) {
        showToast('Please fill in all fields', 'warning');
        return;
    }

    console.log('Registration Payload:', userData);

    const btn = document.querySelector('#addUserForm button[type="submit"]') || document.querySelector('#addUserForm .btn-save');
    if (btn) btn.disabled = true;

    try {
        const response = await fetch(window.API_BASE + '/api/users/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
            credentials: 'include'
        });

        const data = await response.json();
        console.log('Registration Response:', data);

        if (response.ok) {
            showToast('User successfully saved to Database!', 'success');
            toggleUserModal(false);

            // Clear form manually to be sure
            nameInput.value = '';
            emailInput.value = '';
            passInput.value = '';

            // Refresh logic:
            // If we are viewing the same role group, refresh it. 
            // Otherwise, we might want to switch to that group or just stay put.
            // For now, let's try to reload the current filter.
            setTimeout(() => {
                if (window.loadUserMgmt) {
                    window.loadUserMgmt(currentRoleFilter);
                }
            }, 500);
        } else {
            const errorMsg = data.errors ? data.errors[0].msg : (data.message || 'Failed to create user');
            showToast(`Error: ${errorMsg}`, 'error');
        }
    } catch (err) {
        console.error('Network error during registration:', err);
        showToast('Failed to connect to server', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

// Attach to window for HTML access
window.submitUserRegistration = submitUserRegistration;

/**
 * Toggle user status between Active and Blocked
 */
/**
 * Toggle user status directly via switch
 */
async function toggleUserStatusDirect(userId, checkbox) {
    console.log(`[Toggle] Clicked for User ${userId}. Checked: ${checkbox.checked}`);
    const newStatus = checkbox.checked ? 'Blocked' : 'Active';
    const row = checkbox.closest('tr');
    // Use the specific class we added
    const statusTextSpan = row.querySelector('.status-text') || checkbox.parentElement.nextElementSibling;

    console.log('[Toggle] Status Span Found:', !!statusTextSpan);

    // Optimiztic UI Update
    if (statusTextSpan) {
        statusTextSpan.textContent = newStatus;
        statusTextSpan.style.color = newStatus === 'Blocked' ? '#dc2626' : '#16a34a';
    }

    try {
        console.log(`[Toggle] Sending API request: ${newStatus}`);
        const response = await fetch(window.API_BASE + `/api/users/toggle-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userId, status: newStatus }),
            credentials: 'include'
        });

        const data = await response.json();
        console.log('[Toggle] API Response:', data);

        if (response.ok) {
            showToast(`User ${data.newStatus}`, 'success');
            // Ensure UI is in sync
            if (statusTextSpan) {
                statusTextSpan.textContent = data.newStatus;
                statusTextSpan.style.color = data.newStatus === 'Blocked' ? '#dc2626' : '#16a34a';
            }
        } else {
            console.error('[Toggle] API Error:', data.message);
            showToast(`Error: ${data.message}`, 'error');
            // Revert on error
            checkbox.checked = !checkbox.checked;
            if (statusTextSpan) {
                const revertedStatus = checkbox.checked ? 'Blocked' : 'Active';
                statusTextSpan.textContent = revertedStatus;
                statusTextSpan.style.color = revertedStatus === 'Blocked' ? '#dc2626' : '#16a34a';
            }
        }
    } catch (err) {
        console.error('[Toggle] Network Error:', err);
        showToast('Server connection failed', 'error');
        // Revert on error
        checkbox.checked = !checkbox.checked;
        if (statusTextSpan) {
            const revertedStatus = checkbox.checked ? 'Blocked' : 'Active';
            statusTextSpan.textContent = revertedStatus;
            statusTextSpan.style.color = revertedStatus === 'Blocked' ? '#dc2626' : '#16a34a';
        }
    }
}

// Expose
window.toggleUserStatusDirect = toggleUserStatusDirect;

/**
 * Open reset password modal
 */
function openResetModal() {
    if (!selectedTargetId) {
        showToast('Please select a target first', 'warning');
        return;
    }

    document.getElementById('target-user-display').textContent = selectedTargetId;
    document.getElementById('resetPasswordModal').style.display = 'block';
}

/**
 * Toggle reset password modal
 */
function toggleResetModal(show) {
    document.getElementById('resetPasswordModal').style.display = show ? 'block' : 'none';
    document.getElementById('reset-new-password').value = '';
}

/**
 * Submit password reset
 */
async function submitPasswordReset() {
    const newPassword = document.getElementById('reset-new-password').value;

    if (!newPassword || newPassword.length < 4) {
        showToast('Please enter a valid password (min 4 characters)', 'warning');
        return;
    }

    try {
        const response = await fetch(window.API_BASE + '/api/users/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: selectedTargetId,
                newPassword: newPassword
            }),
            credentials: 'include'
        });

        if (response.ok) {
            showToast('Password updated successfully!', 'success');
            toggleResetModal(false);
            selectedTargetId = null;
            loadUserMgmt(currentRoleFilter);
        } else {
            const err = await response.json();
            showToast(`Error: ${err.message}`, 'error');
        }
    } catch (err) {
        showToast('Server connection failed', 'error');
    }
}

/**
 * WORKSPACE MANAGEMENT
 */

// Add extra input fields in the modal
function addColumnInput() {
    const colList = document.getElementById('column-list');
    if (!colList) return;
    const div = document.createElement('div');
    div.className = 'column-input';
    div.innerHTML = `<input type="text" class="ws-col" placeholder="Column Name" style="width: 100%; padding: 8px; margin-bottom: 8px; border: 1px solid #ddd; border-radius: 4px;">`;
    colList.appendChild(div);
}

// Submit new workspace
async function submitNewWorkspace() {
    console.log('--- Submitting New Workspace ---');
    const nameInput = document.getElementById('ws-name');
    // const adminInput = document.getElementById('ws-admin-id'); // Not used in unified

    const name = nameInput ? nameInput.value.trim() : '';
    // Collect all selected user IDs from centralized state (Unified)
    const assignedUserIds = window.workspaceSelectedUsers.map(u => parseInt(u.id));

    // Validate: Name, at least one user, and at least one Admin (Case Insensitive)
    let hasAdmin = window.workspaceSelectedUsers.some(u => (u.role && u.role.toLowerCase() === 'admin'));

    // Auto-Assign Current User as Admin if none selected (and current user is admin/owner)
    if (!hasAdmin && (window.userRole === 'admin' || window.userRole === 'owner' || window.userRole === 'ceo')) {
        hasAdmin = true;
        if (window.userId && !assignedUserIds.includes(parseInt(window.userId))) {
            assignedUserIds.push(parseInt(window.userId));
        }
    }

    console.log('--- Submit Workspace Debug ---');
    console.log('Action:', window.editingWorkspaceId ? 'UPDATE' : 'CREATE');
    console.log('Payload Name:', name);
    console.log('Payload Users:', assignedUserIds);
    console.log('Editing ID:', window.editingWorkspaceId);

    if (!name || assignedUserIds.length === 0 || !hasAdmin) {
        console.warn('Validation Failed: Name/Users/Admin check logic', { name, userCount: assignedUserIds.length, hasAdmin });
        showToast('Please provide a name and select at least one Administrator', 'warning');
        return;
    }

    const endpoint = window.API_BASE + (window.editingWorkspaceId ? '/api/workspaces/update' : '/api/workspaces/create');
    const payload = {
        displayName: name,
        users: assignedUserIds,
        adminId: (window.userId ? window.userId : '') // Fallback or current
    };

    if (window.editingWorkspaceId) {
        payload.workspaceId = window.editingWorkspaceId;
    } else {
        payload.columns = ['Client Name', 'Status', 'Target Value', 'Priority', 'Progress']; // Defaults for new
        payload.status = 'Active';
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            showToast(window.editingWorkspaceId ? 'Workspace Updated!' : 'Secure Workspace Created!', 'success');
            closeModal();
            loadWorkspaceList();
        } else {
            showToast(`Error: ${data.message || 'Unknown error'}`, 'error');
        }
    } catch (err) {
        console.error('Workspace submit error:', err);
        showToast('Failed to save workspace', 'error');
    }
}


// Close workspace modal
function closeModal() {
    console.log('Closing Workspace Modal');
    const modal = document.getElementById('workspace-modal');
    if (modal) modal.style.display = 'none';

    const wsName = document.getElementById('ws-name');
    if (wsName) wsName.value = '';

    const adminId = document.getElementById('ws-admin-id');
    if (adminId) adminId.value = '';
}

// Delete workspace
let pendingDeleteWsName = null;

async function deleteSelectedWorkspace(tableName) {
    if (!tableName) return;
    pendingDeleteWsName = tableName;

    const modal = document.getElementById('wsDeleteConfirmModal');
    const nameSpan = document.getElementById('ws-delete-name');
    if (nameSpan) nameSpan.textContent = tableName;
    if (modal) modal.style.display = 'block';
}

function closeWsDeleteConfirm() {
    const modal = document.getElementById('wsDeleteConfirmModal');
    if (modal) modal.style.display = 'none';
    pendingDeleteWsName = null;
}

async function confirmDeleteWorkspace() {
    if (!pendingDeleteWsName) {
        showToast('No workspace selected', 'error');
        return;
    }

    const tableName = pendingDeleteWsName;
    closeWsDeleteConfirm();

    try {
        const response = await fetch(window.API_BASE + '/api/workspaces/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableName: tableName }),
            credentials: 'include'
        });

        if (response.ok) {
            showToast(`Workspace '${tableName}' deleted`, 'success');
            loadWorkspaceList();
        } else {
            const data = await response.json();
            showToast(`Error: ${data.message}`, 'error');
        }
    } catch (err) {
        showToast('Failed to connect to server', 'error');
    }
}

// Update greeting title dynamically
function updateDashboardGreeting(name) {
    const title = document.getElementById('view-title');
    if (title) {
        title.textContent = `Hi ${name}`;
    }
}

/**
 * Start Header Clock
 */
function startClock() {
    const timeEl = document.getElementById('current-time');
    const dateEl = document.getElementById('current-date');

    function update() {
        const now = new Date();

        // Time: 04:25:01 PM
        timeEl.textContent = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });

        // Date: Sunday, February 8, 2026
        dateEl.textContent = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    update();
    setInterval(update, 1000);
    setInterval(update, 1000);
}

window.currentViewContext = null; // Initialize currentViewContext globally

window.refreshCurrentView = function () {
    console.log('[Refresh] Refreshing view:', currentViewContext);
    const btn = document.getElementById('global-refresh-btn');
    if (btn) {
        btn.style.transform = 'rotate(360deg)';
        btn.style.transition = 'transform 0.5s';
        setTimeout(() => { btn.style.transform = 'rotate(0deg)'; btn.style.transition = 'none'; }, 500);
    }

    if (!currentViewContext) {
        loadMainMenu();
        return;
    }

    switch (currentViewContext.name) {
        case 'main_menu':
            loadMainMenu();
            break;
        case 'workspace_list':
            loadWorkspaceList();
            break;
        case 'target_view':
            loadTargetView(currentViewContext.params.targetId, currentViewContext.params.workspaceId);
            break;
        case 'user_mgmt':
            loadUserMgmt(currentViewContext.params.roleFilter);
            break;
        case 'activity_logs':
            loadActivityLog();
            break;
        case 'settings':
            loadSettings();
            break;
        default:
            loadMainMenu();
    }
};

/**
 * Load Main Menu Cards
 */
window.loadMainMenu = async function () {
    currentViewContext = { name: 'main_menu', params: {} };
    const container = document.getElementById('main-render');
    const title = document.getElementById('view-title');
    const name = window.userName || 'User';

    title.textContent = `Hi ${name}`;
    selectedTargetId = null;

    // Check permissions
    const role = window.userRole || 'client';
    const isCEO = role === 'owner' || role === 'ceo';
    const isAdmin = isCEO || role === 'admin';

    let menuHTML = `<div class="menu-grid">`;

    // 1. Workspaces Card
    menuHTML += `
        <div class="menu-card" id="card-workspaces">
            <span class="icon">📁</span>
            <h3>Workspaces</h3>
            <p>Manage and access your data environments</p>
        </div>
    `;

    // 2. Settings Card
    menuHTML += `
        <div class="menu-card" id="card-settings">
            <span class="icon">⚙️</span>
            <h3>Settings</h3>
            <p>Customize your profile and security</p>
        </div>
    `;

    // CEO/Owner/Admin cards
    if (isAdmin) {
        menuHTML += `
            <div class="menu-card" id="card-admin">
                <span class="icon">🛡️</span>
                <h3>Access Control</h3>
                <p>Manage users and permissions</p>
            </div>
        `;
    }
    const isOwner = role === 'owner';
    if (isOwner) {
        menuHTML += `
            <div class="menu-card" id="card-logs">
                <span class="icon">📜</span>
                <h3>Activity Logs</h3>
                <p>Monitor system changes and events</p>
            </div>
        `;
    }

    menuHTML += `</div>`;
    container.innerHTML = menuHTML;

    // Attach listeners to cards
    document.getElementById('card-workspaces').addEventListener('click', loadWorkspaceList);
    document.getElementById('card-settings').addEventListener('click', loadSettings);

    // Access Control card - available to all admins
    if (isAdmin) {
        const adminCard = document.getElementById('card-admin');
        if (adminCard) {
            adminCard.addEventListener('click', () => {
                // Admins can only see team/client, CEO/Owner see full admin panel
                if (role === 'admin') {
                    loadUserMgmt('team');
                } else {
                    loadAdminPanel();
                }
            });
        }
    }

    // Card listeners
    if (isOwner) {
        const logsCard = document.getElementById('card-logs');
        if (logsCard) logsCard.addEventListener('click', loadActivityLog);
    }
}

// Load workspace list
async function loadWorkspaceList() {
    const container = document.getElementById('main-render');
    const title = document.getElementById('view-title');
    currentViewContext = { name: 'workspace_list', params: {} };
    title.textContent = 'Active Workspaces';

    selectedTargetId = null;

    // Show loading
    container.innerHTML = '<div class="loader-overlay"><div class="spinner"></div></div>';

    try {
        const response = await fetch(window.API_BASE + `/api/workspaces?t=${Date.now()}`, { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch workspaces');

        const workspaces = await response.json();

        const currentRole = window.userRole || 'client';
        const canCreate = currentRole === 'owner' || currentRole === 'ceo' || currentRole === 'admin';

        let contentHTML = `
            <div class="workspace-controls" style="margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; gap: 20px;">
                <div class="search-box" style="flex: 1; position: relative;">
                    <input type="text" id="ws-search" placeholder="Search workspaces..." style="width: 100%; padding: 12px 40px 12px 15px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 0.95em; outline: none; transition: border-color 0.2s;">
                    <span style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); color: #94a3b8;">🔍</span>
                </div>
                ${canCreate ? `
                <button class="btn-add" id="btn-create-workspace" style="padding: 12px 24px; background: #10b981; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: background 0.2s; white-space: nowrap;">
                    + New Workspace
                </button>
                ` : ''}
            </div>
            <div id="workspace-table-container">
        `;

        if (workspaces.length === 0) {
            contentHTML += `
                <div class="empty-state">
                    <p style="color: #64748b; font-size: 1.1em;">No workspaces found. Create one to get started!</p>
                </div>
            `;
        } else {
            contentHTML += `
                <table class="data-table workspace-table" id="ws-table" style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <thead style="background: #f8fafc;">
                        <tr>
                            <th style="padding: 15px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 600;">Workspace Name</th>
                            <th style="padding: 15px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 600;">Active Targets</th>
                            <th style="padding: 15px; text-align: center; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 600;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            workspaces.forEach(ws => {
                const displayName = (ws.display_name || ws.name);
                const manager = ws.managed_by || 'Unassigned';
                const targetCount = ws.target_count || 0;

                // Ensure users array is parsed correctly (SQLite JSON is string)
                if (typeof ws.users === 'string') {
                    try {
                        ws.users = JSON.parse(ws.users);
                    } catch (e) {
                        console.error('Failed to parse users JSON:', e);
                        ws.users = [];
                    }
                }

                // Store ws data for edit
                const wsDataSafe = encodeURIComponent(JSON.stringify(ws));

                contentHTML += `
                    <tr class="ws-row" data-id="${ws.id}" style="transition: background 0.2s; cursor: pointer;">
                        <td style="padding: 15px; border-bottom: 1px solid #f1f5f9;">
                            <div style="display: flex; align-items: center;">
                                <span class="chevron">▶</span>
                                <div>
                                    <div style="font-weight: 700; color: #1e293b; font-size: 1.1em;">${displayName.toUpperCase()}</div>
                                    <div style="font-size: 0.8em; color: #94a3b8;">${ws.name}</div>
                                </div>
                            </div>
                        </td>
                        <td style="padding: 15px; border-bottom: 1px solid #f1f5f9;">
                             <div style="display: flex; align-items: center; gap: 15px;">
                                <span id="ws-target-count-${ws.id}" style="font-weight:600; color:#334155;">${targetCount} Active</span>
                                ${canCreate ? `
                                <button class="btn-add-target" style="padding: 6px 12px; background: #d1fae5; color: #059669; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8em; font-weight: 600; display: flex; align-items: center; gap: 5px; transition: all 0.2s;" data-id="${ws.id}" onclick="event.stopPropagation();">
                                    <span>+</span> Target
                                </button>
                                ` : ''}
                            </div>
                        </td>
                        <td style="padding: 15px; border-bottom: 1px solid #f1f5f9; text-align: center;">
                            <div style="display: flex; justify-content: center; gap: 8px;">
                                ${canCreate ? `
                                    <button class="btn-edit-ws" data-ws="${wsDataSafe}" style="padding: 8px 12px; background: #e0f2fe; color: #0369a1; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="Edit Workspace">
                                        ✏️ Edit
                                    </button>
                                    <button class="btn-delete" style="padding: 8px 12px; background: #fee2e2; color: #dc2626; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s;" data-name="${ws.name}" onclick="event.stopPropagation();">
                                        🗑️ Delete
                                    </button>
                                ` : currentRole === 'team' ? `
                                    <span style="color: #94a3b8; font-size: 0.85em;">View Only</span>
                                ` : `
                                    <span style="color: #94a3b8; font-size: 0.85em;">View Only</span>
                                `}
                            </div>
                        </td>
                    </tr>
                    <tr id="targets-row-${ws.id}" class="targets-container-row" style="display: none; background: #f8fafc;">
                        <td colspan="3" style="padding: 15px 30px 25px 50px; border-bottom: 2px solid #e2e8f0;">
                            <div id="targets-list-${ws.id}" class="targets-list-grid">
                                <p style="font-size: 0.85em; color: #94a3b8;">Loading targets...</p>
                            </div>
                        </td>
                    </tr>
                `;
            });

            contentHTML += `
                    </tbody>
                </table>
            `;
        }

        contentHTML += `</div>`;
        container.innerHTML = contentHTML;

        container.innerHTML = contentHTML;

        // Attach listeners to dynamically created elements

        // 1. Workspace Row Click Delegation (Replacing inline onclick)
        const table = document.getElementById('ws-table');
        if (table) {
            table.addEventListener('click', (e) => {
                const row = e.target.closest('.ws-row');
                if (row) {
                    // Check if we clicked a button inside the row (Edit/Delete/Add Target)
                    if (e.target.closest('button') || e.target.closest('a')) {
                        return; // Let the button handler take care of it
                    }

                    const workspaceId = row.dataset.id;
                    if (workspaceId) {
                        toggleTargets(workspaceId, row);
                    }
                }
            });
        }


        // Primary Target Modal Button
        // Moved to delegate listener
        const addBtn = container.querySelector('.btn-add');
        if (addBtn) {
            addBtn.addEventListener('click', async () => {
                const membersList = document.getElementById('ws-members-list');
                const selectedContainer = document.getElementById('selected-members-container');

                // Initialize centralized selection state (Unified)
                window.workspaceSelectedUsers = [];
                window.editingWorkspaceId = null; // Reset Edit Mode

                // Reset UI Text
                document.querySelector('#workspace-modal h3').textContent = 'Configure New Workspace';
                const submitBtn = document.getElementById('btn-submit-workspace');
                if (submitBtn) submitBtn.textContent = 'Create Workspace';

                // Clear previous search values
                const searchInput = document.getElementById('search-members');
                if (searchInput) searchInput.value = '';

                // Reset dropdown trigger and display

                // Clear display
                if (selectedContainer) selectedContainer.innerHTML = '<div style="color:#94a3b8; font-style:italic; padding:10px;">No members selected</div>';

                // Clear hidden admin
                const adminHidden = document.getElementById('ws-admin-id');
                if (adminHidden) adminHidden.value = '';

                try {
                    const res = await fetch(window.API_BASE + '/api/users', { credentials: 'include' });
                    const allUsers = await res.json();
                    window.workspaceModalUsers = allUsers; // Store for filtering

                    renderUnifiedMemberSelect(allUsers); // Initial render

                    renderUnifiedMemberSelect(allUsers); // Initial render

                } catch (e) {
                    console.error('Error fetching users', e);
                    showToast('Failed to load user list', 'error');
                }
                document.getElementById('workspace-modal').style.display = 'block';
            });
        }

        // Attach Edit Button Listeners
        container.querySelectorAll('.btn-edit-ws').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const wsData = btn.getAttribute('data-ws');
                openEditWorkspaceModal(wsData);
            });
        });

        // Moved to delegate listener

        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                deleteSelectedWorkspace(btn.getAttribute('data-name'));
            });
        });

        container.querySelectorAll('.btn-add-target').forEach(btn => {
            btn.addEventListener('click', () => {
                openAddTargetModal(btn.getAttribute('data-id'));
            });
        });

        const wsSearchInput = document.getElementById('ws-search');
        if (wsSearchInput) {
            wsSearchInput.addEventListener('keyup', filterWorkspaces);
        }

    } catch (err) {
        container.innerHTML = `<p class="error" style="color: #ef4444; padding: 20px; background: #fef2f2; border-radius: 8px;">Failed to load workspaces.</p>`;
        showToast('Error loading workspaces', 'error');
    }
}

/**
 * Filter workspaces by search input
 */
function filterWorkspaces() {
    const input = document.getElementById('ws-search');
    const filter = input.value.toUpperCase();
    const table = document.getElementById('ws-table');
    if (!table) return;

    const tr = table.getElementsByTagName('tr');

    for (let i = 1; i < tr.length; i++) {
        const td = tr[i].getElementsByTagName('td')[1]; // Workspace Name column
        if (td) {
            const txtValue = td.textContent || td.innerText;
            if (txtValue.toUpperCase().indexOf(filter) > -1) {
                tr[i].style.display = "";
            } else {
                tr[i].style.display = "none";
            }
        }
    }
}

/**
 * Load Activity Logs
 */
async function loadActivityLog() {
    const container = document.getElementById('main-render');
    const title = document.getElementById('view-title');
    currentViewContext = { name: 'activity_logs', params: {} };
    title.textContent = "System Activity Logs";

    selectedTargetId = null;

    // Show loading
    container.innerHTML = '<div class="loader-overlay"><div class="spinner"></div></div>';

    try {
        const response = await fetch(window.API_BASE + '/api/logs', { credentials: 'include' });

        if (!response.ok) {
            throw new Error('Failed to fetch logs');
        }

        const logs = await response.json();

        let logHTML = `
            <table class="data-table log-table" style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <thead style="background: #f8fafc;">
                    <tr>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">Timestamp</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">User</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">Action</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">IP Address</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">Status</th>
                    </tr>
                </thead>
                <tbody>
        `;

        logs.forEach(log => {
            logHTML += `
                <tr onclick="selectTarget(${log.id}, this)" style="cursor: pointer;">
                    <td class="time-col" style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${new Date(log.timestamp).toLocaleString()}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${log.email}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;"><strong>${log.action}</strong></td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${log.ip_address}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;"><span class="log-${log.status.toLowerCase()}">${log.status}</span></td>
                </tr>
            `;
        });

        logHTML += `</tbody></table>`;
        container.innerHTML = logHTML;

    } catch (err) {
        container.innerHTML = `<p class="error" style="color: #ef4444; padding: 20px; background: #fef2f2; border-radius: 8px;">Security Error: Could not fetch logs.</p>`;
        showToast('Error loading activity logs', 'error');
    }
}

/**
 * Toggle Targets Visibility under Workspace
 */
async function toggleTargets(workspaceId, rowElement) {
    const targetsRow = document.getElementById(`targets-row-${workspaceId}`);
    if (!targetsRow) return;

    const isVisible = targetsRow.style.display !== 'none';

    // Close others if open
    document.querySelectorAll('.targets-container-row').forEach(row => row.style.display = 'none');
    document.querySelectorAll('.ws-row').forEach(row => row.classList.remove('expanded'));

    if (!isVisible) {
        targetsRow.style.display = 'table-row';
        rowElement.classList.add('expanded');
        loadTargets(workspaceId);
    }
}

async function loadTargets(workspaceId) {
    const listDiv = document.getElementById(`targets-list-${workspaceId}`);
    if (!listDiv) return;

    try {
        const response = await fetch(window.API_BASE + `/api/workspaces/${workspaceId}/targets`, { credentials: 'include' });
        const targets = await response.json();

        let html = '';

        if (targets.length > 0) {
            targets.forEach(t => {
                html += `
                    <div class="target-row-item" 
                         data-targetid="${t.id}" 
                         data-workspaceid="${workspaceId}" 
                         style="cursor: pointer;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="color: #64748b; font-size: 0.8em;">🎯</span>
                            <div>
                                <div style="font-weight: 600; font-size: 0.9em; color: #334155;">${t.name}</div>
                                <div style="font-size: 0.65em; color: #94a3b8; font-family: monospace;">Isolated Storage Active</div>
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            html = '<p style="color:#94a3b8; font-size:0.85em;">No targets yet. Click "+ Target" to create one.</p>';
        }

        listDiv.innerHTML = html;

        // Attach click + hover listeners after rendering
        const rows = listDiv.querySelectorAll('.target-row-item');
        rows.forEach(r => {
            const tid = r.getAttribute('data-targetid');
            const wid = r.getAttribute('data-workspaceid');

            r.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent table row click from triggering
                console.log('[Target Click] targetId:', tid, 'workspaceId:', wid);
                window.loadTargetView(tid, wid);
            });

            r.addEventListener('mouseover', () => {
                r.style.borderColor = '#0ea5e9';
                r.style.backgroundColor = '#f0f9ff';
            });
            r.addEventListener('mouseout', () => {
                r.style.borderColor = '#f1f5f9';
                r.style.backgroundColor = 'white';
            });
        });

    } catch (err) {
        console.error('[loadTargets] Error:', err);
        listDiv.innerHTML = '<p style="color: #ef4444; font-size: 0.8em;">Error loading targets.</p>';
    }
}

let activeWorkspaceForTarget = null;

function showAddTargetModal(workspaceId) {
    activeWorkspaceForTarget = workspaceId;
    const modal = document.getElementById('target-modal');
    if (modal) modal.style.display = 'block';
}

function closeTargetModal() {
    const modal = document.getElementById('target-modal');
    if (modal) modal.style.display = 'none';
}


/**
 * Toggle Sidebar Visibility
 */
function toggleSidebar() {
    const wrapper = document.getElementById('dashboard-ui');
    if (wrapper) {
        wrapper.classList.toggle('sidebar-collapsed');
    }
}

/**
 * Load Settings View
 */
function loadSettings() {
    const container = document.getElementById('main-render');
    const title = document.getElementById('view-title');
    currentViewContext = { name: 'settings', params: {} };
    title.textContent = 'Account Settings';

    selectedTargetId = null;

    const currentAvatar = document.getElementById('user-avatar') ? document.getElementById('user-avatar').src : 'https://ui-avatars.com/api/?name=User&background=0ea5e9&color=fff';

    container.innerHTML = `
        <div class="settings-card" style="max-width: 600px; margin: 30px auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <!-- Avatar Section -->
            <div style="text-align: center; margin-bottom: 30px; padding-bottom: 30px; border-bottom: 1px solid #f1f5f9;">
                <div style="width: 120px; height: 120px; margin: 0 auto 20px; border-radius: 50%; overflow: hidden; border: 4px solid #38bdf8; background: #f1f5f9;">
                    <img id="settings-avatar-preview" src="${currentAvatar}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <h3>Profile Image</h3>
                <div class="input-group" style="margin-top: 15px; text-align: left;">
                    <input type="file" id="avatar-file-input" accept="image/*" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; cursor: pointer;">
                </div>
                <button id="btn-save-avatar" class="btn-save" style="margin-top: 15px; width: 100%; font-weight: 600; padding: 12px; background: #0ea5e9; color: white; border: none; border-radius: 8px; cursor: pointer;">Update Profile Picture</button>
            </div>
            
            <!-- Password Section -->
            <div style="margin-bottom: 30px;">
                <h3 style="margin-bottom: 15px;">Change Password</h3>
                <div class="input-group" style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #64748b; font-size: 0.9em;">New Password</label>
                    <input type="password" id="new-password-input" placeholder="Min. 8 characters" style="width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; outline: none;">
                </div>
                <div class="input-group" style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; color: #64748b; font-size: 0.9em;">Confirm New Password</label>
                    <input type="password" id="confirm-password-input" placeholder="Repeat new password" style="width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; outline: none;">
                </div>
                <button id="btn-update-password" style="width: 100%; font-weight: 600; padding: 12px; background: #10b981; color: white; border: none; border-radius: 8px; cursor: pointer;">Update Password</button>
            </div>

            <div style="text-align: center;">
                <button id="btn-cancel-settings" style="background: none; border: none; color: #94a3b8; cursor: pointer; text-decoration: underline;">Return to Dashboard</button>
            </div>
        </div>
    `;

    // Add listeners after injection
    setTimeout(() => {
        const fileInput = document.getElementById('avatar-file-input');
        const saveAvatarBtn = document.getElementById('btn-save-avatar');
        const updatePassBtn = document.getElementById('btn-update-password');
        const cancelBtn = document.getElementById('btn-cancel-settings');

        if (fileInput) {
            fileInput.addEventListener('change', function (e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function (event) {
                        document.getElementById('settings-avatar-preview').src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        if (saveAvatarBtn) {
            saveAvatarBtn.addEventListener('click', updateProfileImage);
        }

        if (updatePassBtn) {
            updatePassBtn.addEventListener('click', updatePassword);
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                loadWorkspaceList();
            });
        }
    }, 100);
}

/**
 * Update user password
 */
async function updatePassword() {
    const newPass = document.getElementById('new-password-input').value;
    const confirmPass = document.getElementById('confirm-password-input').value;
    const btn = document.getElementById('btn-update-password');

    if (!newPass) {
        showToast('Password cannot be empty', 'warning');
        return;
    }
    if (newPass.length < 8) {
        showToast('Password must be at least 8 characters', 'warning');
        return;
    }
    if (newPass !== confirmPass) {
        showToast('Passwords do not match', 'warning');
        return;
    }

    try {
        btn.disabled = true;
        btn.textContent = 'Updating...';

        const response = await fetch(window.API_BASE + '/api/users/update-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPassword: newPass }),
            credentials: 'include'
        });

        if (response.ok) {
            showToast('Password updated successfully!', 'success');
            document.getElementById('new-password-input').value = '';
            document.getElementById('confirm-password-input').value = '';
        } else {
            const data = await response.json();
            showToast(data.message || 'Update failed', 'error');
        }
    } catch (err) {
        showToast('Server connection failed', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Update Password';
    }
}

/**
 * Update Profile Image
 */
function updateProfileImage() {
    const fileInput = document.getElementById('avatar-file-input');
    const file = fileInput ? fileInput.files[0] : null;
    const saveBtn = document.getElementById('btn-save-avatar');

    if (file) {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }

        const reader = new FileReader();
        reader.onload = async function (e) {
            const dataUrl = e.target.result;

            try {
                const response = await fetch(window.API_BASE + '/api/users/update-avatar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ avatar: dataUrl }),
                    credentials: 'include'
                });

                if (response.ok) {
                    // Update the sidebar avatar
                    document.getElementById('user-avatar').src = dataUrl;
                    showToast('Profile image saved to database!', 'success');
                } else {
                    const err = await response.json();
                    showToast(`Failed to save: ${err.message}`, 'error');
                }
            } catch (err) {
                showToast('Server connection failed', 'error');
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Changes';
                }
            }
        };
        reader.readAsDataURL(file);
    } else {
        showToast('Please select a file first', 'warning');
    }
}

/**
 * Logout functionality
 */
async function logout() {
    console.log('Logout triggered');
    try {
        const response = await fetch(window.API_BASE + '/api/logout', { method: 'POST', credentials: 'include' });
        showToast('Logging out...', 'info');
        window.location.replace('index.html');
    } catch (err) {
        console.error('Logout error:', err);
        window.location.replace('index.html');
    }
}

// Ensure critical functions are global
window.logout = logout;
window.loadSettings = loadSettings;
window.loadWorkspaceList = loadWorkspaceList;
window.loadAdminPanel = loadAdminPanel;
window.loadUserMgmt = loadUserMgmt;
window.loadActivityLog = loadActivityLog;
window.submitNewWorkspace = submitNewWorkspace;
window.toggleSidebar = toggleSidebar;
window.closeModal = closeModal;
/**
 * Toggle Targets Expansion
 */
function toggleTargets(workspaceId, row) {
    console.log(`[Toggle] Clicked workspace ${workspaceId}`);
    const targetRow = document.getElementById(`targets-row-${workspaceId}`);
    if (!targetRow) {
        console.error(`[Toggle] Target row not found for ${workspaceId}`);
        return;
    }

    const chevron = row.querySelector('.chevron');

    // Toggle Display
    const isHidden = targetRow.style.display === 'none' || targetRow.style.display === '';
    console.log(`[Toggle] Current state: ${targetRow.style.display}, Switching to: ${isHidden ? 'table-row' : 'none'}`);

    targetRow.style.display = isHidden ? 'table-row' : 'none';

    // Rotate Chevron
    if (chevron) {
        chevron.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
        chevron.style.transition = 'transform 0.2s';
    }

    // Load data if expanding
    if (isHidden) {
        console.log(`[Toggle] Loading targets for ${workspaceId}`);
        loadTargets(workspaceId);
    }
}

// Expose to window
window.toggleTargets = toggleTargets;
// Expose to window
window.toggleTargets = toggleTargets;
window.submitAddTarget = submitNewTarget;
window.closeTargetModal = closeAddTargetModal;
window.addColumnInput = addColumnInput;
window.openAddTargetModal = openAddTargetModal;
window.showAddTargetModal = openAddTargetModal;

// Fix Reference Errors
window.toggleMultiSelect = function () {
    console.log('toggleMultiSelect called');
    const dropdown = document.getElementById('multi-select-dropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    }
};


window.updateSidebarWorkspaces = function () {
    // console.log('updateSidebarWorkspaces called (stub)');
    // Placeholder to prevent ReferenceError if this function is missing
};

window.removeSelectedUser = function (userId) {
    console.log('[Remove User] Removing user:', userId);

    // 1. Uncheck the checkbox in the dropdown if it exists
    const checkbox = document.querySelector(`.user-checkbox[value="${userId}"]`);
    if (checkbox) {
        checkbox.checked = false;
        // Trigger the change event to update the state via the existing listener
        checkbox.dispatchEvent(new Event('change'));
    } else {
        // If dropdown isn't open or checkbox not found, manually update state
        if (window.workspaceSelectedUsers) {
            window.workspaceSelectedUsers = window.workspaceSelectedUsers.filter(id => id !== userId);
            // Re-render the selected chips
            const selectedContainer = document.getElementById('selected-members-container');
            if (selectedContainer) {
                // Simplest way: Remove the specific chip
                const chip = selectedContainer.querySelector(`.member-chip[onclick*="${userId}"]`);
                if (chip) chip.remove();

                if (window.workspaceSelectedUsers.length === 0) {
                    selectedContainer.innerHTML = '<div style="color:#94a3b8; font-style:italic; padding:10px;">No members selected</div>';
                }
            }
        }
    }
};

window.updateMemberTrigger = function () {
    // Logic to update the member selection button text/state
    const container = document.getElementById('selected-members-container');
    if (!container) return;

    // Check global state or DOM for count
    const count = window.workspaceSelectedUsers ? window.workspaceSelectedUsers.length : 0;
    console.log('[Update Trigger] Member count:', count);
};

window.openTargetView = function (targetId, workspaceId) {
    if (!targetId || !workspaceId) {
        console.error('Missing targetId or workspaceId for view');
        return;
    }
    console.log(`[Target View] Opening target ${targetId} in workspace ${workspaceId}`);
    const url = `target-view.html?id=${targetId}&ws=${workspaceId}`;
    window.open(url, '_blank');
};

/**
 * Initialize dashboard
 */
window.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard Initializing...');

    // 1. Start UI Components
    startClock();

    // 2. Initial View (Main Menu)
    setTimeout(() => {
        loadMainMenu();
        updateSidebarWorkspaces();
        syncRoleVisibility();
    }, 200);

    // Dynamic Visibility Fix: Ensure sidebar items appear as soon as auth is ready
    let attempts = 0;
    const authCheck = setInterval(() => {
        syncRoleVisibility();
        attempts++;
        if (window.userRole || attempts > 20) clearInterval(authCheck);
    }, 250);

    // 3. Attach Event Listeners to Sidebar Navigation
    const navActions = {
        'nav-home': () => loadMainMenu(),
        'nav-workspaces': () => loadWorkspaceList(),
        'nav-admin': () => {
            // Admins can only see team/client, CEO/Owner see full admin panel
            if (window.userRole === 'admin') {
                loadUserMgmt('team');
            } else {
                loadAdminPanel();
            }
        },
        'nav-logs': () => loadActivityLog(),
        'nav-settings': () => loadSettings(),
        'nav-logout': () => logout()
    };

    Object.entries(navActions).forEach(([id, action]) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                console.log(`Navigation: ${id} clicked`);
                action();
            });
        }
    });

    // 3. Attach Sidebar Toggle
    const toggleBtn = document.getElementById('sidebar-toggle');
    if (toggleBtn) {
        // Clear any old ones and attach fresh
        toggleBtn.replaceWith(toggleBtn.cloneNode(true));
        document.getElementById('sidebar-toggle').addEventListener('click', () => toggleSidebar());
    }
});

/**
 * Sidebar: Dynamic Workspace List
 */
// function updateSidebarWorkspaces() { ... } // REMOVED per user request

/**
 * Centralized Visibility Sync
 */
function syncRoleVisibility(role) {
    if (!role) role = window.userRole || localStorage.getItem('userRole') || 'client';
    const isCEO = role === 'owner' || role === 'ceo';
    const isAdmin = isCEO || role === 'admin';

    console.log(`Syncing UI Visibility for: ${role}`);

    // Show/Hide top-level nav links
    const navAdmin = document.getElementById('nav-admin');
    const navLogs = document.getElementById('nav-logs');
    if (navAdmin) navAdmin.style.display = isAdmin ? 'block' : 'none';
    if (navLogs) navLogs.style.display = isCEO ? 'block' : 'none';

    // Classes
    document.querySelectorAll('.ceo-only').forEach(el => el.style.display = isCEO ? 'block' : 'none');
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? 'block' : 'none');
}

window.syncRoleVisibility = syncRoleVisibility;

/**
 * Render UNIFIED user list for Autocomplete
 */
function renderUnifiedMemberSelect(users, query = '') {
    const listContainer = document.getElementById('ws-members-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const selectedIds = window.workspaceSelectedUsers.map(u => u.id);

    // Filter by query AND Strict Role Check
    const filtered = users.filter(u => {
        const role = u.role ? u.role.toLowerCase() : '';
        if (role === 'owner' || role === 'ceo') return false;

        // Hide already selected users from dropdown? (Optional, user didn't ask but good UX)
        // User asked: "all select ones appear out side the box" -> usually implies they stay in list or go.
        // Let's keep them in list but mark specific styling or just rely on 'selectedIds' check.
        // Actually, user said "select ones appear outside", implies moving them? 
        // Standard autocomplete: filter out selected? Or just show checked?
        // Let's filter out SELECTED ones from the dropdown to avoid duplicates, 
        // matching "all select ones appear out side".
        if (selectedIds.includes(u.id)) return false;

        return u.name.toLowerCase().includes(query.toLowerCase()) ||
            u.email.toLowerCase().includes(query.toLowerCase()) ||
            role.includes(query.toLowerCase());
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `<p style="padding:10px; color:#94a3b8;">No matching members</p>`;
        return;
    }

    filtered.forEach(u => {
        const roleBadge = u.role ? `<span class="role-badge role-${u.role.toLowerCase()}">${u.role.toUpperCase()}</span>` : '';

        // Create clickable item
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; flex-grow:1;">
                <div class="avatar-circle">${u.name.charAt(0)}</div>
                <div>
                    <div style="font-weight:600; color:#334155;">${u.name}</div>
                    <div style="font-size:0.75em; color:#94a3b8;">${u.email}</div>
                </div>
                ${roleBadge}
            </div>
        `;

        // Click -> Select -> Clear Input
        item.onclick = (e) => {
            e.stopPropagation();
            selectMemberForWorkspace(u);
        };

        listContainer.appendChild(item);
    });
}

/**
 * Update Selected Members UI
 */
function updateSelectedDisplay() {
    const container = document.getElementById('selected-members-container');
    if (!container) return;

    container.innerHTML = '';

    if (!window.workspaceSelectedUsers || window.workspaceSelectedUsers.length === 0) {
        container.innerHTML = '<div style="color:#94a3b8; font-style:italic; padding:10px;">No members selected</div>';
        return;
    }

    window.workspaceSelectedUsers.forEach(u => {
        const chip = document.createElement('div');
        chip.className = 'member-chip';
        chip.style.cssText = 'display: inline-flex; align-items: center; background: #e0f2fe; padding: 5px 10px; border-radius: 15px; margin: 3px; font-size: 0.85em; color: #0369a1; box-shadow: 0 1px 2px rgba(0,0,0,0.05);';

        // Add onclick to remove
        chip.setAttribute('onclick', `removeMember(${u.id})`);

        chip.innerHTML = `
            <span>${u.name}</span>
            <span class="remove-x" style="margin-left: 8px; cursor: pointer; color: #0284c7; font-weight: bold;">×</span>
        `;
        container.appendChild(chip);
    });
}

// Alias required for window export
const updateMembersDisplay = updateSelectedDisplay;

/**
 * Add Member to Workspace Selection
 */
function selectMemberForWorkspace(user) {
    // Add to state
    window.workspaceSelectedUsers.push({
        id: user.id,
        name: user.name,
        role: user.role || 'client'
    });

    // Update Display
    updateSelectedDisplay();

    // Clear Input & Re-render dropdown (to hide this user)
    const input = document.getElementById('member-search-input');
    if (input) {
        input.value = '';
        input.focus();
    }

    // Refresh list to remove the selected user
    filterUnifiedMembers('');
}

// Global scope
window.renderUnifiedMemberSelect = renderUnifiedMemberSelect;
window.selectMemberForWorkspace = selectMemberForWorkspace;

/**
 * Open Workspace Modal in Edit Mode
 */
window.openEditWorkspaceModal = async function (wsDataSafe) {
    try {
        const ws = JSON.parse(decodeURIComponent(wsDataSafe));
        window.editingWorkspaceId = ws.id;

        // UI Updates
        document.querySelector('#workspace-modal h3').textContent = 'Edit Workspace';
        const submitBtn = document.getElementById('btn-submit-workspace');
        if (submitBtn) submitBtn.textContent = 'Save Changes';

        const nameInput = document.getElementById('ws-name');
        if (nameInput) nameInput.value = ws.display_name || ws.name;

        // Fetch all users first to populate selection
        const res = await fetch(window.API_BASE + '/api/users', { credentials: 'include' });
        const allUsers = await res.json();
        window.workspaceModalUsers = allUsers;

        // Populate Selected Users from WS data
        // ws.users is an array of IDs [1, 2, 3]
        window.workspaceSelectedUsers = [];
        if (ws.users && Array.isArray(ws.users)) {
            ws.users.forEach(uid => {
                // Use loose equality to match string IDs with number IDs
                const userObj = allUsers.find(u => u.id == uid);
                if (userObj) {
                    window.workspaceSelectedUsers.push({
                        id: userObj.id,
                        name: userObj.name,
                        role: userObj.role
                    });
                }
            });
        }

        // Render List & Selection
        renderUnifiedMemberSelect(allUsers);
        updateSelectedDisplay();

        // Show Modal
        document.getElementById('workspace-modal').style.display = 'block';

    } catch (e) {
        console.error('Error opening edit modal', e);
        showToast('Failed to load workspace details', 'error');
    }
};



/**
 * Update the Pink Highlighted Display Area
 */
function updateSelectedDisplay() {
    const container = document.getElementById('selected-members-container');
    if (!container) return;

    if (window.workspaceSelectedUsers.length === 0) {
        container.innerHTML = '<div style="color:#94a3b8; font-style:italic; padding:10px;">No members selected</div>';
        // Reset hidden admin
        const adminInput = document.getElementById('ws-admin-id');
        if (adminInput) adminInput.value = '';
        return;
    }

    container.innerHTML = '';
    window.workspaceSelectedUsers.forEach(user => {
        const roleColor = user.role === 'admin' ? '#ef4444' : (user.role === 'team' ? '#3b82f6' : '#10b981');

        // External Row Style
        const row = document.createElement('div');
        row.className = 'selected-member-row';
        row.innerHTML = `
            <span class="member-name">${user.name}</span>
            <span class="remove-icon" data-uid="${user.id}" title="Remove">✕</span>
        `;
        container.appendChild(row);
    });

    // Auto-assign first admin as adminId, or first user
    const adminInput = document.getElementById('ws-admin-id');
    if (adminInput) {
        const adminUser = window.workspaceSelectedUsers.find(u => u.role === 'admin');
        adminInput.value = adminUser ? adminUser.id : (window.workspaceSelectedUsers[0]?.id || '');
    }
}

// Delegated Listener for User Removal (Static Container)
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('selected-members-container');
    if (container) {
        container.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-icon')) {
                const uid = e.target.getAttribute('data-uid');
                if (uid) {
                    removeMember(uid);
                }
            }
        });
    }

    // Attach Autocomplete Listeners (Global)
    const searchInput = document.getElementById('member-search-input');
    const dropdownMenu = document.getElementById('dropdown-menu-members');

    if (searchInput && dropdownMenu) {
        // Focus/Input -> Show & Filter
        searchInput.onclick = (e) => {
            e.stopPropagation();
            dropdownMenu.style.display = 'block';
            searchInput.classList.add('active');
        };

        searchInput.oninput = (e) => {
            dropdownMenu.style.display = 'block';
            filterUnifiedMembers(e.target.value);
        };

        // Click Outside -> Hide 
        // Note: document.click listener might be cumulative if not careful, 
        // but since this is DOMContentLoaded it should be fine running once.
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#dropdown-members')) {
                dropdownMenu.style.display = 'none';
                searchInput.classList.remove('active');
            }
        });
    }
});

function removeMember(userId) {
    window.workspaceSelectedUsers = window.workspaceSelectedUsers.filter(u => u.id != userId);
    updateSelectedDisplay();
    // Refresh dropdown to show this user again
    if (window.filterUnifiedMembers) window.filterUnifiedMembers('');

    // Uncheck box if visible
    const cb = document.getElementById(`user-${userId}`);
    if (cb) cb.checked = false;
}

function filterUnifiedMembers(query) {
    if (window.workspaceModalUsers) {
        renderUnifiedMemberSelect(window.workspaceModalUsers, query);
    }
}

// Compatibility Aliases (Fixes ReferenceErrors)
const filterWorkspaceUsers = filterUnifiedMembers;
const filterUnifiedUsers = filterUnifiedMembers;
const renderUnifiedUserList = renderUnifiedMemberSelect;

// Ensure toggleMultiSelect exists (stub if missing, or alias if renamed)
// If it was removed, we define a no-op or restore it.
// Assuming it was the checkbox toggle for "Select Multiple"
function toggleMultiSelect() {
    console.warn('toggleMultiSelect is deprecated/removed');
}


// Expose globals
window.toggleMultiSelect = toggleMultiSelect;
window.removeMember = removeMember;
window.filterUnifiedMembers = filterUnifiedMembers;

window.removeSelectedUser = removeSelectedUser;
window.updateMemberTrigger = updateMemberTrigger;
window.updateMembersDisplay = updateMembersDisplay;
window.filterWorkspaceUsers = filterWorkspaceUsers;
window.filterUnifiedUsers = filterUnifiedUsers;
window.renderUnifiedUserList = renderUnifiedUserList;
window.submitNewWorkspace = submitNewWorkspace;


/* --- NEW TARGET VIEW IMPLEMENTATION --- */

window.loadTargetView = async function (targetId, workspaceId) {
    console.log(`[SPA] Loading Target View (New): ID ${targetId}, WS ${workspaceId}`);

    injectTargetModals();
    currentTargetId = targetId;
    currentWorkspaceId = workspaceId;
    currentViewContext = { name: 'target_view', params: { targetId, workspaceId } };

    const mainRender = document.getElementById('main-render');
    mainRender.innerHTML = '<div class="loader"></div>';

    try {
        const [dataRes, membersRes] = await Promise.all([
            fetch(window.API_BASE + `/api/targets/${targetId}/data?workspaceId=${workspaceId}`, { credentials: 'include' }),
            fetch(window.API_BASE + `/api/targets/${targetId}/members`, { credentials: 'include' })
        ]);

        if (!dataRes.ok) throw new Error('Failed to load target data');
        const data = await dataRes.json();

        let members = [];
        if (membersRes.ok) members = await membersRes.json();

        currentTargetSchema = data.columns;
        // Parse Goals from JSON string
        let goalsConfig = {};
        try { goalsConfig = data.goals ? JSON.parse(data.goals) : {}; } catch (e) { }

        // Permissions Check — auth.js sets window.userRole on login
        const userRole = (window.userRole || 'client').toLowerCase();
        console.log(`[TargetView] Role: ${userRole}`);

        const isTeamOrAbove = ['owner', 'ceo', 'admin', 'team'].includes(userRole);
        const isAdminOrOwner = ['owner', 'ceo', 'admin'].includes(userRole);
        // Team cannot edit structure, only content (future)

        // --- Prepare Header Members Stack (Assigned + Avatar ONLY) ---
        let membersHTML = '';
        const assignedWithAvatar = (members || []).filter(m => m.isAssigned && m.avatar && m.avatar.trim() !== '');

        if (assignedWithAvatar.length > 0) {
            assignedWithAvatar.slice(0, 8).forEach(m => {
                membersHTML += `
                    <div class="member-avatar-small" title="${m.name} (Assigned)" style="padding:0; overflow:hidden; border:2px solid white; margin-left:-8px; width:34px; height:34px;">
                        <img src="${m.avatar}" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                `;
            });
            if (assignedWithAvatar.length > 8) {
                membersHTML += `<div class="member-avatar-small" style="background:#cbd5e1; color:#334155; margin-left:-8px; border:2px solid white;">+${assignedWithAvatar.length - 8}</div>`;
            }
            // Green highlight wrapper
            membersHTML = `<div style="padding-bottom: 4px; display:flex; gap:0px; cursor:help; margin-left:8px;" title="Target Access Portfolio">${membersHTML}</div>`;
        }

        // --- Render New Layout ---
        mainRender.innerHTML = `
            <div class="target-view-container">
                
                <!-- HEADER -->
                <div class="target-view-header">
                    <div class="header-left">
                        <div style="display:flex; align-items:flex-start; gap:15px;">
                            <button onclick="loadWorkspaceList()" class="back-link" style="margin-top:5px; font-size: 1.2rem; color: #6366f1; background:none; border:none; cursor:pointer;">
                                ◀
                            </button>
                            <div>
                                <h2 style="margin:0; line-height:1.2;">${data.targetName || 'Target'} ${data.startDate && data.endDate ? (() => { const days = Math.ceil((new Date(data.endDate) - new Date(data.startDate)) / (1000 * 60 * 60 * 24)) + 1; return `<span style="font-size:0.65em; font-weight:500; color:#94a3b8; vertical-align:middle;">(${days} days)</span>`; })() : ''}</h2>
                                <button onclick="loadWorkspaceList()" class="back-link" style="background:none; border:none; color:#64748b; cursor:pointer; padding:0;">back to workspace</button>
                            </div>
                        </div>
                    </div>
                    <div class="header-right" style="display:flex; align-items:center; gap:20px;">
                        ${isAdminOrOwner ? `
                        <button onclick="window.showAccessModal()" class="access-btn-header" style="background:#f1f5f9; border:none; border-radius:8px; padding:8px 12px; cursor:pointer; font-size:1.1em; display:flex; align-items:center; gap:6px; color:#475569; transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.05);" onmouseover="this.style.background='#e2e8f0'; this.style.color='#1e293b';" onmouseout="this.style.background='#f1f5f9'; this.style.color='#475569';">
                            <span style="font-size:1.2em;">👤</span>
                            <span style="font-size:0.85em; font-weight:600; text-transform:uppercase; letter-spacing:0.03em;">Access</span>
                        </button>
                        ` : ''}
                        ${isTeamOrAbove ? `
                        <button onclick="window.showHistoryModal()" class="history-btn-header" style="background:#f1f5f9; border:none; border-radius:8px; padding:8px 12px; cursor:pointer; font-size:1.1em; display:flex; align-items:center; gap:6px; color:#475569; transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.05);" onmouseover="this.style.background='#e2e8f0'; this.style.color='#1e293b';" onmouseout="this.style.background='#f1f5f9'; this.style.color='#475569';">
                            <span style="font-size:1.2em;">🕒</span>
                            <span style="font-size:0.85em; font-weight:600; text-transform:uppercase; letter-spacing:0.03em;">History</span>
                        </button>
                        ` : ''}
                         <div class="member-stack">
                            ${membersHTML}
                         </div>
                    </div>
                </div>

                <!-- DATE BAR -->
                <div class="date-context-bar">
                    📅 ${data.startDate && data.endDate ? (() => {
                const fmtOpts = { month: 'short', day: 'numeric' };
                const fmtOptsYear = { month: 'short', day: 'numeric', year: 'numeric' };
                const s = new Date(data.startDate).toLocaleDateString('en-US', fmtOpts);
                const e = new Date(data.endDate).toLocaleDateString('en-US', fmtOptsYear);
                return s + ' &rarr; ' + e;
            })() : new Date().toLocaleDateString()}
                </div>

                <!-- METRICS TABLE -->
                <div class="metrics-section">
                    <table class="metrics-table" style="width:100%; border-collapse:collapse; font-size:0.88rem;">
                        <thead>
                            <tr style="border-bottom:2px solid #e2e8f0;">
                                <th style="padding:7px 12px; text-align:left; font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8;">METRIC</th>
                                <th style="padding:7px 12px; text-align:left; font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8;">TARGET</th>
                                <th style="padding:7px 12px; text-align:left; font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8;">DAILY</th>
                                <th style="padding:7px 12px; text-align:left; font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8;">CURRENT</th>
                                <th style="padding:7px 12px; text-align:left; font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8;">STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(() => {
                const numDays = (data.startDate && data.endDate) ? Math.ceil((new Date(data.endDate) - new Date(data.startDate)) / (1000 * 60 * 60 * 24)) + 1 : 0;
                const DEFAULT_METRICS = [
                    { type: 'default', label: 'Post Impressions', key: 'impressions' },
                    { type: 'default', label: 'Post Engagements', key: 'engagements' },
                    { type: 'default', label: 'Follower Count', key: 'followers' },
                    { type: 'default', label: 'Profile Views', key: 'profile_views' },
                    { type: 'default', label: 'Calls Booked', key: 'calls_booked' },
                ];
                // Use unified ordered list; fall back to defaults if not yet initialised OR empty
                const allMetrics = (Array.isArray(goalsConfig.__allMetrics__) && goalsConfig.__allMetrics__.length > 0)
                    ? goalsConfig.__allMetrics__
                    : [
                        ...DEFAULT_METRICS,
                        ...(Array.isArray(goalsConfig.__metrics__) ? goalsConfig.__metrics__.map(m => ({ type: 'custom', label: m.label, key: m.key })) : [])
                    ];
                return allMetrics.map(m =>
                    renderMetricRow(m.label, m.key, goalsConfig, data.rows, isAdminOrOwner, numDays, isAdminOrOwner && m.type === 'custom')
                ).join('');
            })()}
                        </tbody>
                    </table>
                    ${isAdminOrOwner ? `
                    <button onclick="window.addCustomMetric()" style="margin-top:6px; display:flex; align-items:center; gap:6px; background:none; border:1px dashed #cbd5e1; border-radius:8px; padding:5px 14px; color:#64748b; font-size:0.82rem; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.borderColor='#0ea5e9';this.style.color='#0ea5e9';" onmouseout="this.style.borderColor='#cbd5e1';this.style.color='#64748b';">
                        <span style="font-size:1.1em; line-height:1;">+</span> Add Metric
                    </button>` : ''}
                </div>


                <!-- DATA SPREADSHEET SECTION -->
                <div class="spreadsheet-section">
                    <!-- Toolbar: label only — use right-click for actions -->
                    <div class="toolbar" style="display:flex; padding:10px 15px; background:#f8fafc; border-bottom:1px solid #e2e8f0; border-radius:8px 8px 0 0; align-items:center;">
                        <span style="font-weight:600; color:#334155;">
                            Data <span style="font-weight:400; color:#94a3b8; font-size:0.85em;">(${data.rows ? data.rows.length : 0} rows)</span>
                        </span>
                        <span style="margin-left:auto; font-size:0.8em; color:#94a3b8; font-style:italic;">Right-click to add, edit or delete</span>
                    </div>

                    <div class="table-container" style="overflow-x: auto; max-height: 500px;">
                        <table id="target-data-table" style="width: 100%; border-collapse: collapse; min-width: 600px;">
                            <thead>
                                <tr id="table-header-row" style="background: #e2e8f0; text-align: left; position: sticky; top: 0;">
                                    <!-- Headers injected here -->
                                </tr>
                            </thead>
                            <tbody id="table-body">
                                <!-- Rows injected here -->
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        `;

        renderTargetTable(data.columns, data.rows, isAdminOrOwner);
        setupMetricsContextMenu(goalsConfig, isAdminOrOwner);

    } catch (err) {
        console.error("Error loading target view:", err);
        mainRender.innerHTML = `<div class="error-state">Failed to load target data. <button onclick="loadTargetView('${targetId}', '${workspaceId}')">Retry</button></div>`;
    }
};

function renderMetricRow(label, colKey, goals, rows, editable, numDays, deletable) {
    const targetVal = parseFloat(goals[label]) || 0;
    const current = (rows || []).reduce((sum, r) => sum + (parseFloat(r[colKey]) || 0), 0);

    // Status
    let statusHTML = '<span style="color:#94a3b8;">—</span>';
    if (targetVal > 0) {
        const pct = Math.round((current / targetVal) * 100);
        const color = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';
        const emoji = pct >= 80 ? '🟢' : pct >= 50 ? '🟡' : '🔴';
        statusHTML = `<span style="font-weight:700; color:${color};">${emoji} ${pct}%</span>`;
    }

    // Target input or display
    const inputHTML = editable
        ? `<input type="number" value="${targetVal || ''}" style="width:72px; padding:3px 7px; border:1px solid #e2e8f0; border-radius:4px; font-size:0.88rem; text-align:right;"
              onchange="saveGoal('${label}', this.value)" placeholder="Set">`
        : `<span style="font-weight:600; color:#334155;">${targetVal > 0 ? targetVal.toLocaleString() : '—'}</span>`;

    // Daily target = totalTarget / numDays
    let dailyHTML = '<span style="color:#94a3b8;">—</span>';
    if (numDays > 0 && targetVal > 0) {
        const dailyVal = targetVal / numDays;
        const dailyDisplay = Number.isInteger(dailyVal) ? dailyVal.toLocaleString() : dailyVal.toFixed(2);
        dailyHTML = `<span style="color:#64748b; font-size:0.85em;">${dailyDisplay}<span style="color:#94a3b8; font-size:0.8em;"> /day</span></span>`;
    }

    // Delete button for custom metrics
    const labelCell = deletable
        ? `<td style="padding:6px 12px; color:#334155; font-weight:500;">${label}
               <button onclick="window.deleteCustomMetric('${label.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${colKey}')" title="Remove metric" style="margin-left:6px; background:none; border:none; cursor:pointer; color:#cbd5e1; font-size:0.9em; line-height:1; padding:0; vertical-align:middle; transition:color 0.15s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#cbd5e1'">×</button>
           </td>`
        : `<td style="padding:6px 12px; color:#334155; font-weight:500;">${label}</td>`;

    return `
        <tr style="border-bottom:1px solid #f1f5f9;">
            ${labelCell}
            <td style="padding:6px 12px;">${inputHTML}</td>
            <td style="padding:6px 12px;">${dailyHTML}</td>
            <td style="padding:6px 12px; font-weight:600; color:#334155;">${current > 0 ? current.toLocaleString() : '0'}</td>
            <td style="padding:6px 12px;">${statusHTML}</td>
        </tr>
    `;
}

// ─── Add / Delete Custom Metric ───────────────────────────────────────────────

// ─── Shared helper: load goals + build/return __allMetrics__ ─────────────────
async function getOrInitAllMetrics() {
    const fetchRes = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/data?workspaceId=${currentWorkspaceId}`, { credentials: 'include' });
    const data = await fetchRes.json();
    let goals = data.goals ? JSON.parse(data.goals) : {};
    if (!Array.isArray(goals.__allMetrics__)) {
        // First time: build from legacy __metrics__ + defaults
        const legacyCustom = Array.isArray(goals.__metrics__) ? goals.__metrics__ : [];
        goals.__allMetrics__ = [
            { type: 'default', label: 'Post Impressions', key: 'impressions' },
            { type: 'default', label: 'Post Engagements', key: 'engagements' },
            { type: 'default', label: 'Follower Count', key: 'followers' },
            { type: 'default', label: 'Profile Views', key: 'profile_views' },
            { type: 'default', label: 'Calls Booked', key: 'calls_booked' },
            ...legacyCustom.map(m => ({ type: 'custom', label: m.label, key: m.key }))
        ];
    }
    return { goals };
}

async function saveGoals(goals) {
    await fetch(window.API_BASE + `/api/targets/${currentTargetId}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ goals })
    });
}

// Add Custom Metric (appends at end)
window.addCustomMetric = async function () {
    const label = await showInputModal({
        title: 'Add Metric',
        subtitle: 'A new column will be added to the data table',
        label: 'Metric Name',
        placeholder: 'e.g. Stories Views',
        confirmText: 'Add Metric',
        icon: '📊'
    });
    if (!label || !label.trim()) return;
    await _createMetricAt(label.trim(), Infinity); // append at end
};

// Internal: create column + insert into __allMetrics__ at visual position
async function _createMetricAt(safeLabel, insertIdx) {
    const colKey = safeLabel.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    try {
        const colRes = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/columns?workspaceId=${currentWorkspaceId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name: safeLabel, type: 'TEXT' })
        });
        if (!colRes.ok) {
            const d = await colRes.json();
            showToast(d.message || 'Failed to create column', 'error');
            return;
        }
        const { goals } = await getOrInitAllMetrics();
        if (!goals.__allMetrics__.some(m => m.key === colKey)) {
            const idx = Math.min(insertIdx, goals.__allMetrics__.length);
            goals.__allMetrics__.splice(idx, 0, { type: 'custom', label: safeLabel, key: colKey });
        }
        await saveGoals(goals);
        showToast(`Metric "${safeLabel}" added!`, 'success');
        refreshTargetData();
    } catch (e) {
        console.error('_createMetricAt error', e);
        showToast('Server error', 'error');
    }
}

window.deleteCustomMetric = async function (label, colKey) {
    const confirmed = await showConfirmModal({
        title: 'Remove Metric',
        subtitle: `"${label}"`,
        message: `This will permanently delete the <strong>${label}</strong> column and all its data. This cannot be undone.`,
        confirmText: 'Delete Metric',
        confirmColor: '#ef4444',
        icon: '🗑️'
    });
    if (!confirmed) return;
    try {
        // 1. Delete the actual DB column
        const colRes = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/columns/${colKey}?workspaceId=${currentWorkspaceId}`, {
            method: 'DELETE', credentials: 'include'
        });
        if (!colRes.ok) {
            const d = await colRes.json().catch(() => ({}));
            showToast(d.message || 'Failed to delete column', 'error');
            return;
        }
        // 2. Remove from __allMetrics__ and any goal value
        const { goals } = await getOrInitAllMetrics();
        goals.__allMetrics__ = goals.__allMetrics__.filter(m => m.key !== colKey);
        delete goals[label];
        await saveGoals(goals);
        showToast(`Metric "${label}" removed`, 'success');
        refreshTargetData();
    } catch (e) {
        console.error('deleteCustomMetric error', e);
        showToast('Server error', 'error');
    }
};

// ─── Metrics Context Menu ───────────────────────────────────────────────
function setupMetricsContextMenu(goalsConfig, isAdminOrOwner) {
    if (!isAdminOrOwner) return;
    const metricsTable = document.querySelector('.metrics-section .metrics-table');
    if (!metricsTable) return;

    // Match the same allMetrics logic used in rendering (length>0 guard)
    const DEFAULT_METRICS = [
        { type: 'default', label: 'Post Impressions', key: 'impressions' },
        { type: 'default', label: 'Post Engagements', key: 'engagements' },
        { type: 'default', label: 'Follower Count', key: 'followers' },
        { type: 'default', label: 'Profile Views', key: 'profile_views' },
        { type: 'default', label: 'Calls Booked', key: 'calls_booked' },
    ];
    const allMetrics = (Array.isArray(goalsConfig.__allMetrics__) && goalsConfig.__allMetrics__.length > 0)
        ? goalsConfig.__allMetrics__
        : [...DEFAULT_METRICS, ...(Array.isArray(goalsConfig.__metrics__) ? goalsConfig.__metrics__.map(m => ({ type: 'custom', label: m.label, key: m.key })) : [])];

    metricsTable.querySelectorAll('tbody tr').forEach((tr, rowIdx) => {
        const m = allMetrics[rowIdx];
        if (!m) return;

        tr.style.cursor = 'default';
        tr.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const items = [
                { icon: '↑', label: 'Add Metric Above', action: () => window.addCustomMetricAt(rowIdx) },
                { icon: '↓', label: 'Add Metric Below', action: () => window.addCustomMetricAt(rowIdx + 1) },
                'sep',
                // Edit shown for ALL rows (default: renames label only; custom: renames label + DB column)
                { icon: '✏️', label: 'Edit Metric Name', action: () => window.editMetricLabel(m.label, m.key, m.type) },
                'sep',
            ];

            if (m.type === 'default') {
                items.push({ icon: '🗑️', label: `Remove “${m.label}”`, danger: true, action: () => window.hideDefaultMetric(m.label, m.key, rowIdx) });
            } else {
                items.push({ icon: '🗑️', label: `Delete “${m.label}”`, danger: true, action: () => window.deleteCustomMetric(m.label, m.key) });
            }

            showCtxMenu(e.clientX, e.clientY, items);
        });
    });
}

// Add metric at a specific visual position
window.addCustomMetricAt = async function (insertIdx) {
    const label = await showInputModal({
        title: 'Add Metric',
        subtitle: 'A new column will be added to the data table',
        label: 'Metric Name',
        placeholder: 'e.g. Stories Views',
        confirmText: 'Add Metric',
        icon: '📊'
    });
    if (!label || !label.trim()) return;
    await _createMetricAt(label.trim(), insertIdx);
};

// Rename a metric: for defaults → label only; for customs → label + DB column name
window.editMetricLabel = async function (oldLabel, colKey, metricType) {
    const newLabel = await showInputModal({
        title: 'Edit Metric Name',
        subtitle: `Current: “${oldLabel}”`,
        label: 'New Name',
        placeholder: oldLabel,
        defaultValue: oldLabel,
        confirmText: 'Rename',
        icon: '✏️'
    });
    if (!newLabel || !newLabel.trim() || newLabel.trim() === oldLabel) return;
    const safeNew = newLabel.trim();

    try {
        if (metricType === 'custom') {
            // For custom: PATCH the DB column name first (bi-directional sync)
            const res = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/columns/${colKey}?workspaceId=${currentWorkspaceId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ newName: safeNew })
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                showToast(d.message || 'Failed to rename column', 'error');
                return;
            }
            // Update localStorage order
            const safeKey = safeNew.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
            const order = getColOrder();
            if (order) {
                const idx = order.indexOf(colKey);
                if (idx >= 0) order[idx] = safeKey;
                setColOrder(order);
            }
        }
        // Always update label (and key for custom) in __allMetrics__
        const { goals } = await getOrInitAllMetrics();
        const m = goals.__allMetrics__.find(x => x.key === colKey);
        if (m) {
            if (goals[oldLabel] !== undefined) { goals[safeNew] = goals[oldLabel]; delete goals[oldLabel]; }
            m.label = safeNew;
            if (metricType === 'custom') {
                m.key = safeNew.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
            }
        }
        await saveGoals(goals);
        showToast(`Renamed to “${safeNew}”`, 'success');
        refreshTargetData();
    } catch (e) {
        console.error('editMetricLabel error', e);
        showToast('Server error', 'error');
    }
};

// Keep old name as alias (used by × delete button on custom rows which calls editCustomMetric)
window.editCustomMetric = (label, key) => window.editMetricLabel(label, key, 'custom');


// Hide a built-in default metric (removes from __allMetrics__, column stays in DB)
window.hideDefaultMetric = async function (label, colKey, rowIdx) {
    const confirmed = await showConfirmModal({
        title: 'Remove Metric',
        subtitle: `"${label}"`,
        message: `This will hide <strong>${label}</strong> from the metrics table. No data is deleted — the column stays in the spreadsheet below.`,
        confirmText: 'Remove',
        confirmColor: '#ef4444',
        icon: '🗑️'
    });
    if (!confirmed) return;
    try {
        const { goals } = await getOrInitAllMetrics();
        goals.__allMetrics__ = goals.__allMetrics__.filter(m => m.key !== colKey);
        await saveGoals(goals);
        showToast(`"${label}" removed from metrics`, 'success');
        refreshTargetData();
    } catch (e) {
        console.error('hideDefaultMetric error', e);
        showToast('Server error', 'error');
    }
};


window.saveGoal = async function (metric, value) {
    try {
        const fetchRes = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/data?workspaceId=${currentWorkspaceId}`, { credentials: 'include' });
        const data = await fetchRes.json();
        let goals = data.goals ? JSON.parse(data.goals) : {};
        goals[metric] = value;

        await fetch(window.API_BASE + `/api/targets/${currentTargetId}/goals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goals }),
            credentials: 'include'
        });
        // Success feedback?
        const saveIndicator = document.createElement('div');
        saveIndicator.innerText = 'Goals Saved';
        saveIndicator.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#10b981; color:white; padding:10px 20px; border-radius:4px; z-index:9999; animation: fadeOut 2s forwards;';
        document.body.appendChild(saveIndicator);
        setTimeout(() => saveIndicator.remove(), 2000);

    } catch (e) {
        console.error("Save goal failed", e);
        alert("Failed to save goal");
    }
};

window.showHistoryModal = async function () {
    const modalId = 'history-modal';
    let modal = document.getElementById(modalId);
    if (modal) modal.remove(); // Re-create to refresh cleaner

    modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:9999;';
    document.body.appendChild(modal);

    modal.innerHTML = `
        <div style="background:white; padding:25px; border-radius:8px; width:500px; max-height:80vh; overflow-y:auto; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid #e2e8f0; padding-bottom:10px;">
                <h3 style="margin:0;">History Logs</h3>
                <button onclick="document.getElementById('${modalId}').remove()" style="border:none;background:none;font-size:1.5em;cursor:pointer;">&times;</button>
            </div>
            <div id="history-content">
                <div class="loader-small" style="text-align:center; padding:20px;">Loading logs...</div>
            </div>
        </div>
    `;

    try {
        const res = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/logs`, { credentials: 'include' });
        const logs = await res.json();

        const content = document.getElementById('history-content');
        if (logs.length === 0) {
            content.innerHTML = '<p style="color:#94a3b8; text-align:center;">No recent history.</p>';
        } else {
            content.innerHTML = logs.map(l => `
                <div style="border-bottom:1px solid #f1f5f9; padding:12px 0;">
                    <div style="font-weight:600;font-size:0.9em; color:#334155;">${l.action.replace(/_/g, ' ')}</div>
                    <div style="color:#64748b; font-size:0.8em; margin-top:4px;">
                        ${new Date(l.timestamp).toLocaleString()} • ${l.email}
                    </div>
                </div>
            `).join('');
        }
    } catch (e) {
        const content = document.getElementById('history-content');
        if (content) content.innerText = "Failed to load history.";
    }
};

window.showAccessModal = async function () {
    const modalId = 'access-modal';
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:9999;backdrop-filter:blur(2px);';
    document.body.appendChild(modal);

    modal.innerHTML = `
        <div style="background:white; padding:30px; border-radius:14px; width:460px; max-height:88vh; display:flex; flex-direction:column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);">
            <!-- Header -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                <div>
                    <h3 style="margin:0; color:#1e293b; font-size:1.2rem; font-weight:700;">Target Access</h3>
                    <p style="margin:4px 0 0; color:#64748b; font-size:0.82rem;">Assign team &amp; client members to this target.</p>
                </div>
                <button onclick="document.getElementById('${modalId}').remove()" style="border:none;background:#f1f5f9;color:#64748b;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:1.2rem;line-height:1;display:flex;align-items:center;justify-content:center;">&times;</button>
            </div>

            <hr style="border:none; border-top:1px solid #e2e8f0; margin:16px 0;">

            <!-- Search -->
            <div style="position:relative; margin-bottom:12px;">
                <input type="text" id="access-search" placeholder="Search members..." autocomplete="off"
                    style="width:100%; padding:10px 14px; border:1px solid #cbd5e1; border-radius:8px; font-size:0.9rem; box-sizing:border-box; outline:none; transition:border-color 0.2s;"
                    onfocus="this.style.borderColor='#0ea5e9'" onblur="this.style.borderColor='#cbd5e1'">
                <span style="position:absolute;right:12px;top:50%;transform:translateY(-50%);color:#94a3b8;font-size:0.75rem;">🔍</span>
            </div>

            <!-- Member List -->
            <div id="access-member-list" style="flex:1; overflow-y:auto; max-height:220px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:14px;">
                <div style="text-align:center; padding:20px; color:#94a3b8; font-size:0.85rem;">Loading members...</div>
            </div>

            <!-- Selected Chips -->
            <div style="margin-bottom:6px;">
                <label style="font-size:0.78rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.05em;">Selected Members</label>
            </div>
            <div id="access-selected-chips" style="min-height:44px; border:1px solid #e2e8f0; border-radius:8px; padding:8px; display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px; background:#f8fafc;">
                <span style="color:#94a3b8; font-style:italic; font-size:0.83rem; align-self:center; padding:2px 4px;">No members selected</span>
            </div>

            <!-- Footer -->
            <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #e2e8f0; padding-top:16px;">
                <button onclick="document.getElementById('${modalId}').remove()"
                    style="padding:10px 18px; background:#f1f5f9; color:#475569; border:none; border-radius:8px; font-weight:600; cursor:pointer; font-size:0.9rem;"
                    onmouseover="this.style.background='#e2e8f0';" onmouseout="this.style.background='#f1f5f9';">Cancel</button>
                <button id="btn-save-target-access"
                    style="padding:10px 22px; background:#0ea5e9; color:white; border:none; border-radius:8px; font-weight:600; cursor:pointer; font-size:0.9rem;"
                    onmouseover="this.style.background='#0284c7';" onmouseout="this.style.background='#0ea5e9';">Save Changes</button>
            </div>
        </div>
    `;

    try {
        const res = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/members`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load members');
        const members = await res.json();

        // Only team & client roles (no admin, no owner/ceo)
        const eligibleMembers = (members || []).filter(m => ['team', 'client'].includes((m.role || '').toLowerCase()));

        // State: track selected IDs
        let selectedIds = new Set(eligibleMembers.filter(m => m.isAssigned).map(m => m.id));

        const roleBadgeStyle = (role) => {
            const colors = { team: '#3b82f6', client: '#10b981' };
            return `background:${colors[role] || '#94a3b8'}22; color:${colors[role] || '#64748b'}; padding:1px 7px; border-radius:10px; font-size:0.7rem; font-weight:700; text-transform:uppercase;`;
        };

        const renderChips = () => {
            const chipsEl = document.getElementById('access-selected-chips');
            if (!chipsEl) return;
            const selected = eligibleMembers.filter(m => selectedIds.has(m.id));
            if (selected.length === 0) {
                chipsEl.innerHTML = '<span style="color:#94a3b8; font-style:italic; font-size:0.83rem; align-self:center; padding:2px 4px;">No members selected</span>';
                return;
            }
            chipsEl.innerHTML = selected.map(m => `
                <div style="display:inline-flex; align-items:center; gap:6px; background:#e0f2fe; color:#0369a1; padding:4px 10px; border-radius:20px; font-size:0.82rem; font-weight:600;">
                    <span>${m.name}</span>
                    <span style="cursor:pointer; font-weight:bold; color:#0284c7; font-size:1rem; line-height:1;"
                        onclick="(function(){ window._accessSelectedIds.delete(${m.id}); window._accessRender(); })()">×</span>
                </div>
            `).join('');
        };

        const renderList = (query = '') => {
            const listEl = document.getElementById('access-member-list');
            if (!listEl) return;
            const filtered = eligibleMembers.filter(m =>
                !query ||
                m.name.toLowerCase().includes(query.toLowerCase()) ||
                (m.email || '').toLowerCase().includes(query.toLowerCase())
            );

            if (filtered.length === 0) {
                listEl.innerHTML = '<p style="padding:16px; color:#94a3b8; text-align:center; font-size:0.85rem;">No members found.</p>';
                return;
            }

            listEl.innerHTML = filtered.map(m => {
                const isSelected = selectedIds.has(m.id);
                return `
                    <div onclick="(function(){ if(window._accessSelectedIds.has(${m.id})) window._accessSelectedIds.delete(${m.id}); else window._accessSelectedIds.add(${m.id}); window._accessRender(); })()"
                        style="display:flex; align-items:center; gap:12px; padding:10px 14px; cursor:pointer; border-bottom:1px solid #f1f5f9; transition:background 0.15s; background:${isSelected ? '#f0f9ff' : 'transparent'};"
                        onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='${isSelected ? '#f0f9ff' : 'transparent'}'">
                        <div style="width:36px; height:36px; border-radius:50%; background:#0ea5e922; display:flex; align-items:center; justify-content:center; font-weight:700; color:#0ea5e9; flex-shrink:0;">
                            ${m.name.charAt(0).toUpperCase()}
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:600; color:#1e293b; font-size:0.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${m.name}</div>
                            <div style="font-size:0.75rem; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${m.email || ''}</div>
                        </div>
                        <span style="${roleBadgeStyle(m.role.toLowerCase())}">${m.role}</span>
                        <span style="color:${isSelected ? '#0ea5e9' : '#cbd5e1'}; font-size:1.3rem; flex-shrink:0;">${isSelected ? '✓' : '○'}</span>
                    </div>
                `;
            }).join('');
        };

        // Expose to window so inline onclick handlers can reach them
        window._accessSelectedIds = selectedIds;
        window._accessRender = () => { renderChips(); renderList(document.getElementById('access-search')?.value || ''); };

        // Initial render
        renderList();
        renderChips();

        // Search listener
        const searchInput = document.getElementById('access-search');
        if (searchInput) {
            searchInput.addEventListener('input', e => renderList(e.target.value));
        }

        // Save button
        document.getElementById('btn-save-target-access').addEventListener('click', async () => {
            const ids = Array.from(window._accessSelectedIds).map(id => parseInt(id));
            try {
                const saveRes = await fetch(window.API_BASE + `/api/targets/${currentTargetId}/members`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userIds: ids }),
                    credentials: 'include'
                });
                if (saveRes.ok) {
                    showToast('Target access updated successfully', 'success');
                    document.getElementById(modalId).remove();
                    window.loadTargetView(currentTargetId, currentWorkspaceId);
                } else {
                    const error = await saveRes.json();
                    showToast(error.message || 'Failed to update access', 'error');
                }
            } catch (err) {
                console.error("Save access failed", err);
                showToast('Server connection failed', 'error');
            }
        });

    } catch (e) {
        console.error("Load access members failed", e);
        const listEl = document.getElementById('access-member-list');
        if (listEl) listEl.innerHTML = '<p style="color:#dc2626; text-align:center; padding:20px;">Failed to load members.</p>';
    }
};


