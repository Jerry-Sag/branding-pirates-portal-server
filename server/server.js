require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const cron = require('node-cron');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;

// --- 1. DATABASE CONNECTION (FOLDER-AWARE) ---
const dbPath = path.resolve(__dirname, '../Data Base/database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("❌ Database Error:", err.message);
    else {
        console.log("✅ SUCCESS: System connected to Database at:", dbPath);

        // --- INITIALIZE TABLES ---
        db.serialize(() => {
            // Ensure Workspaces directory exists
            const wsDir = path.resolve(__dirname, '../Data Base/Workspaces');
            if (!fs.existsSync(wsDir)) {
                fs.mkdirSync(wsDir, { recursive: true });
                console.log("📁 Created Workspaces directory");
            }
            // 1. Users Table
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                email TEXT UNIQUE,
                password TEXT,
                role TEXT,
                status TEXT DEFAULT 'Active',
                failed_attempts INTEGER DEFAULT 0,
                avatar TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // 2. Workspaces Registry
            db.run(`CREATE TABLE IF NOT EXISTS workspaces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                display_name TEXT,
                admin_id INTEGER,
                users TEXT,
                status TEXT DEFAULT 'Active',
                columns TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // 3. Activity Logs
            db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                email TEXT,
                action TEXT,
                ip_address TEXT,
                status TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // 4. Central Targets Registry
            db.run(`CREATE TABLE IF NOT EXISTS targets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workspace_id INTEGER,
                target_name TEXT,
                target_db_path TEXT,
                status TEXT DEFAULT 'Active',
                goals TEXT,
                period_type TEXT DEFAULT 'weekly',
                start_date TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
            )`, (err) => {
                if (err) console.error('Error creating targets table:', err);
                // Migrations for existing databases
                db.run(`ALTER TABLE targets ADD COLUMN goals TEXT`, (err) => {
                    if (err && !err.message.includes("duplicate column")) {
                        console.error("Column add error (ignored if exists):", err.message);
                    }
                });
                db.run(`ALTER TABLE targets ADD COLUMN period_type TEXT DEFAULT 'weekly'`, (err) => {
                    if (err && !err.message.includes("duplicate column")) {
                        console.error("Column add error (ignored if exists):", err.message);
                    }
                });
                db.run(`ALTER TABLE targets ADD COLUMN start_date TEXT`, (err) => {
                    if (err && !err.message.includes("duplicate column")) {
                        console.error("Column add error (ignored if exists):", err.message);
                    }
                });
                db.run(`ALTER TABLE targets ADD COLUMN end_date TEXT`, (err) => {
                    if (err && !err.message.includes("duplicate column")) {
                        console.error("Column add error (ignored if exists):", err.message);
                    }
                });
                db.run(`ALTER TABLE targets ADD COLUMN target_users TEXT`, (err) => {
                    if (err && !err.message.includes("duplicate column")) {
                        console.error("Column add error (ignored if exists):", err.message);
                    }
                });
            });
            console.log("🛠️  Database Tables Verified/Created");
        });
    }
});

// --- 2. SECURITY MIDDLEWARE ---

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https://ui-avatars.com", "https://i.ibb.co"],
        },
    },
}));

// Compression
app.use(compression());

// Body parsing with increased limit for avatars
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

// CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS || '').split(',')
    : ['http://127.0.0.1:5500', 'http://localhost:5500'];

// CORS configuration
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
            return callback(null, true);
        }
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('CORS policy violation'), false);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// --- 3. SERVE FRONTEND STATIC FILES ---
const frontendPath = path.resolve(__dirname, '../../workspace-frontend');
app.use(express.static(frontendPath));

// Fallback for SPA routing (important if you use sub-pages)
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(frontendPath, 'dashboard.html'));
});

// Rate limiters
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, // Temporarily increased for debugging
    message: 'Too many login attempts, please try again after 15 minutes',
    skipSuccessfulRequests: true,
});

app.use('/api/', apiLimiter);

// Request logging middleware
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// --- 3. AUTHENTICATION MIDDLEWARE ---

function authenticateToken(req, res, next) {
    const token = req.cookies.authToken;

    if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = decoded;
        next();
    });
}

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }

        next();
    };
}

// --- 4. HELPER FUNCTIONS ---

function logEvent(userId, email, action, ip, status) {
    const sql = `INSERT INTO activity_logs (user_id, email, action, ip_address, status) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [userId || 0, email || 'SYSTEM', action, ip, status]);
}

// --- 5. VALIDATION MIDDLEWARE ---

const validateLogin = [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email format'),
    body('password').notEmpty().withMessage('Password is required'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: errors.array()[0].msg });
        }
        next();
    }
];

