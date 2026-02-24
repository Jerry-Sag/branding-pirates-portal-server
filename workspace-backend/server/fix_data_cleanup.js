const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../Data Base/database.db');
const db = new sqlite3.Database(dbPath);

console.log("🛠️  Fixing email data (removing accidental quotes)...");

db.all("SELECT id, email FROM users", (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }

    rows.forEach(row => {
        let fixedEmail = row.email.replace(/'/g, "").replace(/"/g, "").trim();
        if (fixedEmail !== row.email) {
            console.log(`✅ Fixing: "${row.email}" -> "${fixedEmail}"`);
            db.run("UPDATE users SET email = ? WHERE id = ?", [fixedEmail, row.id]);
        }
    });

    console.log("✅ Done.");
    // No db.close() inside loop, wait a bit
    setTimeout(() => db.close(), 1000);
});
