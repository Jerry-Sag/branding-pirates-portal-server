const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../Data Base/database.db');
const db = new sqlite3.Database(dbPath);

console.log('=== TOGGLE DEBUG SCRIPT ===\n');

db.serialize(() => {
    // 1. Show all users and their current status
    console.log('1. CURRENT USER STATUS IN DATABASE:');
    db.all("SELECT id, name, email, role, status FROM users ORDER BY id", (err, users) => {
        if (err) {
            console.error('Error fetching users:', err);
            return;
        }

        console.table(users);

        // 2. Pick a test user (team/client)
        const testUser = users.find(u => ['team', 'client'].includes(u.role));

        if (!testUser) {
            console.log('\nNo team/client user found for testing.');
            db.close();
            return;
        }

        console.log(`\n2. TESTING WITH USER: ${testUser.name} (ID: ${testUser.id})`);
        console.log(`   Current Status: ${testUser.status}`);

        // 3. Toggle the status
        const newStatus = testUser.status === 'Active' ? 'Blocked' : 'Active';
        console.log(`   Changing to: ${newStatus}`);

        db.run("UPDATE users SET status = ? WHERE id = ?", [newStatus, testUser.id], function (err) {
            if (err) {
                console.error('\n❌ UPDATE FAILED:', err);
                db.close();
                return;
            }

            console.log(`\n3. UPDATE EXECUTED (rows affected: ${this.changes})`);

            // 4. Verify the update
            db.get("SELECT id, name, status FROM users WHERE id = ?", [testUser.id], (err, updated) => {
                if (err) {
                    console.error('Error verifying:', err);
                    db.close();
                    return;
                }

                console.log('\n4. VERIFICATION AFTER UPDATE:');
                console.log(`   User: ${updated.name}`);
                console.log(`   Status in DB: ${updated.status}`);
                console.log(`   Expected: ${newStatus}`);
                console.log(`   Match: ${updated.status === newStatus ? '✅ YES' : '❌ NO'}`);

                // 5. Test the GET query used by the API
                console.log('\n5. TESTING API GET QUERY:');
                const sql = "SELECT id, name, email, role, status, failed_attempts FROM users WHERE role IN ('team', 'client')";

                db.all(sql, [], (err, apiResults) => {
                    if (err) {
                        console.error('API query error:', err);
                        db.close();
                        return;
                    }

                    const apiUser = apiResults.find(u => u.id === testUser.id);
                    console.log(`   Status returned by API query: ${apiUser ? apiUser.status : 'NOT FOUND'}`);

                    console.log('\n6. ALL API RESULTS:');
                    console.table(apiResults);

                    // Revert
                    db.run("UPDATE users SET status = ? WHERE id = ?", [testUser.status, testUser.id], () => {
                        console.log(`\n✅ Reverted ${testUser.name} back to ${testUser.status}`);
                        db.close();
                    });
                });
            });
        });
    });
});