const validateUserRegistration = [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email format'),
    body('password').isLength({ min: 4 }).withMessage('Password must be at least 4 characters'),
    body('role').isIn(['owner', 'ceo', 'admin', 'team', 'client']).withMessage('Invalid role'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

// --- 6. AUTHENTICATION ROUTES ---

app.post('/api/login', loginLimiter, validateLogin, async (req, res) => {
    // --- LOGIN LOGIC ---
    const { email, password } = req.body;
    console.log(`🔑 Login Attempt: ${email} (Password Length: ${password.length})`);

    const query = "SELECT * FROM users WHERE email = ?";
    db.get(query, [email], async (err, user) => {
        if (err) {
            console.error("❌ DB Error:", err);
            return res.status(500).json({ message: "Server error" });
        }

        if (!user) {
            console.log("❌ User not found in DB");
            logEvent(null, email, 'LOGIN_FAILURE', req.ip, 'Warning');
            return res.status(401).json({ message: "Authentication failed" }); // Generic message for security
        }

        // Auto-fix: If admin manually set status to 'Active' but failed_attempts is still high
        if (user.status === 'Active' && user.failed_attempts >= 5) {
            console.log("♻️  Auto-resetting failed attempts for reactivated user");
            db.run("UPDATE users SET failed_attempts = 0 WHERE id = ?", [user.id]);
            user.failed_attempts = 0; // Use local copy for this request
        }

        if (user.status && user.status.toLowerCase() === 'blocked') {
            console.log("❌ User is blocked");
            logEvent(user.id, user.email, 'LOGIN_BLOCKED', req.ip, 'Warning');
            return res.status(403).json({ message: "Account Blocked. Contact Admin." });
        }

        try {
            // Compare hashed password
            const passwordMatch = await bcrypt.compare(password, user.password);
            console.log(`[${new Date().toISOString()}] 🔐 Password Match: ${passwordMatch}`);

            if (passwordMatch) {
                console.log(`[${new Date().toISOString()}] ✅ Generating Token...`);
                db.run("UPDATE users SET failed_attempts = 0 WHERE id = ?", [user.id]);

                const token = jwt.sign(
                    { id: user.id, role: user.role },
                    process.env.JWT_SECRET,
                    { expiresIn: '2h' }
                );

                res.cookie('authToken', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    maxAge: 7200000
                });

                logEvent(user.id, user.email, 'LOGIN_SUCCESS', req.ip, 'Success');
                return res.json({
                    success: true,
                    role: user.role,
                    avatar: user.avatar
                });
            } else {
                const attempts = (user.failed_attempts || 0) + 1;

                if (attempts >= 5) {
                    db.run("UPDATE users SET status = 'Blocked' WHERE id = ?", [user.id]);
                    logEvent(user.id, user.email, 'ACCOUNT_LOCKED', req.ip, 'Critical');
                    return res.status(403).json({ message: "Account Blocked: Too many attempts." });
                }

                db.run("UPDATE users SET failed_attempts = ? WHERE id = ?", [attempts, user.id]);
                logEvent(user.id, user.email, 'LOGIN_FAILURE', req.ip, 'Warning');
                const remaining = 5 - attempts;
                return res.status(401).json({ message: `Invalid password. ${remaining} attempts left.` });
            }
        } catch (error) {
            console.error('Login error:', error);
            return res.status(500).json({ message: "Server error" });
        }
    });
});

app.get('/api/verify', (req, res) => {
    const token = req.cookies.authToken;
    console.log(`🔍 Verification Check: Token ${token ? 'PRESENT' : 'MISSING'}`);

    if (!token) {
        return res.json({ authenticated: false });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error(`❌ JWT Verify Failed: ${err.message}`);
            return res.json({ authenticated: false });
        }

        db.get("SELECT name, avatar, status, role FROM users WHERE id = ?", [decoded.id], (err, user) => {
            if (err) {
                console.error("❌ Verify DB Error:", err.message);
                return res.status(500).json({ message: "Database error during verification" });
            }

            if (!user) {
                return res.json({ authenticated: false });
            }

            // Reject if blocked
            if (user.status && user.status.toLowerCase() === 'blocked') {
                console.warn(`⛔ Blocked user ${decoded.id} attempted to verify token.`);
                res.clearCookie('authToken'); // Force logout
                return res.json({ authenticated: false, message: "Account Blocked" });
            }

            console.log(`✅ JWT Verified for User ID: ${decoded.id}, Role: ${user.role}`);
            res.json({
                authenticated: true,
                role: user.role, // Use DB role in case it changed
                id: decoded.id,
                name: user.name,
                avatar: user.avatar
            });
        });
    });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('authToken');
    res.json({ success: true });
});

// --- 7. USER MANAGEMENT ROUTES (OWNER ONLY) ---

// Get users by role
app.get('/api/users', authenticateToken, requireRole('owner', 'ceo', 'admin'), (req, res) => {
    const { role } = req.query;
    const requesterRole = req.user.role;

    let sql = "SELECT id, name, email, role, status, failed_attempts FROM users";
    let params = [];

    // If requester is admin, they can only see team and client users
    if (requesterRole === 'admin') {
        if (role) {
            // Admin requesting specific role - only allow team or client
            if (role !== 'team' && role !== 'client') {
                return res.status(403).json({ message: "Admins can only view team and client users" });
            }
            sql += " WHERE role = ?";
            params.push(role.toLowerCase());
        } else {
            // Admin requesting all users - exclude admin/owner/ceo
            sql += " WHERE role IN ('team', 'client')";
        }
    } else {
        // Owner/CEO can see all users
        if (role) {
            sql += " WHERE role = ?";
            params.push(role.toLowerCase());
        }
    }

    console.log(`🔍 [GET /api/users] Fetching users with role: '${role || 'ALL'}' for ${requesterRole}`);

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Database error" });
        }
        console.log(`✅ [GET /api/users] Found ${rows.length} records.`);
        if (rows.length > 0) {
            console.log('Sample Row Role:', rows[0].role);
        }
        res.json(rows);
    });
});

// Register new user (Owner only)
app.post('/api/users/register', authenticateToken, requireRole('owner', 'ceo', 'admin'), validateUserRegistration, async (req, res) => {
    console.log('--- Register Attempt ---');
    console.log('User requesting:', req.user);
    console.log('Body:', req.body);
    const { email, password, role, name } = req.body;
    const displayName = name || email.split('@')[0];
    const requesterRole = req.user.role;

    // Admins can only create team or client users
    if (requesterRole === 'admin' && !['team', 'client'].includes(role.toLowerCase())) {
        return res.status(403).json({ message: "Admins can only register team or client users" });
    }

    console.log(`[REGISTER] ${requesterRole} attempting to register ${role}: ${email}`);

    // Check if email already exists
    db.get("SELECT id FROM users WHERE email = ?", [email], async (err, existing) => {
        if (existing) {
            return res.status(409).json({ message: "Email already exists" });
        }

        try {
            // Hash password
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

            // Insert user
            const sql = `INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)`;
            db.run(sql, [displayName, email, hashedPassword, role.toLowerCase(), 'Active'], function (err) {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ message: "Failed to create user" });
                }

                logEvent(req.user.id, req.user.email, `USER_CREATED_${this.lastID}`, req.ip, 'Info');
                res.json({ success: true, userId: this.lastID });
            });
        } catch (error) {
            console.error('Registration error:', error);
            return res.status(500).json({ message: "Server error" });
        }
    });
});

// Toggle user status (Block/Active)
app.post('/api/users/toggle-status', authenticateToken, requireRole('owner', 'ceo', 'admin'), (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ message: "User ID required" });
    }

    db.get("SELECT status FROM users WHERE id = ?", [userId], (err, row) => {
        if (err || !row) {
            return res.status(404).json({ message: "User not found" });
        }

        const newStatus = row.status === 'Active' ? 'Blocked' : 'Active';

        db.run("UPDATE users SET status = ?, failed_attempts = 0 WHERE id = ?", [newStatus, userId], (err) => {
            if (err) {
                return res.status(500).json({ message: "Database error" });
            }

            logEvent(req.user.id, req.user.email, `USER_${newStatus}_${userId}`, req.ip, 'Info');
            res.json({ success: true, newStatus });
        });
    });
});

// Reset user password (Owner/CEO/Admin only)
app.post('/api/users/reset-password', authenticateToken, requireRole('owner', 'ceo', 'admin'), async (req, res) => {
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword || newPassword.length < 4) {
        return res.status(400).json({ message: "Invalid input" });
    }

    try {
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

        db.run(
            "UPDATE users SET password = ?, failed_attempts = 0 WHERE id = ?",
            [hashedPassword, userId],
            function (err) {
                if (err) {
                    return res.status(500).json({ message: "Database error" });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ message: "User not found" });
                }

                logEvent(req.user.id, req.user.email, `PASSWORD_RESET_${userId}`, req.ip, 'Warning');
                res.json({ success: true });
            }
        );
    } catch (error) {
        console.error('Password reset error:', error);
        return res.status(500).json({ message: "Server error" });
    }
});

