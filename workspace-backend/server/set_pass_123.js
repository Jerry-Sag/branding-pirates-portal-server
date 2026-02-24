const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../Data Base/database.db');
const db = new sqlite3.Database(dbPath);
const EMAIL = 'uzairabbas2025@gmail.com';
const NEW_PASS = '123';

async function updatePassword() {
    console.log(`🔨 Updating password for ${EMAIL} to "123"...`);
    const hash = await bcrypt.hash(NEW_PASS, 10);

    db.run("UPDATE users SET password = ? WHERE email = ?", [hash, EMAIL], function (err) {
        if (err) {
            console.error("❌ DB Update Failed:", err);
        } else {
            console.log(`✅ SUCCESS: Password updated to "123"`);
        }
        db.close();
    });
}

updatePassword();
