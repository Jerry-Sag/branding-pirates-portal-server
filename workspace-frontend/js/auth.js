/**
 * AUTH.JS - THE BOUNCER
 */
async function validateAccess() {
    try {
        const response = await fetch(`${window.API_BASE}/api/verify`, {
            method: 'GET',
            credentials: 'include' // Sends the secure cookie
        });

        const data = await response.json();

        if (response.ok && data.authenticated) {
            // 1. Tell CSS to show the UI
            document.body.classList.add('auth-passed');

            // 2. Set the Role Badge
            document.getElementById('user-role-badge').textContent = data.role.toUpperCase();
            window.userRole = data.role; // GLOBAL ROLE FOR SCRIPTS
            window.userId = data.id; // GLOBAL ID FOR SCRIPTS
            localStorage.setItem('userRole', data.role); // PERMANENT FALLBACK

            // 3. Set the Avatar & Name
            if (data.avatar) {
                document.getElementById('user-avatar').src = data.avatar;
            }
            window.userName = data.name || 'User';

            // Update Sidebar Name Display
            const nameEl = document.getElementById('user-display-name');
            if (nameEl) nameEl.textContent = window.userName.toUpperCase();

            if (typeof updateDashboardGreeting === 'function') {
                updateDashboardGreeting(window.userName);
            }

            // 4. Handle Permission Visibility
            const isCEO = data.role === 'owner' || data.role === 'ceo';
            const isAdmin = isCEO || data.role === 'admin';

            document.querySelectorAll('.ceo-only').forEach(el => el.style.display = isCEO ? 'block' : 'none');
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? 'block' : 'none');

            // Ensure sidebar sub-lists are updated
            if (typeof syncRoleVisibility === 'function') syncRoleVisibility(data.role);

        } else {
            // NO KEY: Send them back to login instantly
            window.location.replace('index.html');
        }
    } catch (err) {
        window.location.replace('index.html');
    }
}

async function logout() {
    await fetch(`${window.API_BASE}/api/logout`, { method: 'POST', credentials: 'include' });
    window.location.replace('index.html');
}
window.logout = logout;

// Start the check immediately
validateAccess();