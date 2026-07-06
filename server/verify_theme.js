import prisma from './src/config/db.js';
import { runEmailWorker } from './src/services/email.worker.js';

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

async function getMe(cookie) {
  const res = await fetch(`${API_URL}/auth/me`, { headers: { 'Cookie': cookie } });
  const data = await res.json();
  return data.user;
}

async function runThemeTests() {
  console.log('=== STARTING STAGE 14D THEME VERIFICATION SUITE ===\n');

  // Clean DB for test users
  const testEmails = [
    'theme_user_a@test.com',
    'theme_user_b@test.com'
  ];

  const users = await prisma.user.findMany({ where: { email: { in: testEmails } } });
  const userIds = users.map(u => u.id);

  if (userIds.length > 0) {
    const projects = await prisma.project.findMany({ where: { createdById: { in: userIds } } });
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

    await prisma.projectViewPreference.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.notification.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.userPreference.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.eventOutbox.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.projectMember.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  // Register / Login Users
  const cookieA = await registerOrLogin('theme_user_a@test.com', 'Theme User A', 'securepassword123');
  const cookieB = await registerOrLogin('theme_user_b@test.com', 'Theme User B', 'securepassword123');

  const userA = await getMe(cookieA);
  const userB = await getMe(cookieB);

  console.log('✔ Test users authenticated successfully.');

  // Test 1: Unauthenticated GET /api/users/me/preferences returns 401
  let res = await fetch(`${API_URL}/users/me/preferences`);
  if (res.status !== 401) throw new Error(`Expected 401 for unauthenticated GET, got ${res.status}`);
  console.log('✔ Unauthenticated GET returns 401.');

  // Test 2: Unauthenticated PATCH /api/users/me/preferences returns 401
  res = await fetch(`${API_URL}/users/me/preferences`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme: 'DARK' })
  });
  if (res.status !== 401) throw new Error(`Expected 401 for unauthenticated PATCH, got ${res.status}`);
  console.log('✔ Unauthenticated PATCH returns 401.');

  // Test 3: Authenticated GET for User A returns default LIGHT
  res = await fetch(`${API_URL}/users/me/preferences`, { headers: { 'Cookie': cookieA } });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  let data = await res.json();
  if (data.preference.theme !== 'LIGHT') throw new Error(`Expected default theme LIGHT, got ${data.preference.theme}`);
  console.log('✔ Authenticated default theme is LIGHT.');

  // Test 4: Authenticated PATCH for User A updates to DARK
  res = await fetch(`${API_URL}/users/me/preferences`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ theme: 'DARK' })
  });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  data = await res.json();
  if (data.preference.theme !== 'DARK') throw new Error(`Expected updated theme DARK, got ${data.preference.theme}`);
  console.log('✔ Authenticated update to DARK successful.');

  // Test 5: Invalid theme value returns 400
  res = await fetch(`${API_URL}/users/me/preferences`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ theme: 'SYSTEM' })
  });
  if (res.status !== 400) throw new Error(`Expected 400 for invalid theme, got ${res.status}`);
  console.log('✔ Invalid theme returns 400.');

  // Test 6: Per-user isolation (User B remains LIGHT)
  res = await fetch(`${API_URL}/users/me/preferences`, { headers: { 'Cookie': cookieB } });
  data = await res.json();
  if (data.preference.theme !== 'LIGHT') throw new Error(`Expected User B theme to be LIGHT, got ${data.preference.theme}`);
  console.log('✔ User A and User B preferences are isolated.');

  // Test 7: Theme update preserves emailOptOut
  // First update emailOptOut for User A to true using Stage 13 endpoint
  res = await fetch(`${API_URL}/notifications/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ emailOptOut: true })
  });
  if (res.status !== 200) throw new Error(`Notification preferences update failed: ${res.status}`);

  // Patch theme back to LIGHT
  res = await fetch(`${API_URL}/users/me/preferences`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ theme: 'LIGHT' })
  });
  data = await res.json();
  if (data.preference.theme !== 'LIGHT' || data.preference.emailOptOut !== true) {
    throw new Error(`Theme update failed to preserve emailOptOut: ${JSON.stringify(data.preference)}`);
  }
  console.log('✔ Updating theme preserves emailOptOut.');

  // Test 8: Notification preference update preserves theme
  res = await fetch(`${API_URL}/notifications/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ emailOptOut: false })
  });
  data = await res.json();
  if (data.preference.emailOptOut !== false || data.preference.theme !== 'LIGHT') {
    throw new Error(`Notification preference update failed to preserve theme: ${JSON.stringify(data.preference)}`);
  }
  console.log('✔ Updating notification preferences preserves theme.');

  // Test 9: Existing Stage 13 notification preference GET API contract remains identical
  res = await fetch(`${API_URL}/notifications/preferences`, { headers: { 'Cookie': cookieA } });
  data = await res.json();
  if (!data.preference || typeof data.preference.emailOptOut !== 'boolean') {
    throw new Error(`Stage 13 preference contract changed: ${JSON.stringify(data)}`);
  }
  console.log('✔ Existing Stage 13 notification preferences GET API contract preserves format.');

  // Test 10: Opted-out email still reaches SKIPPED_OPT_OUT
  // 1. Opt out User A
  await fetch(`${API_URL}/notifications/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ emailOptOut: true })
  });

  // 2. Create EventOutbox manually to satisfy schema constraints
  const outbox = await prisma.eventOutbox.create({
    data: {
      eventType: 'TASK_ASSIGNED',
      entityId: 1,
      metadata: { taskId: 1, assigneeId: userA.id },
      processingState: 'PROCESSED',
      actorId: userB.id
    }
  });

  // 3. Create Notification directly
  const notification = await prisma.notification.create({
    data: {
      recipientId: userA.id,
      eventId: outbox.id,
      dedupKey: `event:${outbox.id}:recipient:${userA.id}`,
      title: 'Task Assigned',
      message: 'You have been assigned a task.',
      emailState: 'PENDING'
    }
  });
  console.log(`✔ Manually inserted pending notification ID: ${notification.id}`);

  // 4. Run email worker to process it
  await runEmailWorker();

  // 5. Verify emailState is SKIPPED_OPT_OUT
  const finalNotification = await prisma.notification.findUnique({
    where: { id: notification.id }
  });
  if (finalNotification.emailState !== 'SKIPPED_OPT_OUT') {
    throw new Error(`Expected emailState SKIPPED_OPT_OUT, got ${finalNotification.emailState}`);
  }
  console.log('✔ Notification opted out correctly (SKIPPED_OPT_OUT).');

  // Test 11: General Regressions (Projects, Tasks, Stage 14C view preferences, RCA, Reports, CSV, Health)
  // Create Project
  res = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ name: 'Theme Project A' })
  });
  const project = (await res.json()).project;

  // Add User B as member with REVIEWER role so that RCA submit works
  await prisma.projectMember.create({
    data: { projectId: project.id, userId: userB.id, role: 'REVIEWER' }
  });

  // A. Create Task
  res = await fetch(`${API_URL}/projects/${project.id}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ title: 'Task A', status: 'TODO', priority: 'HIGH' })
  });
  const tA = (await res.json()).task;
  if (res.status !== 201) throw new Error(`Task creation failed: ${res.status}`);
  console.log('✔ Task creation regression passed.');

  // B. Stage 14C Project View Preferences
  res = await fetch(`${API_URL}/projects/${project.id}/view-preference`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ viewMode: 'CALENDAR' })
  });
  if (res.status !== 200) throw new Error(`Stage 14C preference failed: ${res.status}`);
  console.log('✔ Stage 14C view preference update regression passed.');

  // C. RCA
  const rca = await prisma.rCA.create({
    data: { projectId: project.id, title: 'RCA Theme Test', severity: 'MEDIUM', status: 'DRAFT', createdById: userA.id }
  });
  await prisma.rCASection.create({ data: { rcaId: rca.id, type: 'TIMELINE', content: 'Timeline' } });
  await prisma.rCASection.create({ data: { rcaId: rca.id, type: 'CONTRIBUTING_FACTORS', content: 'Factors' } });
  await prisma.rCASection.create({ data: { rcaId: rca.id, type: 'CORRECTIVE_ACTIONS', content: 'Actions' } });
  await prisma.rCASection.create({ data: { rcaId: rca.id, type: 'PREVENTIVE_MEASURES', content: 'Measures' } });

  res = await fetch(`${API_URL}/projects/${project.id}/rcas/${rca.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ reviewerIds: [userB.id] })
  });
  if (res.status !== 200) throw new Error(`RCA submit failed: ${res.status}`);
  console.log('✔ RCA submit regression passed.');

  // D. Reports
  res = await fetch(`${API_URL}/projects/${project.id}/reports/summary`, { headers: { 'Cookie': cookieA } });
  if (res.status !== 200) throw new Error(`Reports summary failed: ${res.status}`);
  console.log('✔ Reports summary check regression passed.');

  // E. CSV Export
  res = await fetch(`${API_URL}/projects/${project.id}/tasks/export`, { headers: { 'Cookie': cookieA } });
  if (res.status !== 200) throw new Error(`CSV export failed: ${res.status}`);
  console.log('✔ CSV export check regression passed.');

  // F. Health
  res = await fetch(`${API_URL}/health`);
  if (res.status !== 200) throw new Error(`Health check failed: ${res.status}`);
  console.log('✔ Health check regression passed.');

  console.log('\n=== ALL STAGE 14D THEME VERIFICATION SUITE TESTS PASSED SUCCESSFULLY ===');
}

runThemeTests().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
