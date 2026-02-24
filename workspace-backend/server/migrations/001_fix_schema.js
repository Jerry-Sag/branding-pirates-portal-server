const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../Data Base/database.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Starting database schema migration...\n');

db.serialize(() => {
    // Check if status column exists
    db.get("PRAGMA table_info(users)", (err, info) => {
        if (err) {
            console.error('Error checking table info:', err);
            return;
        }
    });

    // Create activity_logs table if it doesn't exist
    db.run(`
        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            email TEXT,
            action TEXT NOT NULL,
            ip_address TEXT,
            status TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('❌ Error creating activity_logs table:', err);
        } else {
            console.log('✅ activity_logs table created/verified');
        }
    });

    // Add status column to users table if it doesn't exist
    db.run(`
        ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'Active'
    `, (err) => {
        if (err) {
            // Column might already exist, which is fine
            if (err.message.includes('duplicate column name')) {
                console.log('✅ status column already exists');
            } else {
                console.error('Error adding status column:', err.message);
            }
        } else {
            console.log('✅ Added status column to users table');
        }
    });

    // Add created_at column to users table
    db.run(`
        ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    `, (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('✅ created_at column already exists');
            } else {
                console.error('Error adding created_at column:', err.message);
            }
        } else {
            console.log('✅ Added created_at column to users table');
        }
    });

    // Create indexes for performance
    db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)', (err) => {
        if (err) console.error('Error creating email index:', err);
        else console.log('✅ Created index on users.email');
    });

    db.run('CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)', (err) => {
        if (err) console.error('Error creating status index:', err);
        else console.log('✅ Created index on users.status');
    });

    db.run('CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON activity_logs(timestamp)', (err) => {
        if (err) console.error('Error creating timestamp index:', err);
        else console.log('✅ Created index on activity_logs.timestamp');
    });

    db.run('CREATE INDEX IF NOT EXISTS idx_logs_user_id ON activity_logs(user_id)', (err) => {
        if (err) console.error('Error creating user_id index:', err);
        else console.log('✅ Created index on activity_logs.user_id');
    });

    // Update existing users to have Active status if NULL
    db.run(`UPDATE users SET status = 'Active' WHERE status IS NULL`, function (err) {
        if (err) {
            console.error('Error updating user statuses:', err);
        } else if (this.changes > 0) {
            console.log(`✅ Updated ${this.changes} users to Active status`);
        }
    });
});

// Close database after all operations
setTimeout(() => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('\n✅ Database migration completed successfully!');
        }
    });
}, 2000);
