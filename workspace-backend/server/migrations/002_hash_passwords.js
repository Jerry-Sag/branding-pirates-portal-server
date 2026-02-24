const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../Data Base/database.db');
const db = new sqlite3.Database(dbPath);
const SALT_ROUNDS = 10;

console.log('🔐 Starting password migration (plaintext → bcrypt)...\n');

async function migratePasswords() {
    return new Promise((resolve, reject) => {
        db.all("SELECT id, email, password FROM users", async (err, users) => {
            if (err) {
                console.error('❌ Error fetching users:', err);
                reject(err);
                return;
            }

            console.log(`Found ${users.length} users to migrate\n`);

            let migrated = 0;
            let skipped = 0;

            for (const user of users) {
                try {
                    // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
                    if (user.password.startsWith('$2a$') ||
                        user.password.startsWith('$2b$') ||
                        user.password.startsWith('$2y$')) {
                        console.log(`⏭️  Skipping ${user.email} - already hashed`);
                        skipped++;
                        continue;
                    }

                    // Hash the plaintext password
                    const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);

                    // Update in database
                    await new Promise((resolveUpdate, rejectUpdate) => {
                        db.run(
                            "UPDATE users SET password = ? WHERE id = ?",
                            [hashedPassword, user.id],
                            (err) => {
                                if (err) rejectUpdate(err);
                                else resolveUpdate();
                            }
                        );
                    });

                    console.log(`✅ Migrated password for: ${user.email}`);
                    migrated++;

                } catch (error) {
                    console.error(`❌ Error migrating ${user.email}:`, error.message);
                }
            }

            console.log(`\n📊 Migration Summary:`);
            console.log(`   - Migrated: ${migrated}`);
            console.log(`   - Skipped (already hashed): ${skipped}`);
            console.log(`   - Total: ${users.length}`);

            resolve();
        });
    });
}

migratePasswords()
    .then(() => {
        db.close();
        console.log('\n✅ Password migration completed successfully!');
    })
    .catch((err) => {
        db.close();
        console.error('\n❌ Migration failed:', err);
        process.exit(1);
    });
