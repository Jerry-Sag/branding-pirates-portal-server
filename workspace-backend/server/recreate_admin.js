const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Path Resolution
const dbDir = path.resolve(__dirname, '..', 'Data Base');
const dbPath = path.join(dbDir, 'database.db');
const EMAIL = 'uzairabbas2025@gmail.com';
const PASSWORD = 'password123';

console.log(`🧹 Full User Reset for ${EMAIL}...`);

const db = new sqlite3.Database(dbPath);

async function performReset() {
    // 1. Delete Existing User
    db.run("DELETE FROM users WHERE email = ?", [EMAIL], (err) => {
        if (err) console.error("❌ Delete failed:", err);
        else console.log("✅ Deleted existing user (if any)");

        // 2. Hash New Password
        bcrypt.hash(PASSWORD, 10, (err, hash) => {
            if (err) throw err;

            // 3. Create Fresh User
            db.run(
                `INSERT INTO users (name, email, password, role, status, failed_attempts) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                ['CEO', EMAIL, hash, 'owner', 'Active', 0],
                function (err) {
                    if (err) {
                        console.error("❌ CRTICAL ERROR:", err);
                    } else {
                        console.log(`✅ User Re-Created Successfully!`);
                        console.log(`   ID: ${this.lastID}`);
                        console.log(`   Email: ${EMAIL}`);
                        console.log(`   Password: ${PASSWORD}`);
                        console.log(`   Role: Owner`);
                    }
                    db.close();
                }
            );
        });
    });
}

performReset();
