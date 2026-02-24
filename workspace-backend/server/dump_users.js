const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../Data Base/database.db');
const db = new sqlite3.Database(dbPath);

console.log("📊 Dumping 'users' table contents...");

db.all("SELECT id, email, role, status, failed_attempts FROM users", (err, rows) => {
    if (err) {
        console.error("❌ Error reading users:", err);
    } else {
        console.table(rows);
        if (rows.length === 0) console.log("⚠️  USERS TABLE IS EMPTY!");
    }
    db.close();
});
