const loginForm = document.getElementById('loginForm');
const errorDisplay = document.getElementById('error-message');
const loginBtn = document.getElementById('loginBtn');
const loader = document.getElementById('loader');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // UI Feedback: Start Loading
    errorDisplay.style.display = 'none';
    loginBtn.classList.add('loading');

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            // CRITICAL: This allows the browser to receive and store the JWT cookie
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // SUCCESS: Redirect to the dashboard
            // Note: The role is handled by the server-side cookie
            window.location.replace('dashboard.html');
        } else {
            // FAILURE: Show specific error (e.g., "Account Blocked" or "Wrong Password")
            errorDisplay.textContent = data.message || "Authentication failed";
            errorDisplay.style.display = 'block';
        }
    } catch (err) {
        errorDisplay.textContent = "Server connection lost. Please try again.";
        errorDisplay.style.display = 'block';
    } finally {
        loginBtn.classList.remove('loading');
    }
});