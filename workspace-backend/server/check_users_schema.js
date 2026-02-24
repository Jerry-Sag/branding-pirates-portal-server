const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../Data Base/database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) {
            console.error(err);
        } else {
            console.log("Users Table Info:");
            console.table(rows);
        }
        db.close();
    });
});
