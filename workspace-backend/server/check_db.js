const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '../Data Base/database.db');
const db = new sqlite3.Database(dbPath);

db.all("PRAGMA table_info(users)", (err, cols) => {
    if (err) return console.error(err);
    console.log('USERS COLS:', cols);

    db.all("SELECT * FROM users LIMIT 1", (err, rows) => {
        if (err) return console.error(err);
        console.log('SAMPLE USER:', rows);

        db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
            console.log('ALL TABLES:', tables);
            db.close();
        });
    });
});
