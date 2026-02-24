const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '../Data Base/database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Migrating Workspaces table...');

    // Add missing columns if they don't exist
    db.run("ALTER TABLE workspaces ADD COLUMN admin_id INTEGER", (err) => {
        if (err) console.log('admin_id column might already exist or error:', err.message);
        else console.log('Added admin_id');
    });

    db.run("ALTER TABLE workspaces ADD COLUMN users TEXT", (err) => {
        if (err) console.log('users column might already exist or error:', err.message);
        else console.log('Added users');
    });

    db.run("ALTER TABLE workspaces ADD COLUMN status TEXT DEFAULT 'Active'", (err) => {
        if (err) console.log('status column might already exist or error:', err.message);
        else console.log('Added status');
    });

    console.log('Migration complete.');
});
db.close();