// Delete user (Owner/CEO/Admin only)
app.delete('/api/users/:id', authenticateToken, requireRole('owner', 'ceo', 'admin'), (req, res) => {
    const userId = req.params.id;
    const requesterRole = req.user.role;

    console.log(`🗑️ [DELETE] Request to delete User ID: ${userId} by Requester: ${req.user.email} (${requesterRole})`);

    if (!userId) {
        return res.status(400).json({ message: "User ID required" });
    }

    if (parseInt(userId) === req.user.id) {
        console.warn('⚠️ [DELETE] Attempted self-deletion blocked.');
        return res.status(403).json({ message: "Cannot delete your own account" });
    }

    // Check if admin is trying to delete another admin/owner/ceo
    if (requesterRole === 'admin') {
        db.get("SELECT role FROM users WHERE id = ?", [userId], (err, targetUser) => {
            if (err) {
                console.error('❌ [DELETE] Database Error:', err);
                return res.status(500).json({ message: "Database error" });
            }
            if (!targetUser) {
                console.warn(`⚠️ [DELETE] User ID ${userId} not found.`);
                return res.status(404).json({ message: "User not found" });
            }

            // Admins can only delete team and client users
            if (!['team', 'client'].includes(targetUser.role)) {
                console.warn(`⚠️ [DELETE] Admin attempted to delete ${targetUser.role} user.`);
                return res.status(403).json({ message: "Admins can only delete team or client users" });
            }

            // Proceed with deletion
            performDeletion(userId, req, res);
        });
    } else {
        // Owner/CEO can delete anyone
        performDeletion(userId, req, res);
    }
});

function performDeletion(userId, req, res) {
    db.run("DELETE FROM users WHERE id = ?", [userId], function (err) {
        if (err) {
            console.error('❌ [DELETE] Database Error:', err);
            return res.status(500).json({ message: "Database error" });
        }
        if (this.changes === 0) {
            console.warn(`⚠️ [DELETE] User ID ${userId} not found.`);
            return res.status(404).json({ message: "User not found" });
        }
        console.log(`✅ [DELETE] Successfully deleted User ID ${userId}.`);
        logEvent(req.user.id, req.user.email, `USER_DELETED_${userId}`, req.ip, 'Warning');
        res.json({ success: true, message: "User deleted successfully" });
    });
}

// Update user avatar
app.post('/api/users/update-avatar', authenticateToken, (req, res) => {
    const { avatar } = req.body;

    if (!avatar) {
        return res.status(400).json({ message: "Avatar data required" });
    }

    db.run("UPDATE users SET avatar = ? WHERE id = ?", [avatar, req.user.id], function (err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Database error" });
        }

        logEvent(req.user.id, req.user.email, 'AVATAR_UPDATED', req.ip, 'Info');
        res.json({ success: true });
    });
});

// Update own password (Self-service)
app.post('/api/users/update-password', authenticateToken, async (req, res) => {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters long" });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        db.run("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, req.user.id], function (err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: "Database error" });
            }
            logEvent(req.user.id, req.user.email, 'PASSWORD_UPDATED_SELF', req.ip, 'Warning');
            res.json({ success: true, message: "Password updated successfully" });
        });
    } catch (error) {
        console.error('Password update error:', error);
        res.status(500).json({ message: "Server error" });
    }
});

// Get Activity Logs
// Toggle User Status (Active/Blocked)
app.post('/api/users/toggle-status', authenticateToken, (req, res) => {
    const { userId, status } = req.body;
    const requesterRole = req.user.role;

    if (!userId || !status) {
        return res.status(400).json({ message: "User ID and Status required" });
    }

    if (!['Active', 'Blocked'].includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
    }

    // Prevent self-blocking
    if (parseInt(userId) === req.user.id) {
        return res.status(403).json({ message: "Cannot change your own status" });
    }

    // Role-based restrictions
    // Admins can only toggle Team/Client
    if (requesterRole === 'admin') {
        db.get("SELECT role FROM users WHERE id = ?", [userId], (err, targetUser) => {
            if (err || !targetUser) return res.status(404).json({ message: "User not found" });

            if (!['team', 'client'].includes(targetUser.role)) {
                return res.status(403).json({ message: "Insufficient permissions to modify this user" });
            }
            updateUserStatus(userId, status, req, res);
        });
    } else if (requesterRole === 'owner' || requesterRole === 'ceo') {
        // Owner/CEO can toggle anyone (except self, handled above)
        updateUserStatus(userId, status, req, res);
    } else {
        return res.status(403).json({ message: "Unauthorized" });
    }
});

function updateUserStatus(userId, status, req, res) {
    db.run("UPDATE users SET status = ? WHERE id = ?", [status, userId], function (err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Database error" });
        }

        logEvent(req.user.id, req.user.email, `USER_STATUS_${status.toUpperCase()}`, req.ip, 'Warning');
        res.json({ success: true, newStatus: status });
    });
}
app.get('/api/logs', authenticateToken, requireRole('owner'), (req, res) => {
    db.all("SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 50", (err, rows) => {
        if (err) {
            return res.status(500).json({ message: "Database error" });
        }
        res.json(rows);
    });
});

// Helper to get Workspace-specific DB
function getWorkspaceDB(workspaceId, callback) {
    db.get("SELECT name FROM workspaces WHERE id = ?", [workspaceId], (err, row) => {
        if (err || !row) return callback(new Error("Workspace not found"));

        const wsFolderPath = path.resolve(__dirname, `../Data Base/Workspaces/${row.name}`);
        const wsDBPath = path.join(wsFolderPath, 'workspace.db');

        const wsDB = new sqlite3.Database(wsDBPath, (err) => {
            if (err) return callback(err);
            callback(null, wsDB);
        });
    });
}

// Get list of workspaces (Role-based filtering)
app.get('/api/workspaces', authenticateToken, (req, res) => {
    const { id: userId, role } = req.user;
    const isCEO = role === 'owner' || role === 'ceo';

    let sql = `
        SELECT w.id, w.name, w.display_name, u.name as managed_by, w.users,
        (SELECT COUNT(*) FROM targets WHERE workspace_id = w.id) as target_count
        FROM workspaces w 
        LEFT JOIN users u ON w.admin_id = u.id 
    `;

    const params = [];

    // CEOs/Owners see everything. Others see only their assigned workspaces.
    if (!isCEO) {
        sql += `
            WHERE w.admin_id = ? 
            OR EXISTS (
                SELECT 1 FROM json_each(w.users) WHERE value = ?
            )
        `;
        params.push(userId, userId);
    }

    sql += ` ORDER BY w.created_at DESC`;

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Workspace list error:', err);
            return res.status(500).json({ message: "Database error listing workspaces" });
        }
        res.json(rows);
    });
});

