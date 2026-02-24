const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Path Resolution
const dbDir = path.resolve(__dirname, '..', 'Data Base');
const dbPath = path.join(dbDir, 'database.db');
const SALT_ROUNDS = 10;
const EMAIL = 'uzairabbas2025@gmail.com';
const NEW_PASSWORD = 'password123';

console.log(`🔍 Checking DB at: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
    console.error(`❌ DB file does not exist at path: ${dbPath}`);
    process.exit(1);
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Could not connect to database:', err);
    } else {
        console.log('✅ Connected to database');
    }
});

async function resetPassword() {
    try {
        const hashedPassword = await bcrypt.hash(NEW_PASSWORD, SALT_ROUNDS);

        db.run(
            "UPDATE users SET password = ?, status = 'Active', failed_attempts = 0 WHERE email = ?",
            [hashedPassword, EMAIL],
            function (err) {
                if (err) {
                    console.error('❌ Database error:', err);
                } else if (this.changes > 0) {
                    console.log(`✅ SUCCESS: Password reset for ${EMAIL}`);
                    console.log(`✅ Password: ${NEW_PASSWORD}`);
                    console.log(`✅ Status: Active`);
                } else {
                    console.error(`❌ No user found for ${EMAIL}`);
                }
                db.close();
            }
        );
    } catch (error) {
        console.error('Error:', error);
        db.close();
    }
}

resetPassword();
