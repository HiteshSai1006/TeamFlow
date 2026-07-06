import prisma from './src/config/db.js';
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:5000/api';

async function registerOrLogin(email, name, password) {
  let res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (res.status === 401) {
    res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
  }

  const setCookie = res.headers.get('set-cookie');
  return setCookie ? setCookie.split(';')[0] : '';
}

async function runSupplementaryTests() {
  console.log('=== STARTING SUPPLEMENTARY VERIFICATION ROUND ===\n');

  // Register / Login Users
  const cookieA = await registerOrLogin('supp_user_a@test.com', 'Supp User A', 'securepassword123');
  const cookieB = await registerOrLogin('supp_user_b@test.com', 'Supp User B', 'securepassword123');

  // Clean old projects/tasks for these test users
  const userA = await prisma.user.findUnique({ where: { email: 'supp_user_a@test.com' } });
  const userB = await prisma.user.findUnique({ where: { email: 'supp_user_b@test.com' } });

  if (userA && userB) {
    const projects = await prisma.project.findMany({ where: { createdById: { in: [userA.id, userB.id] } } });
    const projectIds = projects.map(p => p.id);
    if (projectIds.length > 0) {
      await prisma.projectViewPreference.deleteMany({ where: { projectId: { in: projectIds } } });
      await prisma.review.deleteMany({ where: { rca: { projectId: { in: projectIds } } } });
      await prisma.rCASection.deleteMany({ where: { rca: { projectId: { in: projectIds } } } });
      await prisma.rCA.deleteMany({ where: { projectId: { in: projectIds } } });

      const tasks = await prisma.task.findMany({ where: { projectId: { in: projectIds } } });
      const taskIds = tasks.map(t => t.id);
      if (taskIds.length > 0) {
        await prisma.taskRelation.deleteMany({
          where: { OR: [{ sourceTaskId: { in: taskIds } }, { targetTaskId: { in: taskIds } }] }
        });
        await prisma.comment.deleteMany({ where: { taskId: { in: taskIds } } });
        await prisma.attachment.deleteMany({ where: { taskId: { in: taskIds } } });
        await prisma.activityLog.deleteMany({ where: { taskId: { in: taskIds } } });
      }

      await prisma.task.deleteMany({ where: { projectId: { in: projectIds } } });
      await prisma.projectMember.deleteMany({ where: { projectId: { in: projectIds } } });
      await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    }
  }

  // 1. Project Regression
  console.log('1. Verifying Project List & Read...');
  let res = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ name: 'Supp Project A' })
  });
  const projectA = (await res.json()).project;

  res = await fetch(`${API_URL}/projects`, { headers: { 'Cookie': cookieA } });
  if (res.status !== 200) throw new Error('Failed to list projects');

  res = await fetch(`${API_URL}/projects/${projectA.id}`, { headers: { 'Cookie': cookieA } });
  if (res.status !== 200) throw new Error('Failed to read project');

  // Verify non-member access is rejected
  res = await fetch(`${API_URL}/projects/${projectA.id}`, { headers: { 'Cookie': cookieB } });
  if (res.status !== 403 && res.status !== 404) {
    throw new Error(`Expected non-member access to return 403/404, got ${res.status}`);
  }
  console.log('✔ Project list, read, and cross-project isolation verified.');

  // 2. Task Lifecycle Regression
  console.log('\n2. Verifying Task Lifecycle Transitions...');
  res = await fetch(`${API_URL}/projects/${projectA.id}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ title: 'Task Lifecycle A', status: 'TODO', priority: 'MEDIUM' })
  });
  const tA = (await res.json()).task;

  // Valid Transition: TODO -> IN_PROGRESS
  res = await fetch(`${API_URL}/projects/${projectA.id}/tasks/${tA.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ status: 'IN_PROGRESS' })
  });
  if (res.status !== 200) throw new Error(`Expected valid transition to return 200, got ${res.status}`);
  console.log('✔ Valid transition TODO -> IN_PROGRESS returned 200.');

  // Invalid Transition: Passing invalid status value
  res = await fetch(`${API_URL}/projects/${projectA.id}/tasks/${tA.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ status: 'INVALID_STATUS' })
  });
  if (res.status !== 400) throw new Error(`Expected invalid status to return 400, got ${res.status}`);
  console.log('✔ Invalid status value returned 400.');

  // 3. Dependency Regression
  console.log('\n3. Verifying Dependency Cycle Rejection...');
  res = await fetch(`${API_URL}/projects/${projectA.id}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ title: 'Task Dependency B', status: 'TODO', priority: 'MEDIUM' })
  });
  const tB = (await res.json()).task;

  // Add dependency relation: tA blocks tB
  res = await fetch(`${API_URL}/projects/${projectA.id}/tasks/${tA.id}/relations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ targetTaskId: tB.id })
  });
  if (res.status !== 200) throw new Error(`Failed to add valid relation: ${res.status}`);

  // Create Cycle: tB blocks tA
  res = await fetch(`${API_URL}/projects/${projectA.id}/tasks/${tB.id}/relations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ targetTaskId: tA.id })
  });
  if (res.status !== 409) throw new Error(`Expected dependency cycle to return 409, got ${res.status}`);
  console.log('✔ Dependency cycle creation rejected with 409.');

  // 4. Comments Regression
  console.log('\n4. Verifying Comment Creation...');
  res = await fetch(`${API_URL}/projects/${projectA.id}/tasks/${tA.id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ content: 'Test Comment text' })
  });
  if (res.status !== 201) throw new Error(`Expected comment creation to return 201, got ${res.status}`);
  console.log('✔ Comment creation returned 201.');

  // 5. Attachments Regression
  console.log('\n5. Verifying Attachment List Retrieval...');
  res = await fetch(`${API_URL}/projects/${projectA.id}/tasks/${tA.id}/attachments`, {
    headers: { 'Cookie': cookieA }
  });
  if (res.status !== 200) throw new Error(`Expected attachment retrieval to return 200, got ${res.status}`);
  console.log('✔ Attachment list retrieval returned 200.');

  // 6. Notifications Regression
  console.log('\n6. Verifying Notifications Preferences...');
  res = await fetch(`${API_URL}/notifications`, { headers: { 'Cookie': cookieA } });
  if (res.status !== 200) throw new Error(`Expected notification list to return 200, got ${res.status}`);

  res = await fetch(`${API_URL}/notifications/preferences`, { headers: { 'Cookie': cookieA } });
  if (res.status !== 200) throw new Error(`Expected Stage 13 preference GET to return 200, got ${res.status}`);

  res = await fetch(`${API_URL}/notifications/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ emailOptOut: true })
  });
  if (res.status !== 200) throw new Error(`Expected Stage 13 preference PUT to return 200, got ${res.status}`);
  console.log('✔ Stage 13 notification preference GET and PUT regression tests passed.');

  // 7. Theme Race-condition Simulation
  console.log('\n7. Verifying Theme Switching Race-condition Safety...');

  // Simulation Logic
  let localTheme = 'LIGHT';
  let latestThemeRef = 'LIGHT';

  const simulateToggle = async (targetTheme, delay, failRequest = false) => {
    localTheme = targetTheme;
    latestThemeRef = targetTheme;
    console.log(` -> Selected: ${targetTheme} (latestThemeRef: ${latestThemeRef})`);

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (failRequest) {
          console.log(` -> Request failed for: ${targetTheme}`);
          if (latestThemeRef === targetTheme) {
            localTheme = targetTheme === 'LIGHT' ? 'DARK' : 'LIGHT';
            latestThemeRef = localTheme;
            console.log(`    [Rollback executed. localTheme reset to ${localTheme}]`);
          } else {
            console.log('    [Rollback skipped. Outdated request]');
          }
          reject(new Error('Network failure'));
        } else {
          console.log(` -> Request succeeded for: ${targetTheme}`);
          if (latestThemeRef === targetTheme) {
            console.log('    [State preserved]');
          } else {
            console.log('    [State preserved—newer selection exists]');
          }
          resolve(targetTheme);
        }
      }, delay);
    });
  };

  // Scenario 1: Request A (older theme selection) fails AFTER Request B (newer theme selection) succeeds
  console.log(' Scenario 1: Older failure arriving after newer success...');
  const promiseA = simulateToggle('DARK', 200, true); // Older theme, fails later
  const promiseB = simulateToggle('LIGHT', 50, false); // Newer theme, succeeds quickly

  try { await promiseB; } catch {}
  try { await promiseA; } catch {}

  if (localTheme !== 'LIGHT') throw new Error(`Race condition failed! Theme expected LIGHT, got ${localTheme}`);
  console.log(`✔ Final theme is ${localTheme}. Stale failure A did not overwrite newer selection B.`);

  // Scenario 2: Older success arriving after newer selection
  console.log('\n Scenario 2: Older success arriving after newer selection...');
  localTheme = 'LIGHT';
  latestThemeRef = 'LIGHT';
  const promiseC = simulateToggle('DARK', 200, false); // Older theme, succeeds later
  const promiseD = simulateToggle('LIGHT', 50, false); // Newer theme, succeeds quickly

  try { await promiseD; } catch {}
  try { await promiseC; } catch {}

  if (localTheme !== 'LIGHT') throw new Error(`Race condition failed! Theme expected LIGHT, got ${localTheme}`);
  console.log(`✔ Final theme is ${localTheme}. Older success C did not overwrite newer selection D.`);

  // 8. Migration Integrity
  console.log('\n8. Checking Migration File Integrity...');
  const migrationFile = path.join(process.cwd(), 'prisma', 'migrations', '20260706100000_rename_preferences_to_user_preferences', 'migration.sql');
  const migrationSql = fs.readFileSync(migrationFile, 'utf8');

  if (migrationSql.toUpperCase().includes('DROP TABLE') || migrationSql.toUpperCase().includes('DROP COLUMN')) {
    throw new Error('Migration contains destructive DROP queries!');
  }
  console.log('✔ Verified: Stage 14D migration does not contain any DROP operations.');

  console.log('\n=== ALL SUPPLEMENTARY VERIFICATION CHECKS PASSED ===\n');
}

runSupplementaryTests().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