// Create workspace/table (Owner/Admin)
app.post('/api/workspaces/create', authenticateToken, requireRole('owner', 'ceo', 'admin'), (req, res) => {
    const { displayName, columns, adminId, users, status } = req.body;

    if (!displayName || !columns || columns.length === 0) {
        return res.status(400).json({ message: "Invalid workspace data" });
    }

    const baseName = displayName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    const columnsStr = JSON.stringify(columns);

    // Record in registry
    const insertRegistrySQL = `INSERT INTO workspaces (name, display_name, admin_id, users, status, columns) VALUES (?, ?, ?, ?, ?, ?)`;

    db.run(insertRegistrySQL, [baseName, displayName, adminId, JSON.stringify(users || []), status || 'Active', columnsStr], function (err) {
        if (err) {
            console.error(err);
            if (err.message.includes('UNIQUE')) return res.status(409).json({ message: "Workspace name already exists" });
            return res.status(500).json({ message: "Failed to register workspace" });
        }

        const workspaceId = this.lastID;
        const tableName = `ws_${baseName}_${workspaceId}`;
        const wsFolder = path.resolve(__dirname, `../Data Base/Workspaces/${tableName}`);

        // 1. Create Folder
        if (!fs.existsSync(wsFolder)) {
            fs.mkdirSync(wsFolder, { recursive: true });
        }

        // 2. Initialize Workspace-Specific DB
        const wsDBPath = path.join(wsFolder, 'workspace.db');
        const wsDB = new sqlite3.Database(wsDBPath, (err) => {
            if (err) return res.status(500).json({ message: "Failed to create workspace file" });

            wsDB.serialize(() => {
                // Update registry with final unique table name
                db.run("UPDATE workspaces SET name = ? WHERE id = ?", [tableName, workspaceId]);

                // Create physical table in Workspace DB
                const columnDefs = columns.map(col => {
                    const safeName = col.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
                    return `${safeName} TEXT`;
                }).join(', ');

                wsDB.run(`CREATE TABLE IF NOT EXISTS data_table (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    target_id INTEGER,
                    ${columnDefs},
                    added_by INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                // Create Targets registry in Workspace DB
                wsDB.run(`CREATE TABLE IF NOT EXISTS targets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    target_name TEXT UNIQUE,
                    target_table TEXT,
                    status TEXT DEFAULT 'Active',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                // Create Members Table (Access Control)
                wsDB.run(`CREATE TABLE IF NOT EXISTS members (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    role TEXT,
                    name TEXT,
                    email TEXT,
                    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`, (err) => {
                    const finalizeCreation = () => {
                        wsDB.close();
                        if (err) return res.status(500).json({ message: "Failed to init workspace tables" });

                        logEvent(req.user.id, req.user.email, `WORKSPACE_CREATED_${tableName}`, req.ip, 'Info');
                        res.json({ success: true, workspaceId, tableName });
                    };

                    if (err) {
                        console.error("Failed to create members table:", err);
                        return finalizeCreation();
                    }

                    // Populate Members
                    if (users && users.length > 0) {
                        const placeholders = users.map(() => '?').join(',');

                        db.all(`SELECT id, name, email, role FROM users WHERE id IN (${placeholders})`, users, (err, rows) => {
                            if (err) {
                                console.error("Error fetching user details for workspace creation:", err);
                                finalizeCreation();
                            } else if (rows && rows.length > 0) {
                                const insertMember = wsDB.prepare("INSERT INTO members (user_id, role, name, email) VALUES (?, ?, ?, ?)");
                                rows.forEach(row => {
                                    insertMember.run(row.id, row.role, row.name, row.email);
                                });
                                insertMember.finalize(() => {
                                    finalizeCreation();
                                });
                            } else {
                                finalizeCreation();
                            }
                        });
                    } else {
                        finalizeCreation();
                    }
                });
            });
        });
    });
});

// Update Workspace (Name & Members)
app.post('/api/workspaces/update', authenticateToken, requireRole('owner', 'ceo', 'admin'), (req, res) => {
    console.log('--- API Update Workspace Hit ---');
    const { workspaceId, displayName, users, adminId } = req.body;

    if (!workspaceId || !displayName) {
        return res.status(400).json({ message: "Workspace ID and Name required" });
    }

    const updateSQL = `UPDATE workspaces SET display_name = ?, users = ?, admin_id = ? WHERE id = ?`;
    const usersJson = JSON.stringify(users || []);

    db.run(updateSQL, [displayName, usersJson, adminId, workspaceId], function (err) {
        if (err) {
            console.error('Workspace update error:', err);
            return res.status(500).json({ message: "Database error updating workspace" });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        // Step 1: Fetch user details from MAIN DB first (before touching workspace DB)
        const fetchAndSyncMembers = (userDetails) => {
            getWorkspaceDB(workspaceId, (err, wsDB) => {
                if (err) {
                    console.error('Failed to get workspace DB:', err);
                    return res.json({ success: true, message: "Workspace updated, but member sync failed." });
                }

                wsDB.serialize(() => {
                    // Ensure table exists
                    wsDB.run(`CREATE TABLE IF NOT EXISTS members (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER,
                        role TEXT,
                        name TEXT,
                        email TEXT,
                        added_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`);

                    // Delete ALL existing members first (serialized — guaranteed to run before inserts)
                    wsDB.run("DELETE FROM members");

                    // Insert new members (runs after DELETE due to serialize)
                    if (userDetails && userDetails.length > 0) {
                        const insertMember = wsDB.prepare("INSERT INTO members (user_id, role, name, email) VALUES (?, ?, ?, ?)");
                        userDetails.forEach(row => {
                            insertMember.run(row.id, row.role, row.name, row.email);
                        });
                        insertMember.finalize();
                    }

                    // Finalize after all operations
                    wsDB.run("SELECT 1", () => {
                        wsDB.close();
                        logEvent(req.user.id, req.user.email, `WORKSPACE_UPDATED_${workspaceId}`, req.ip, 'Info');
                        console.log(`[Workspace Update] Synced ${userDetails ? userDetails.length : 0} members for workspace ${workspaceId}`);
                        res.json({ success: true, message: "Workspace and members updated" });
                    });
                });
            });
        };

        // Fetch user details (or sync empty list)
        if (users && users.length > 0) {
            const placeholders = users.map(() => '?').join(',');
            db.all(`SELECT id, name, email, role FROM users WHERE id IN (${placeholders})`, users, (err, rows) => {
                if (err) {
                    console.error("Error fetching users for update:", err);
                    return fetchAndSyncMembers([]); // Sync empty on error
                }
                fetchAndSyncMembers(rows || []);
            });
        } else {
            fetchAndSyncMembers([]);
        }
    });
});


// ── REPAIR: Re-sync all workspace member tables from the central registry ──
app.post('/api/workspaces/repair-members', authenticateToken, requireRole('owner', 'ceo'), (req, res) => {
    db.all("SELECT id, name, users FROM workspaces", [], async (err, workspaces) => {
        if (err) return res.status(500).json({ message: "Failed to list workspaces" });

        const results = [];

        for (const ws of workspaces) {
            let userIds = [];
            try { userIds = ws.users ? JSON.parse(ws.users) : []; } catch (e) { }

            await new Promise((resolve) => {
                if (userIds.length === 0) {
                    // Open and clear
                    getWorkspaceDB(ws.id, (err, wsDB) => {
                        if (err) { results.push({ id: ws.id, error: err.message }); return resolve(); }
                        wsDB.serialize(() => {
                            wsDB.run("CREATE TABLE IF NOT EXISTS members (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, role TEXT, name TEXT, email TEXT, added_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
                            wsDB.run("DELETE FROM members");
                            wsDB.run("SELECT 1", () => { wsDB.close(); results.push({ id: ws.id, name: ws.name, synced: 0 }); resolve(); });
                        });
                    });
                    return;
                }

                const placeholders = userIds.map(() => '?').join(',');
                db.all(`SELECT id, name, email, role FROM users WHERE id IN (${placeholders})`, userIds, (err2, rows) => {
                    if (err2) { results.push({ id: ws.id, error: err2.message }); return resolve(); }

                    getWorkspaceDB(ws.id, (err3, wsDB) => {
                        if (err3) { results.push({ id: ws.id, error: err3.message }); return resolve(); }

                        wsDB.serialize(() => {
                            wsDB.run("CREATE TABLE IF NOT EXISTS members (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, role TEXT, name TEXT, email TEXT, added_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
                            wsDB.run("DELETE FROM members");
                            if (rows && rows.length > 0) {
                                const stmt = wsDB.prepare("INSERT INTO members (user_id, role, name, email) VALUES (?, ?, ?, ?)");
                                rows.forEach(r => stmt.run(r.id, r.role, r.name, r.email));
                                stmt.finalize();
                            }
                            wsDB.run("SELECT 1", () => {
                                wsDB.close();
                                results.push({ id: ws.id, name: ws.name, synced: rows ? rows.length : 0 });
                                resolve();
                            });
                        });
                    });
                });
            });
        }

        console.log('[Repair] Member sync results:', results);
        res.json({ success: true, results });
    });
});

// Delete workspace (Owner only)
app.post('/api/workspaces/delete', authenticateToken, requireRole('owner', 'ceo', 'admin'), (req, res) => {
    const { tableName } = req.body;

    if (!tableName) {
        return res.status(400).json({ message: "Workspace name required" });
    }

    // Protection against deleting system files/folders
    const systemTables = ['users', 'sqlite_sequence', 'activity_logs', 'workspaces'];
    if (systemTables.includes(tableName)) {
        return res.status(403).json({ message: "Cannot delete system resources" });
    }

    // 1. Remove from registry first
    db.run(`DELETE FROM workspaces WHERE name = ?`, [tableName], function (err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Failed to remove from registry" });
        }

        if (this.changes === 0) {
            return res.status(404).json({ message: "Workspace not found in registry" });
        }

        // 2. Recursively delete the physical workspace folder
        // The folder is named after the tableName: ws_basename_id
        const wsFolder = path.resolve(__dirname, `../Data Base/Workspaces/${tableName}`);

        try {
            if (fs.existsSync(wsFolder)) {
                fs.rmSync(wsFolder, { recursive: true, force: true });
                console.log(`🗑️ Workspace folder deleted: ${wsFolder}`);
            } else {
                console.warn(`⚠️ Workspace folder not found for deletion: ${wsFolder}`);
            }

            logEvent(req.user.id, req.user.email, `WORKSPACE_DELETED_${tableName}`, req.ip, 'Warning');
            res.json({ success: true, message: "Workspace and its data deleted successfully" });
        } catch (fsErr) {
            console.error('Error deleting workspace folder:', fsErr);
            // We already deleted from registry, so this is a partial failure
            res.status(500).json({
                success: false,
                message: "Removed from registry but failed to delete physical files",
                error: fsErr.message
            });
        }
    });
});

// Adding Target to Workspace (Centralized Registry + Isolated Storage)
app.post('/api/workspaces/:id/targets/create', authenticateToken, requireRole('owner', 'ceo', 'admin'), (req, res) => {
    const workspaceId = req.params.id;
    const { targetName, startDate, endDate } = req.body;

    if (!targetName) return res.status(400).json({ message: "Target name required" });
    if (!startDate || !endDate) return res.status(400).json({ message: "Start and end date required" });

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return res.status(400).json({ message: "End date must be after start date" });

    const numDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // 1. Get Workspace Name from Registry
    db.get("SELECT name FROM workspaces WHERE id = ?", [workspaceId], (err, wsRow) => {
        if (err || !wsRow) return res.status(404).json({ message: "Workspace not found" });

        const workspaceName = wsRow.name;
        const targetSlug = targetName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() + '_' + Date.now();
        const wsFolderPath = path.resolve(__dirname, `../Data Base/Workspaces/${workspaceName}`);
        const targetsdbPath = path.join(wsFolderPath, 'targetsdb');
        const targetFolderPath = path.join(targetsdbPath, targetSlug);
        const targetDBPath = path.join(targetFolderPath, 'target.db');

        // 2. Register Target in CENTRAL database
        const insertRegistrySQL = `INSERT INTO targets (workspace_id, target_name, target_db_path, status, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)`;
        db.run(insertRegistrySQL, [workspaceId, targetName, targetDBPath, 'Active', startDate, endDate], function (err) {
            if (err) {
                console.error('Central target registry error:', err);
                return res.status(500).json({ message: "Failed to register target in system" });
            }

            const targetId = this.lastID;

            // 3. Create Target-Specific Folder
            try {
                if (!fs.existsSync(targetFolderPath)) {
                    fs.mkdirSync(targetFolderPath, { recursive: true });
                }

                // 4. Create and Initialize Isolated Target Database with FIXED schema
                const targetDB = new sqlite3.Database(targetDBPath, (dbErr) => {
                    if (dbErr) {
                        console.error('Target DB creation error:', dbErr);
                        return res.status(500).json({ message: "Failed to create target storage" });
                    }

                    const targetTableName = `data_${targetId}`;
                    targetDB.serialize(() => {
                        // Fixed column schema matching the Google Sheets workflow
                        targetDB.run(`CREATE TABLE IF NOT EXISTS ${targetTableName} (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            date TEXT,
                            impressions REAL DEFAULT 0,
                            engagements REAL DEFAULT 0,
                            followers REAL DEFAULT 0,
                            profile_views REAL DEFAULT 0,
                            calls_booked REAL DEFAULT 0,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        )`, (tableErr) => {
                            if (tableErr) {
                                targetDB.close();
                                console.error('Table creation error:', tableErr);
                                return res.status(500).json({ message: "Failed to initialize target data" });
                            }

                            // 5. Auto-insert date rows for the period
                            const stmt = targetDB.prepare(`INSERT INTO ${targetTableName} (date) VALUES (?)`);
                            for (let i = 0; i < numDays; i++) {
                                const d = new Date(start);
                                d.setDate(d.getDate() + i);
                                const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
                                stmt.run(dateStr);
                            }
                            stmt.finalize(() => {
                                targetDB.close();
                                logEvent(req.user.id, req.user.email, `TARGET_CREATED_ID_${targetId}_WS_${workspaceId}`, req.ip, 'Info');
                                res.json({ success: true, targetId, storage: targetDBPath });
                            });
                        });
                    });
                });
            } catch (fsErr) {
                console.error('Target storage path error:', fsErr);
                res.status(500).json({ message: "Failed to create physical storage for target" });
            }
        });
    });
});

// Get Targets for Workspace (Fetch from Central Registry)
app.get('/api/workspaces/:id/targets', authenticateToken, (req, res) => {
    const workspaceId = req.params.id;

    const { id: userId, role } = req.user;
    const isCEO = ['owner', 'ceo', 'admin'].includes(role.toLowerCase());

    let sql = `SELECT id, target_name as name, target_db_path as storage, status, target_users FROM targets WHERE workspace_id = ?`;
    const params = [workspaceId];

    if (!isCEO) {
        sql += ` AND (EXISTS (SELECT 1 FROM json_each(target_users) WHERE value = ?))`;
        params.push(userId);
    }
    sql += ` ORDER BY created_at DESC`;

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Fetch targets error:', err);
            return res.status(500).json({ message: "Database error fetching targets" });
        }
        res.json(rows);
    });
});


