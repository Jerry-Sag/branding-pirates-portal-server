/**
 * CONFIG.JS — Single source of truth for API URL.
 *
 * AUTO-DETECT: If this page is being served FROM the Render server itself,
 * use an empty API_BASE (same-origin). This means the browser treats the
 * auth cookie as first-party — fixing login in Safari, Brave, Firefox strict mode.
 *
 * If served locally (localhost / file://), fall back to the full Render URL.
 *
 * ✅ Best practice: always open the app via:
 *    https://branding-pirates-portal-server.onrender.com/
 */
if (window.location.hostname === 'branding-pirates-portal-server.onrender.com') {
    window.API_BASE = ''; // Same-origin — cookies work in ALL browsers
} else {
    window.API_BASE = 'https://branding-pirates-portal-server.onrender.com';
}
