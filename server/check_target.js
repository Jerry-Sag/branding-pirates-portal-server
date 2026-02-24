const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../Data Base/database.db');
const db = new sqlite3.Database(dbPath);

db.get("SELECT * FROM targets WHERE id = 33", (err, row) => {
    if (row) {
        const info = {
            id: row.id,
            target_db_path: row.target_db_path,
            exists: fs.existsSync(row.target_db_path),
            current_dir: path.resolve(__dirname, '..')
        };
        fs.writeFileSync('target_debug.log', JSON.stringify(info, null, 2));
        console.log('Results written to target_debug.log');
    }
    db.close();
});
