const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '../Data Base/database.db');
const db = new sqlite3.Database(dbPath);

const workspaces = [
    { name: 'it_inventory', display_name: 'IT Inventory', columns: JSON.stringify(['Asset ID', 'Status', 'Owner']) },
    { name: 'client_leads', display_name: 'Client Leads 2024', columns: JSON.stringify(['Name', 'Email', 'Source']) }
];

db.serialize(() => {
    workspaces.forEach(ws => {
        db.run("INSERT OR IGNORE INTO workspaces (name, display_name, columns) VALUES (?, ?, ?)",
            [ws.name, ws.display_name, ws.columns]);
    });

    db.all("SELECT * FROM workspaces", (err, rows) => {
        console.log('CURRENT WORKSPACES:', rows);
        db.close();
    });
});
