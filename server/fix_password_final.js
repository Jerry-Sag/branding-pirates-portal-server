const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../Data Base/database.db');
const db = new sqlite3.Database(dbPath);
const EMAIL = 'uzairabbas2025@gmail.com';
const RAW_PASS = 'password123';

async function fix() {
    console.log("🔨 Generating Hash...");
    const hash = await bcrypt.hash(RAW_PASS, 10);
    console.log(`📝 Generated Hash: ${hash}`);

    db.run("UPDATE users SET password = ? WHERE email = ?", [hash, EMAIL], function (err) {
        if (err) console.error("❌ DB Write Failed:", err);
        else console.log(`✅ DB Updated! Rows affected: ${this.changes}`);

        // VERIFY IMMEDIATE READ
        db.get("SELECT password FROM users WHERE email = ?", [EMAIL], (err, row) => {
            console.log(`🧐 READ BACK Hash: ${row.password}`);
            if (row.password === hash) console.log("🎉 MATCH CONFIRMED!");
            else console.log("❌ MISMATCH - DB IS BROKEN");
        });
    });
}

fix();
