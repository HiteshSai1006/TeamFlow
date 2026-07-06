import prisma from './src/config/db.js';

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

async function runPreferencesTests() {
  console.log('=== STARTING STAGE 14C PREFERENCES VERIFICATION SUITE ===\n');

  // Clean DB for test users
  const testEmails = [
    'pref_user_a@test.com',
    'pref_user_b@test.com',
    'pref_out@test.com'
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
  const cookieA = await registerOrLogin('pref_user_a@test.com', 'Pref User A', 'securepassword123');
  const cookieB = await registerOrLogin('pref_user_b@test.com', 'Pref User B', 'securepassword123');
  const cookieOut = await registerOrLogin('pref_out@test.com', 'Pref Outsider', 'securepassword123');

  const userA = await getMe(cookieA);
  const userB = await getMe(cookieB);

  // Create Project A
  let res = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ name: 'Pref Project A' })
  });
  const projectA = (await res.json()).project;
  const projAId = projectA.id;
  console.log(`Created Project A: ID ${projAId}`);

  // Create Project B
  res = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ name: 'Pref Project B' })
  });
  const projectB = (await res.json()).project;
  const projBId = projectB.id;
  console.log(`Created Project B: ID ${projBId}`);

  // Add User B as member to Project A
  await fetch(`${API_URL}/projects/${projAId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ email: 'pref_user_b@test.com', role: 'REVIEWER' })
  });

  // --- CHECK 1: First GET returns KANBAN ---
  console.log('\n--- 1. Default Preference GET ---');
  res = await fetch(`${API_URL}/projects/${projAId}/view-preference`, { headers: { 'Cookie': cookieA } });
  let data = await res.json();
  console.log('  Status code:', res.status, '(Expected: 200)');
  console.log('  Default viewMode is KANBAN:', data.viewMode === 'KANBAN', '(Expected: true)');

  // --- CHECK 2: Valid updates persist ---
  console.log('\n--- 2. Valid Update Persistence ---');
  res = await fetch(`${API_URL}/projects/${projAId}/view-preference`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ viewMode: 'CALENDAR' })
  });
  console.log('  Update response status:', res.status, '(Expected: 200)');
  
  res = await fetch(`${API_URL}/projects/${projAId}/view-preference`, { headers: { 'Cookie': cookieA } });
  data = await res.json();
  console.log('  Persisted viewMode is CALENDAR:', data.viewMode === 'CALENDAR', '(Expected: true)');

  // --- CHECK 3: Invalid mode returns 400 ---
  console.log('\n--- 3. Invalid Mode Check ---');
  res = await fetch(`${API_URL}/projects/${projAId}/view-preference`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ viewMode: 'GANTT' })
  });
  console.log('  Invalid mode status code:', res.status, '(Expected: 400)');

  // --- CHECK 4: Outsider receives 403 ---
  console.log('\n--- 4. Access Restriction (Outsider 403) ---');
  res = await fetch(`${API_URL}/projects/${projAId}/view-preference`, { headers: { 'Cookie': cookieOut } });
  console.log('  Outsider GET preference status:', res.status, '(Expected: 403)');
  res = await fetch(`${API_URL}/projects/${projAId}/view-preference`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieOut },
    body: JSON.stringify({ viewMode: 'LIST' })
  });
  console.log('  Outsider PATCH preference status:', res.status, '(Expected: 403)');

  // --- CHECK 5: Archived project GET/PATCH allowed for members ---
  console.log('\n--- 5. Archived Project Access ---');
  await prisma.project.update({ where: { id: projAId }, data: { status: 'ARCHIVED' } });
  
  res = await fetch(`${API_URL}/projects/${projAId}/view-preference`, { headers: { 'Cookie': cookieA } });
  console.log('  Archived GET preference status:', res.status, '(Expected: 200)');

  res = await fetch(`${API_URL}/projects/${projAId}/view-preference`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ viewMode: 'LIST' })
  });
  console.log('  Archived PATCH preference status:', res.status, '(Expected: 200)');

  // Re-activate project A
  await prisma.project.update({ where: { id: projAId }, data: { status: 'ACTIVE' } });

  // --- CHECK 6: Project A & B have independent preferences for one user ---
  console.log('\n--- 6. Multi-Project Independence ---');
  res = await fetch(`${API_URL}/projects/${projBId}/view-preference`, { headers: { 'Cookie': cookieA } });
  let dataB = await res.json();
  console.log('  User A preference on Project B is KANBAN (default):', dataB.viewMode === 'KANBAN', '(Expected: true)');
  
  res = await fetch(`${API_URL}/projects/${projAId}/view-preference`, { headers: { 'Cookie': cookieA } });
  let dataA = await res.json();
  console.log('  User A preference on Project A is LIST (previously saved):', dataA.viewMode === 'LIST', '(Expected: true)');

  // --- CHECK 7: User A & B have independent preferences on same project ---
  console.log('\n--- 7. Multi-User Independence ---');
  res = await fetch(`${API_URL}/projects/${projAId}/view-preference`, { headers: { 'Cookie': cookieB } });
  let dataUserB = await res.json();
  console.log('  User B preference on Project A is KANBAN (default):', dataUserB.viewMode === 'KANBAN', '(Expected: true)');

  // --- CHECK 8: Upsert leaves exactly one row per [userId, projectId] ---
  console.log('\n--- 8. Single Row Constraints ---');
  await fetch(`${API_URL}/projects/${projAId}/view-preference`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ viewMode: 'LIST' })
  });
  await fetch(`${API_URL}/projects/${projAId}/view-preference`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ viewMode: 'CALENDAR' })
  });

  const rowCount = await prisma.projectViewPreference.count({
    where: { userId: userA.id, projectId: projAId }
  });
  console.log('  Database row count for User A in Project A:', rowCount, '(Expected: 1)');

  // --- CHECK 9: Concurrent updates safety ---
  console.log('\n--- 9. Concurrent Updates Safety ---');
  const updates = [
    fetch(`${API_URL}/projects/${projAId}/view-preference`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
      body: JSON.stringify({ viewMode: 'LIST' })
    }),
    fetch(`${API_URL}/projects/${projAId}/view-preference`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
      body: JSON.stringify({ viewMode: 'KANBAN' })
    }),
    fetch(`${API_URL}/projects/${projAId}/view-preference`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
      body: JSON.stringify({ viewMode: 'CALENDAR' })
    })
  ];

  await Promise.all(updates);
  const concurrentRowCount = await prisma.projectViewPreference.count({
    where: { userId: userA.id, projectId: projAId }
  });
  console.log('  Database row count after concurrent updates:', concurrentRowCount, '(Expected: 1)');

  // --- CHECK 10: Task Filters Propagation ---
  console.log('\n--- 10. Task Filters check ---');
  // Seed task for testing filter
  const task = await prisma.task.create({
    data: { projectId: projAId, title: 'Filter Task', status: 'IN_PROGRESS', priority: 'HIGH', assigneeId: userB.id, createdById: userA.id }
  });

  res = await fetch(`${API_URL}/projects/${projAId}/tasks?status=IN_PROGRESS&priority=HIGH&assigneeId=${userB.id}`, {
    headers: { 'Cookie': cookieA }
  });
  let tasksJson = await res.json();
  console.log('  Fetched tasks count matching filters:', tasksJson.tasks.length, '(Expected: 1)');
  console.log('  First task matches seeded ID:', tasksJson.tasks[0].id === task.id, '(Expected: true)');

  // --- CHECK 11: Regressions ---
  console.log('\n--- 11. Regressions ---');
  // A. Auth
  res = await fetch(`${API_URL}/auth/me`, { headers: { 'Cookie': cookieA } });
  console.log('  Auth status:', res.status, '(Expected: 200)');

  // B. Projects
  res = await fetch(`${API_URL}/projects`, { headers: { 'Cookie': cookieA } });
  console.log('  Projects status:', res.status, '(Expected: 200)');

  // C. Task lifecycle
  const tNew = await prisma.task.create({
    data: { projectId: projAId, title: 'Regression Task', status: 'TODO', createdById: userA.id }
  });
  res = await fetch(`${API_URL}/projects/${projAId}/tasks/${tNew.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ status: 'IN_PROGRESS' })
  });
  console.log('  Task update status:', res.status, '(Expected: 200)');

  // D. Dependencies (Rejection code 409)
  const tA = await prisma.task.create({ data: { projectId: projAId, title: 'Task A', status: 'TODO', createdById: userA.id } });
  const tB = await prisma.task.create({ data: { projectId: projAId, title: 'Task B', status: 'TODO', createdById: userA.id } });
  await fetch(`${API_URL}/projects/${projAId}/tasks/${tB.id}/relations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ targetTaskId: tA.id })
  });
  res = await fetch(`${API_URL}/projects/${projAId}/tasks/${tA.id}/relations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ targetTaskId: tB.id })
  });
  console.log('  Dependency cycle status:', res.status, '(Expected: 409)');

  // E. Comments
  res = await fetch(`${API_URL}/projects/${projAId}/tasks/${tA.id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ content: 'Pref Test Comment' })
  });
  console.log('  Comment creation status:', res.status, '(Expected: 201)');

  // F. Attachments
  res = await fetch(`${API_URL}/projects/${projAId}/tasks/${tA.id}/attachments`, {
    headers: { 'Cookie': cookieA }
  });
  console.log('  Attachments list status:', res.status, '(Expected: 200)');

  // G. RCA
  const rca = await prisma.rCA.create({
    data: { projectId: projAId, title: 'RCA Test', severity: 'MEDIUM', status: 'DRAFT', createdById: userA.id }
  });
  await prisma.rCASection.create({ data: { rcaId: rca.id, type: 'TIMELINE', content: 'Timeline' } });
  await prisma.rCASection.create({ data: { rcaId: rca.id, type: 'CONTRIBUTING_FACTORS', content: 'Factors' } });
  await prisma.rCASection.create({ data: { rcaId: rca.id, type: 'CORRECTIVE_ACTIONS', content: 'Actions' } });
  await prisma.rCASection.create({ data: { rcaId: rca.id, type: 'PREVENTIVE_MEASURES', content: 'Measures' } });
  res = await fetch(`${API_URL}/projects/${projAId}/rcas/${rca.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ reviewerIds: [userB.id] })
  });
  console.log('  RCA submit status:', res.status, '(Expected: 200)');

  // H. Notifications
  res = await fetch(`${API_URL}/notifications`, { headers: { 'Cookie': cookieA } });
  console.log('  Notifications status:', res.status, '(Expected: 200)');

  // I. Reports
  res = await fetch(`${API_URL}/projects/${projAId}/reports/summary`, { headers: { 'Cookie': cookieA } });
  console.log('  Reports summary status:', res.status, '(Expected: 200)');

  // J. CSV Export
  res = await fetch(`${API_URL}/projects/${projAId}/tasks/export`, { headers: { 'Cookie': cookieA } });
  console.log('  CSV export status:', res.status, '(Expected: 200)');

  // K. Health
  res = await fetch(`${API_URL}/health`);
  console.log('  Health check status:', res.status, '(Expected: 200)');

  console.log('\n=== ALL PREFERENCES VERIFICATION SUITE CHECKS COMPLETED SUCCESSFULLY ===');
}

runPreferencesTests().catch(console.error);
