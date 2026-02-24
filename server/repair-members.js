/**
 * One-time repair script: Re-syncs all workspace member tables from the central registry.
 * Run with: node repair-members.js
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const mainDBPath = path.resolve(__dirname, '../Data Base/database.db');
const db = new sqlite3.Database(mainDBPath, (err) => {
    if (err) { console.error('Cannot open main DB:', err.message); process.exit(1); }
});

function getWorkspaceDB(wsName, callback) {
    const wsDBPath = path.resolve(__dirname, `../Data Base/Workspaces/${wsName}/workspace.db`);
    const wsDB = new sqlite3.Database(wsDBPath, (err) => {
        if (err) return callback(err);
        callback(null, wsDB);
    });
}

async function repairAll() {
    const workspaces = await new Promise((resolve, reject) => {
        db.all("SELECT id, name, display_name, users FROM workspaces", [], (err, rows) => {
            if (err) reject(err); else resolve(rows);
        });
    });

    console.log(`Found ${workspaces.length} workspaces to repair.`);

    for (const ws of workspaces) {
        let userIds = [];
        try { userIds = ws.users ? JSON.parse(ws.users) : []; } catch (e) { }

        console.log(`\nWorkspace: ${ws.display_name || ws.name} (ID: ${ws.id}) — ${userIds.length} users in registry: [${userIds}]`);

        // Get user details from main DB
        let userDetails = [];
        if (userIds.length > 0) {
            const placeholders = userIds.map(() => '?').join(',');
            userDetails = await new Promise((resolve, reject) => {
                db.all(`SELECT id, name, email, role FROM users WHERE id IN (${placeholders})`, userIds, (err, rows) => {
                    if (err) reject(err); else resolve(rows || []);
                });
            });
        }

        // Sync the workspace DB
        await new Promise((resolve) => {
            getWorkspaceDB(ws.name, (err, wsDB) => {
                if (err) {
                    console.log(`  ⚠️  Cannot open workspace DB: ${err.message}`);
                    return resolve();
                }

                wsDB.serialize(() => {
                    wsDB.run(`CREATE TABLE IF NOT EXISTS members (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER,
                        role TEXT,
                        name TEXT,
                        email TEXT,
                        added_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`);

                    wsDB.run("DELETE FROM members");

                    if (userDetails.length > 0) {
                        const stmt = wsDB.prepare("INSERT INTO members (user_id, role, name, email) VALUES (?, ?, ?, ?)");
                        userDetails.forEach(u => {
                            stmt.run(u.id, u.role, u.name, u.email);
                            console.log(`  ✔ Added member: ${u.name} (${u.role})`);
                        });
                        stmt.finalize();
                    } else {
                        console.log('  ℹ No members to sync');
                    }

                    wsDB.run("SELECT 1", () => {
                        wsDB.close();
                        console.log(`  ✅ Synced ${userDetails.length} members`);
                        resolve();
                    });
                });
            });
        });
    }

    db.close();
    console.log('\n✅ ALL WORKSPACES REPAIRED. Restart the server to apply changes.');
}

repairAll().catch(e => { console.error(e); process.exit(1); });