// Get Members of a Workspace (for display in header)
app.get('/api/workspaces/:id/members', authenticateToken, (req, res) => {
    const workspaceId = req.params.id;

    getWorkspaceDB(workspaceId, (err, wsDB) => {
        if (err) return res.status(500).json({ message: "Failed to access workspace DB" });

        wsDB.all("SELECT user_id, name, role, email FROM members", (err, rows) => {
            wsDB.close();
            if (err) {
                // Table might not exist or error
                console.warn("Error fetching members:", err.message);
                return res.json([]);
            }
            res.json(rows);
        });
    });
});

// --- Target Data Management API ---

// API to get all potential members for a target (from its workspace)
app.get('/api/targets/:targetId/members', authenticateToken, (req, res) => {
    const { targetId } = req.params;

    // 1. Find Workspace ID for this target
    db.get("SELECT workspace_id, target_users FROM targets WHERE id = ?", [targetId], (err, target) => {
        if (err || !target) return res.status(404).json({ message: "Target not found" });

        const workspaceId = target.workspace_id;
        let assignedUserIds = [];
        try {
            assignedUserIds = target.target_users ? JSON.parse(target.target_users) : [];
        } catch (e) {
            console.error("Error parsing target_users:", e);
        }

        // 2. Get all members of that workspace
        getWorkspaceDB(workspaceId, (err, wsDB) => {
            if (err) return res.status(500).json({ message: "Failed to access workspace members" });

            wsDB.all("SELECT user_id as id, name, role, email FROM members", (err, wsMembers) => {
                wsDB.close();
                if (err) return res.status(500).json({ message: "Error fetching workspace members" });

                console.log(`[DEBUG] Target ${targetId} (WS ${workspaceId}) found ${wsMembers.length} members in isolated DB.`);

                // 3. Fetch avatars from central DB for these users
                const userIds = wsMembers.map(m => m.id);
                if (userIds.length === 0) return res.json([]);

                const placeholders = userIds.map(() => '?').join(',');
                db.all(`SELECT id, avatar FROM users WHERE id IN (${placeholders})`, userIds, (err, users) => {
                    if (err) {
                        console.error("Error fetching avatars:", err);
                        return res.json(wsMembers.map(m => ({ ...m, isAssigned: assignedUserIds.includes(m.id) })));
                    }

                    const avatarMap = {};
                    users.forEach(u => avatarMap[u.id] = u.avatar);

                    // Mark who is assigned to this target and attach avatar
                    const members = wsMembers.map(m => ({
                        ...m,
                        // Use loose equality (==) to handle string/number type differences
                        isAssigned: assignedUserIds.some(uid => uid == m.id),
                        avatar: avatarMap[m.id] || null
                    }));

                    res.json(members);
                });
            });
        });
    });
});

