import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://teamflow_user:teamflow_password@localhost:5435/teamflow_db?schema=test_migration_schema'
    }
  }
});

async function run() {
  console.log('Starting Migration Data-Preservation verification...');

  try {
    // 1. Create schema
    await testPrisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS test_migration_schema');
    console.log('Created temporary test_migration_schema.');

    // 2. Read and apply predecessor migrations (0 to 9)
    const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
    const allDirs = fs.readdirSync(migrationsDir)
      .filter(f => fs.statSync(path.join(migrationsDir, f)).isDirectory())
      .sort();

    const predecessorDirs = allDirs.filter(d => !d.includes('rename_preferences_to_user_preferences'));

    console.log(`Applying ${predecessorDirs.length} predecessor migrations...`);
    for (const dirName of predecessorDirs) {
      const sqlPath = path.join(migrationsDir, dirName, 'migration.sql');
      if (fs.existsSync(sqlPath)) {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        for (const statement of statements) {
          if (statement.startsWith('--') && !statement.includes('\n')) continue;
          await testPrisma.$executeRawUnsafe(statement);
        }
      }
    }
    console.log('Predecessor migrations applied successfully.');

    // 3. Insert mock data
    console.log('Inserting mock User & UserNotificationPreference row...');
    await testPrisma.$executeRawUnsafe(`
      INSERT INTO "User" (id, email, "passwordHash", name, "systemRole", "updatedAt")
      VALUES (999, 'mig_test@example.com', 'hash', 'Mig Test', 'MEMBER', NOW())
    `);

    const insertedTime = new Date();
    await testPrisma.$executeRawUnsafe(`
      INSERT INTO "UserNotificationPreference" (id, "userId", "emailOptOut", "updatedAt")
      VALUES (555, 999, true, $1)
    `, insertedTime);

    // Record pre-migration state
    console.log('Recorded pre-migration values:');
    console.log(` - id: 555`);
    console.log(` - userId: 999`);
    console.log(` - emailOptOut: true`);
    console.log(` - updatedAt: ${insertedTime.toISOString()}`);

    // 4. Apply Stage 14D migration
    console.log('Applying Stage 14D RENAME migration...');
    const renameDir = allDirs.find(d => d.includes('rename_preferences_to_user_preferences'));
    const renameSql = fs.readFileSync(path.join(migrationsDir, renameDir, 'migration.sql'), 'utf8');
    const renameStatements = renameSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of renameStatements) {
      if (statement.startsWith('--') && !statement.includes('\n')) continue;
      await testPrisma.$executeRawUnsafe(statement);
    }
    console.log('Stage 14D rename migration applied.');

    // 5. Query and Assert
    console.log('Querying UserPreference and asserting preservation...');
    const rows = await testPrisma.$queryRawUnsafe('SELECT * FROM "UserPreference" WHERE id = 555');
    if (rows.length !== 1) {
      throw new Error(`Expected 1 row in UserPreference, found ${rows.length}`);
    }

    const row = rows[0];
    console.log('Migrated row found:', JSON.stringify(row));

    const assertEqual = (actual, expected, name) => {
      if (actual !== expected) {
        throw new Error(`Assertion failed for ${name}: Expected ${expected}, got ${actual}`);
      }
    };

    assertEqual(row.id, 555, 'id');
    assertEqual(row.userId, 999, 'userId');
    assertEqual(row.emailOptOut, true, 'emailOptOut');

    const actualTime = new Date(row.updatedAt).getTime();
    const expectedTime = insertedTime.getTime();
    if (Math.abs(actualTime - expectedTime) > 1000) {
      throw new Error(`updatedAt timestamp drift too large: Expected ${insertedTime.toISOString()}, got ${new Date(row.updatedAt).toISOString()}`);
    }
    console.log('✔ id, userId, emailOptOut, and updatedAt preserved exactly.');

    assertEqual(row.theme, 'LIGHT', 'theme');
    console.log('✔ theme is default LIGHT.');

    if (!row.createdAt) {
      throw new Error('createdAt column was not populated.');
    }
    console.log(`✔ createdAt is populated with: ${new Date(row.createdAt).toISOString()}`);

    console.log('\nMIGRATION PRESERVATION TEST: PASSED\n');

  } catch (error) {
    console.error('\nMIGRATION PRESERVATION TEST: FAILED');
    console.error(error);
    process.exitCode = 1;
  } finally {
    // Cleanup
    try {
      console.log('Cleaning up temporary schema...');
      await testPrisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS test_migration_schema CASCADE');
    } catch (e) {
      console.error('Failed to cleanup schema:', e);
    }
    await testPrisma.$disconnect();
  }
}

run().catch(console.error);
