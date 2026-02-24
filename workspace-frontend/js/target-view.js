// target-view.js

// Global State
let targetId = null;
let workspaceId = null;
let currentSchema = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    targetId = urlParams.get('id');
    workspaceId = urlParams.get('ws');

    if (!targetId || !workspaceId) {
        showToast('Invalid Target ID or Workspace ID', 'error');
        return;
    }

    fetchTargetData();
});

// Fetch Data
async function fetchTargetData() {
    try {
        const response = await fetch(`/api/targets/${targetId}/data?workspaceId=${workspaceId}`);
        if (!response.ok) throw new Error('Failed to load data');

        const data = await response.json();

        // Update Metadata
        document.getElementById('page-title').textContent = data.targetName || `Target #${targetId}`;
        document.getElementById('page-subtitle').textContent = `Workspace: ${data.workspaceName || 'Unknown'}`;

        // Render Table
        currentSchema = data.columns;
        renderTable(data.columns, data.rows);

    } catch (err) {
        console.error('Fetch error:', err);
        showToast('Error loading target data', 'error');
    }
}

// Render Logic
function renderTable(columns, rows) {
    const thead = document.getElementById('table-header-row');
    const tbody = document.getElementById('table-body');

    // Headers
    thead.innerHTML = '';
    columns.forEach(col => {
        if (col.name === 'id' || col.name === 'created_at') return; // Skip internal fields for now if desired
        thead.innerHTML += `<th>${col.name.replace(/_/g, ' ')}</th>`;
    });
    thead.innerHTML += '<th style="text-align: right;">Actions</th>';

    // Rows
    tbody.innerHTML = '';
    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${columns.length + 1}" style="text-align: center; color: #94a3b8; padding: 40px;">No data entries yet. Add one to get started!</td></tr>`;
        return;
    }

    rows.forEach(row => {
        let rowHTML = '<tr>';
        columns.forEach(col => {
            if (col.name === 'id' || col.name === 'created_at') return;
            const val = row[col.name] || '';
            rowHTML += `<td>${val}</td>`;
        });

        rowHTML += `
            <td style="text-align: right;">
                <button class="btn-action btn-danger" style="display: inline-flex; padding: 4px 8px; font-size: 0.8em;" onclick="deleteRow(${row.id})">Delete</button>
            </td>
        </tr>`;
        tbody.innerHTML += rowHTML;
    });
}

// Modal Actions
function showAddRowModal() {
    const userColumns = currentSchema.filter(c => c.name !== 'id' && c.name !== 'created_at');

    if (userColumns.length === 0) {
        showToast('Please add a column first!', 'warning');
        return;
    }

    const container = document.getElementById('add-row-inputs');
    container.innerHTML = '';

    currentSchema.forEach(col => {
        if (col.name === 'id' || col.name === 'created_at') return;

        let inputType = 'text';
        if (col.type === 'REAL' || col.type === 'INTEGER') inputType = 'number';
        if (col.type === 'DATE') inputType = 'date';

        container.innerHTML += `
            <div class="input-group">
                <label>${col.name.replace(/_/g, ' ')}</label>
                <input type="${inputType}" id="input-${col.name}" name="${col.name}">
            </div>
        `;
    });

    document.getElementById('add-row-modal').style.display = 'block';
}

function showAddColumnModal() {
    document.getElementById('add-col-modal').style.display = 'block';
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
}

// API Actions
async function submitAddRow() {
    const inputs = document.querySelectorAll('#add-row-inputs input');
    const rowData = {};

    inputs.forEach(input => {
        rowData[input.name] = input.value;
    });

    try {
        const response = await fetch(`/api/targets/${targetId}/rows?workspaceId=${workspaceId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rowData)
        });

        if (response.ok) {
            showToast('Entry added!', 'success');
            closeModals();
            fetchTargetData();
        } else {
            showToast('Failed to add entry', 'error');
        }
    } catch (err) {
        showToast('Server error', 'error');
    }
}

async function deleteRow(rowId) {
    if (!confirm('Are you sure you want to delete this row?')) return;

    try {
        const response = await fetch(`/api/targets/${targetId}/rows/${rowId}?workspaceId=${workspaceId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Row deleted', 'success');
            fetchTargetData();
        } else {
            showToast('Failed to delete row', 'error');
        }
    } catch (err) {
        showToast('Server error', 'error');
    }
}

async function submitAddColumn() {
    const name = document.getElementById('new-col-name').value.trim();
    const type = document.getElementById('new-col-type').value;

    if (!name) return showToast('Column name required', 'warning');

    // Basic sanitization
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

    try {
        const response = await fetch(`/api/targets/${targetId}/columns?workspaceId=${workspaceId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: safeName, type })
        });

        if (response.ok) {
            showToast('Column added!', 'success');
            closeModals();
            fetchTargetData();
            document.getElementById('new-col-name').value = '';
        } else {
            const data = await response.json();
            showToast(data.message || 'Failed to add column', 'error');
        }
    } catch (err) {
        showToast('Server error', 'error');
    }
}

function refreshData() {
    fetchTargetData();
    showToast('Data refreshed', 'info');
}

// Toast Utility (Simplified)
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        background: ${type === 'error' ? '#fee2e2' : type === 'success' ? '#dcfce7' : '#e0f2fe'};
        color: ${type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#0369a1'};
        padding: 12px 24px;
        border-radius: 8px;
        margin-top: 10px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