// API to update target-specific access
app.post('/api/targets/:targetId/members', authenticateToken, requireRole('owner', 'ceo', 'admin'), (req, res) => {
    const { targetId } = req.params;
    const { userIds } = req.body; // Expect array of integers

    if (!Array.isArray(userIds)) {
        return res.status(400).json({ message: "userIds must be an array" });
    }

    const usersStr = JSON.stringify(userIds);
    db.run("UPDATE targets SET target_users = ? WHERE id = ?", [usersStr, targetId], function (err) {
        if (err) {
            console.error("Error updating target_users:", err);
            return res.status(500).json({ message: "Database error updating target access" });
        }
        logEvent(req.user.id, req.user.email, `TARGET_ACCESS_UPDATED_ID_${targetId}`, req.ip, 'Info');
        res.json({ success: true, message: "Target access updated" });
    });
});

// 1. Get Target Data & Schema
app.get('/api/targets/:targetId/data', authenticateToken, (req, res) => {
    const { targetId } = req.params;
    const { workspaceId } = req.query;

    if (!workspaceId) return res.status(400).json({ message: "Workspace ID required" });

    // 1. Fetch Metadata from Main DB
    db.get("SELECT target_name, target_db_path, goals, period_type, start_date, end_date FROM targets WHERE id = ?", [targetId], (err, target) => {
        if (err) {
            console.error(`❌ [GET /api/targets/${targetId}/data] Registry DB Error:`, err);
            return res.status(500).json({ message: "Database error fetching registry" });
        }
        if (!target) {
            console.warn(`⚠️ [GET /api/targets/${targetId}/data] Target not found in registry.`);
            return res.status(404).json({ message: "Target not found" });
        }

        // 2. Fetch Workspace Name
        db.get("SELECT name FROM workspaces WHERE id = ?", [workspaceId], (err, workspace) => {
            const workspaceName = workspace ? workspace.name : "Unknown Workspace";

            // 3. Open Isolated Data DB using the stored path from registry
            const targetDBPath = target.target_db_path;
            console.log(`🔍 [GET /api/targets/${targetId}/data] Attempting to open storage: ${targetDBPath}`);
            if (!fs.existsSync(targetDBPath)) {
                console.error(`❌ [GET /api/targets/${targetId}/data] Storage file MISSING at: ${targetDBPath}`);
                return res.status(404).json({ message: "Target storage file not found" });
            }

            const targetDB = new sqlite3.Database(targetDBPath, sqlite3.OPEN_READONLY, (dbErr) => {
                if (dbErr) {
                    console.error(`❌ [GET /api/targets/${targetId}/data] Failed to open sqlite connection:`, dbErr);
                    return res.status(500).json({ message: "Failed to access target storage" });
                }

                const tableName = `data_${targetId}`;

                // 4. Get Schema
                targetDB.all(`PRAGMA table_info(${tableName})`, (schemaErr, columns) => {
                    if (schemaErr) {
                        targetDB.close();
                        return res.status(500).json({ message: "Failed to read schema" });
                    }

                    // 5. Get Rows
                    targetDB.all(`SELECT * FROM ${tableName} ORDER BY date ASC, id ASC`, (rowsErr, rows) => {
                        targetDB.close();
                        if (rowsErr) return res.status(500).json({ message: "Failed to read data" });

                        res.json({
                            targetName: target.target_name,
                            workspaceName: workspaceName,
                            goals: target.goals || null,
                            periodType: target.period_type || null,
                            startDate: target.start_date || null,
                            endDate: target.end_date || null,
                            columns: columns.map(c => ({ name: c.name, type: c.type })),
                            rows: rows
                        });
                    });
                });
            });
        });
    });
});

