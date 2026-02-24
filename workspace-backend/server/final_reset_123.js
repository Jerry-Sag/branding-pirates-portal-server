const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../Data Base/database.db');
const db = new sqlite3.Database(dbPath);
const EMAIL = 'uzairabbas2025@gmail.com';
const PASS = '123';

async function finalReset() {
    const hash = await bcrypt.hash(PASS, 10);
    console.log(`Setting ${EMAIL} password to "123" (Hash: ${hash})`);

    db.run("UPDATE users SET password = ?, status = 'Active', failed_attempts = 0 WHERE email = ?", [hash, EMAIL], function (err) {
        if (err) console.error(err);
        else console.log("✅ Reset finished.");
        db.close();
    });
}

finalReset();
