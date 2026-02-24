/**
 * CONFIG.JS — API base URL + auth token management.
 *
 * Strategy: dual-mode auth
 *  - httpOnly cookie  → works when served from the Render URL (same-origin)
 *  - Authorization: Bearer header → works from Vercel (cross-origin)
 *
 * The fetch interceptor below auto-injects the stored token on every /api/ call
 * so dashboard.js doesn't need any modifications.
 */

// ── 1. API Base URL ──────────────────────────────────────────────────────────
if (window.location.hostname === 'branding-pirates-portal-server.onrender.com') {
    window.API_BASE = ''; // Same-origin on Render — cookies work in all browsers
} else {
    window.API_BASE = 'https://branding-pirates-portal-server.onrender.com';
}

// ── 2. Token helpers ─────────────────────────────────────────────────────────
window.setAuthToken = function (token) {
    if (token) localStorage.setItem('authToken', token);
};
window.getAuthToken = function () {
    return localStorage.getItem('authToken');
};
window.clearAuthToken = function () {
    localStorage.removeItem('authToken');
};

// ── 3. Fetch interceptor — auto-inject Bearer token on all API calls ─────────
(function () {
    const _origFetch = window.fetch;
    window.fetch = function (url, opts) {
        opts = opts || {};
        const token = window.getAuthToken();
        if (token) {
            const urlStr = typeof url === 'string' ? url : (url && url.toString ? url.toString() : '');
            if (urlStr.includes('/api/')) {
                // Merge headers without overwriting explicit ones
                opts.headers = Object.assign(
                    { 'Authorization': 'Bearer ' + token },
                    opts.headers || {}
                );
            }
        }
        return _origFetch.call(this, url, opts);
    };
})();