// 2. Add Row
app.post('/api/targets/:targetId/rows', authenticateToken, (req, res) => {
    const { targetId } = req.params;
    const { workspaceId } = req.query;
    const rowData = req.body;

    if (!workspaceId) return res.status(400).json({ message: "Workspace ID required" });

    // Look up the real DB path from the registry
    db.get("SELECT target_db_path FROM targets WHERE id = ?", [targetId], (err, target) => {
        if (err || !target) return res.status(404).json({ message: "Target not found" });

        const targetDBPath = target.target_db_path;
        if (!fs.existsSync(targetDBPath)) return res.status(404).json({ message: "Target storage not found" });

        const targetDB = new sqlite3.Database(targetDBPath, (dbErr) => {
            if (dbErr) return res.status(500).json({ message: "Database error" });

            const tableName = `data_${targetId}`;
            const keys = Object.keys(rowData).filter(k => k !== 'id' && k !== 'created_at');
            if (keys.length === 0) {
                targetDB.close();
                return res.status(400).json({ message: "No data provided" });
            }

            const placeholders = keys.map(() => '?').join(',');
            const values = keys.map(k => rowData[k]);
            const sql = `INSERT INTO ${tableName} (${keys.join(',')}) VALUES (${placeholders})`;

            targetDB.run(sql, values, function (insertErr) {
                targetDB.close();
                if (insertErr) {
                    console.error("Insert error:", insertErr);
                    return res.status(500).json({ message: "Failed to insert row" });
                }
                res.json({ success: true, rowId: this.lastID });
            });
        });
    });
});

// 3. Delete Row
app.delete('/api/targets/:targetId/rows/:rowId', authenticateToken, (req, res) => {
    const { targetId, rowId } = req.params;
    const { workspaceId } = req.query;

    if (!workspaceId) return res.status(400).json({ message: "Workspace ID required" });

    db.get("SELECT target_db_path FROM targets WHERE id = ?", [targetId], (err, target) => {
        if (err || !target) return res.status(404).json({ message: "Target not found" });

        const targetDB = new sqlite3.Database(target.target_db_path, (dbErr) => {
            if (dbErr) return res.status(500).json({ message: "Database error" });

            targetDB.run(`DELETE FROM data_${targetId} WHERE id = ?`, [rowId], function (runErr) {
                targetDB.close();
                if (runErr) return res.status(500).json({ message: "Delete failed" });
                res.json({ success: true });
            });
        });
    });
});

// 4. Add Column
app.post('/api/targets/:targetId/columns', authenticateToken, (req, res) => {
    const { targetId } = req.params;
    const { workspaceId } = req.query;
    const { name, type } = req.body;

    if (!workspaceId || !name) return res.status(400).json({ message: "Missing required fields" });

    const allowedTypes = ['TEXT', 'REAL', 'INTEGER', 'DATE'];
    const safeType = allowedTypes.includes(type) ? type : 'TEXT';
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

    db.get("SELECT target_db_path FROM targets WHERE id = ?", [targetId], (err, target) => {
        if (err || !target) return res.status(404).json({ message: "Target not found" });

        const targetDB = new sqlite3.Database(target.target_db_path, (dbErr) => {
            if (dbErr) return res.status(500).json({ message: "Database error" });

            const sql = `ALTER TABLE data_${targetId} ADD COLUMN ${safeName} ${safeType}`;

            targetDB.run(sql, (alterErr) => {
                targetDB.close();
                if (alterErr) {
                    if (alterErr.message.includes('duplicate column')) {
                        return res.status(400).json({ message: "Column already exists" });
                    }
                    console.error("Alter table error:", alterErr);
                    return res.status(500).json({ message: "Failed to add column" });
                }
                res.json({ success: true });
            });
        });
    });
});

// 4b. Delete a Column (recreate table without that column)
app.delete('/api/targets/:targetId/columns/:colName', authenticateToken, requireRole('owner', 'ceo', 'admin'), (req, res) => {
    const { targetId, colName } = req.params;
    const PROTECTED = ['id', 'date', 'created_at'];
    if (PROTECTED.includes(colName)) return res.status(400).json({ message: "Cannot delete protected column" });

    db.get("SELECT target_db_path FROM targets WHERE id = ?", [targetId], (err, target) => {
        if (err || !target) return res.status(404).json({ message: "Target not found" });

        const targetDB = new sqlite3.Database(target.target_db_path, (dbErr) => {
            if (dbErr) return res.status(500).json({ message: "DB error" });

            const tbl = `data_${targetId}`;
            targetDB.all(`PRAGMA table_info(${tbl})`, (pragmaErr, cols) => {
                if (pragmaErr) { targetDB.close(); return res.status(500).json({ message: "Cannot read schema" }); }

                const remaining = cols.filter(c => c.name !== colName);
                const colDefs = remaining.map(c => `${c.name} ${c.type}${c.dflt_value !== null ? ' DEFAULT ' + c.dflt_value : ''}`).join(', ');
                const colNames = remaining.map(c => c.name).join(', ');

                targetDB.serialize(() => {
                    targetDB.run(`CREATE TABLE ${tbl}_backup (${colDefs})`);
                    targetDB.run(`INSERT INTO ${tbl}_backup (${colNames}) SELECT ${colNames} FROM ${tbl}`);
                    targetDB.run(`DROP TABLE ${tbl}`);
                    targetDB.run(`ALTER TABLE ${tbl}_backup RENAME TO ${tbl}`, (renErr) => {
                        targetDB.close();
                        if (renErr) return res.status(500).json({ message: "Failed to delete column" });
                        res.json({ success: true });
                    });
                });
            });
        });
    });
});

