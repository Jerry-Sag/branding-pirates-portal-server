const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../Data Base/database.db');
const db = new sqlite3.Database(dbPath);

db.get("SELECT email FROM users WHERE id = 2", (err, row) => {
    if (row) {
        console.log(`DEBUG: Email length is ${row.email.length}`);
        console.log(`DEBUG: Email JSON: ${JSON.stringify(row.email)}`);
    } else {
        console.log("DEBUG: No user with ID 2 found.");
    }
    db.close();
});