// 4c. Rename a Column (recreate table with new name)
app.patch('/api/targets/:targetId/columns/:colName', authenticateToken, requireRole('owner', 'ceo', 'admin'), (req, res) => {
    const { targetId, colName } = req.params;
    const { newName } = req.body;
    const PROTECTED = ['id', 'date', 'created_at'];
    if (PROTECTED.includes(colName)) return res.status(400).json({ message: "Cannot rename protected column" });
    if (!newName) return res.status(400).json({ message: "New name required" });

    const safeNew = newName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

    db.get("SELECT target_db_path FROM targets WHERE id = ?", [targetId], (err, target) => {
        if (err || !target) return res.status(404).json({ message: "Target not found" });

        const targetDB = new sqlite3.Database(target.target_db_path, (dbErr) => {
            if (dbErr) return res.status(500).json({ message: "DB error" });

            const tbl = `data_${targetId}`;
            targetDB.all(`PRAGMA table_info(${tbl})`, (pragmaErr, cols) => {
                if (pragmaErr) { targetDB.close(); return res.status(500).json({ message: "Cannot read schema" }); }

                const colDefs = cols.map(c => `${c.name === colName ? safeNew : c.name} ${c.type}${c.dflt_value !== null ? ' DEFAULT ' + c.dflt_value : ''}`).join(', ');
                const oldNames = cols.map(c => c.name).join(', ');
                const newNames = cols.map(c => c.name === colName ? safeNew : c.name).join(', ');

                targetDB.serialize(() => {
                    targetDB.run(`CREATE TABLE ${tbl}_backup (${colDefs})`);
                    targetDB.run(`INSERT INTO ${tbl}_backup (${newNames}) SELECT ${oldNames} FROM ${tbl}`);
                    targetDB.run(`DROP TABLE ${tbl}`);
                    targetDB.run(`ALTER TABLE ${tbl}_backup RENAME TO ${tbl}`, (renErr) => {
                        targetDB.close();
                        if (renErr) return res.status(500).json({ message: "Failed to rename column" });
                        res.json({ success: true, newName: safeNew });
                    });
                });
            });
        });
    });
});

// 4d. Update a single cell in a row (inline editing)
app.patch('/api/targets/:targetId/rows/:rowId', authenticateToken, (req, res) => {
    const { targetId, rowId } = req.params;
    const { field, value } = req.body;

    // Whitelist allowed fields to prevent SQL injection
    const allowedFields = ['impressions', 'engagements', 'followers', 'profile_views', 'calls_booked', 'date'];
    if (!field || !allowedFields.includes(field)) {
        return res.status(400).json({ message: "Invalid field name" });
    }

    db.get("SELECT target_db_path FROM targets WHERE id = ?", [targetId], (err, target) => {
        if (err || !target) return res.status(404).json({ message: "Target not found" });

        const targetDB = new sqlite3.Database(target.target_db_path, (dbErr) => {
            if (dbErr) return res.status(500).json({ message: "Database error" });

            targetDB.run(
                `UPDATE data_${targetId} SET ${field} = ? WHERE id = ?`,
                [value, rowId],
                function (runErr) {
                    targetDB.close();
                    if (runErr) return res.status(500).json({ message: "Update failed" });
                    res.json({ success: true });
                }
            );
        });
    });
});

// --- 9. AUTOMATIC BACKUP (Daily at Midnight) ---

cron.schedule('0 0 * * *', async () => {
    const backupDir = path.resolve(__dirname, '../Backups');

    try {
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().split('T')[0];
        const backupFile = `backup-${timestamp}.db`;
        const backupPath = path.join(backupDir, backupFile);

        // Async file copy
        await fs.promises.copyFile(dbPath, backupPath);

        console.log(`💾 Daily Backup Completed: ${backupFile}`);
        logEvent(0, 'SYSTEM', 'BACKUP_SUCCESS', 'CRON', 'Info');

        // Delete backups older than 30 days
        const files = await fs.promises.readdir(backupDir);
        const now = Date.now();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;

        for (const file of files) {
            const filePath = path.join(backupDir, file);
            const stats = await fs.promises.stat(filePath);

            if (now - stats.mtimeMs > thirtyDays) {
                await fs.promises.unlink(filePath);
                console.log(`🗑️ Deleted old backup: ${file}`);
            }
        }

    } catch (err) {
        console.error('❌ Backup failed:', err);
        logEvent(0, 'SYSTEM', 'BACKUP_FAILED', 'CRON', 'Critical');
    }
});

// 5. Update Goals (Admin/Owner only)
app.post('/api/targets/:targetId/goals', authenticateToken, requireRole('owner', 'ceo', 'admin'), (req, res) => {
    const { targetId } = req.params;
    const { goals } = req.body;

    const goalsStr = typeof goals === 'object' ? JSON.stringify(goals) : goals;

    db.run("UPDATE targets SET goals = ? WHERE id = ?", [goalsStr, targetId], function (err) {
        if (err) return res.status(500).json({ message: "Database error updating goals" });

        logEvent(req.user.id, req.user.email, `TARGET_GOALS_UPDATED_ID_${targetId}`, req.ip, 'Info');
        res.json({ success: true });
    });
});

// 6. Get Target Logs (History)
app.get('/api/targets/:targetId/logs', authenticateToken, requireRole('owner', 'ceo', 'admin', 'team'), (req, res) => {
    const { targetId } = req.params;
    const pattern = `%TARGET_%_ID_${targetId}%`;

    db.all("SELECT * FROM activity_logs WHERE action LIKE ? ORDER BY timestamp DESC LIMIT 50", [pattern], (err, rows) => {
        if (err) return res.status(500).json({ message: "Database error fetching logs" });
        res.json(rows);
    });
});

// --- 10. START SERVER ---

// Listen on all interfaces (0.0.0.0)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server active on http://localhost:${PORT}`);
    console.log(`✅ SUCCESS: System connected to Database at: ${dbPath}`);
});