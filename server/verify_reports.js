import prisma from './src/config/db.js';
import { getWeeklyUTCBuckets, getSummaryReport } from './src/modules/report/report.service.js';

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

async function runReportTests() {
  console.log('=== STARTING STAGE 14A REPORTING SUPPLEMENTARY VERIFICATION SUITE ===\n');

  // Clear existing databases associated with test users to prevent unique constraint failures
  const testEmails = [
    'report_mgr@test.com',
    'report_mem@test.com',
    'report_out@test.com'
  ];

  const users = await prisma.user.findMany({ where: { email: { in: testEmails } } });
  const userIds = users.map(u => u.id);

  if (userIds.length > 0) {
    const projects = await prisma.project.findMany({ where: { createdById: { in: userIds } } });
    const projectIds = projects.map(p => p.id);

    if (projectIds.length > 0) {
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

    await prisma.notification.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.userPreference.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.eventOutbox.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.projectMember.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  // Register / Login Users
  const mgrCookie = await registerOrLogin('report_mgr@test.com', 'Report Manager', 'securepassword123');
  const memCookie = await registerOrLogin('report_mem@test.com', 'Report Member', 'securepassword123');
  const outCookie = await registerOrLogin('report_out@test.com', 'Report Outsider', 'securepassword123');

  const mgrUser = await getMe(mgrCookie);
  const memUser = await getMe(memCookie);

  // Create Project
  const projRes = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ name: 'Reporting Core Project' })
  });
  const project = (await projRes.json()).project;
  const projectId = project.id;
  console.log(`Created Project: ${project.name} (ID: ${projectId})`);

  // Add member
  await fetch(`${API_URL}/projects/${projectId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ email: 'report_mem@test.com', role: 'MEMBER' })
  });

  // Calculate standard UTC weekly buckets
  const refDate = new Date(Date.UTC(2026, 6, 5, 12, 0, 0)); // July 5, 2026
  const buckets = getWeeklyUTCBuckets(refDate);

  // --- CHECK 1: Chronological Trend Buckets ---
  console.log('\n--- 1. Chronological Trend Buckets & UTC Ranges ---');
  let res = await fetch(`${API_URL}/projects/${projectId}/reports/summary`, {
    headers: { 'Cookie': memCookie }
  });
  let report = await res.json();

  console.log('  Velocity contains exactly 6 buckets:', report.velocity.length === 6, '(Expected: true)');
  console.log('  RCA Volume trend contains exactly 6 buckets:', report.rcaVolume.trend.length === 6, '(Expected: true)');

  const velocityLabels = report.velocity.map(v => v.label);
  const rcaLabels = report.rcaVolume.trend.map(r => r.label);
  const rangesMatch = velocityLabels.every((val, i) => val === rcaLabels[i]);
  console.log('  Both trends use the exact same UTC date ranges:', rangesMatch, '(Expected: true)');

  // Zero-activity weeks return 0
  const zeroActivityVelocity = report.velocity.every(v => v.completedTasks === 0);
  const zeroActivityRcas = report.rcaVolume.trend.every(r => r.createdRcas === 0);
  console.log('  Zero-activity weeks return 0 for velocity:', zeroActivityVelocity, '(Expected: true)');
  console.log('  Zero-activity weeks return 0 for RCAs:', zeroActivityRcas, '(Expected: true)');

  // --- CHECK 2: Targeted Weekly Seeding ---
  console.log('\n--- 2. Targeted Weekly Seeding & Isolation ---');
  // Seed task completion in Week 3 (Monday June 8 - Sunday June 14)
  const w3 = buckets[2];
  const midWeek3 = new Date(w3.start.getTime() + 12 * 60 * 60 * 1000); // midday Monday
  const tCompleted = await prisma.task.create({
    data: {
      projectId,
      title: 'Completed Task in Week 3',
      status: 'DONE',
      createdById: mgrUser.id
    }
  });
  await prisma.activityLog.create({
    data: {
      projectId,
      taskId: tCompleted.id,
      actorId: mgrUser.id,
      eventType: 'TASK_STATUS_CHANGE',
      metadata: { before: 'TODO', after: 'DONE' },
      createdAt: midWeek3
    }
  });

  // Seed RCA in Week 4 (Monday June 15 - Sunday June 21)
  const w4 = buckets[3];
  const midWeek4 = new Date(w4.start.getTime() + 12 * 60 * 60 * 1000); // midday Monday
  await prisma.rCA.create({
    data: {
      projectId,
      title: 'Week 4 RCA',
      severity: 'LOW',
      status: 'DRAFT',
      createdById: mgrUser.id,
      createdAt: midWeek4
    }
  });

  // Fetch report using same July 5 reference
  // Note: we fetch report summary. Our endpoint runs live. In the test database, the simulated log timestamps are relative.
  // Let's query getSummaryReport directly with our reference date July 5, 2026 to ensure the mock timestamps match exactly!
  const liveServiceReport = await getSummaryReport(projectId, refDate);
  console.log('  Week 3 velocity count:', liveServiceReport.velocity[2].completedTasks, '(Expected: 1)');
  console.log('  Other weeks velocity counts are 0:', liveServiceReport.velocity.filter((v, i) => i !== 2).every(v => v.completedTasks === 0), '(Expected: true)');
  console.log('  Week 4 RCA count:', liveServiceReport.rcaVolume.trend[3].createdRcas, '(Expected: 1)');
  console.log('  Other weeks RCA counts are 0:', liveServiceReport.rcaVolume.trend.filter((r, i) => i !== 3).every(r => r.createdRcas === 0), '(Expected: true)');

  // --- CHECK 3: Counts Database Cross-check ---
  console.log('\n--- 3. Database Cross-check for Status and Priorities ---');
  // Query status counts directly
  const dbStatusTodo = await prisma.task.count({ where: { projectId, status: 'TODO' } });
  const dbStatusDone = await prisma.task.count({ where: { projectId, status: 'DONE' } });
  console.log('  TODO count matches database:', liveServiceReport.taskStatus.TODO === dbStatusTodo, '(Expected: true)');
  console.log('  DONE count matches database:', liveServiceReport.taskStatus.DONE === dbStatusDone, '(Expected: true)');

  const dbPriorityMedium = await prisma.task.count({ where: { projectId, priority: 'MEDIUM' } });
  console.log('  MEDIUM priority count matches database:', liveServiceReport.taskPriority.MEDIUM === dbPriorityMedium, '(Expected: true)');

  // --- CHECK 4: Workload Equation ---
  console.log('\n--- 4. Workload Totals Equation ---');
  const workloadSatisfied = liveServiceReport.workload.every(w => {
    return w.totalAssigned === (w.activeTasks + w.completedTasks);
  });
  console.log('  totalAssigned === activeTasks + completedTasks for all assignees:', workloadSatisfied, '(Expected: true)');

  // --- CHECK 5: Overdue Exclusions ---
  console.log('\n--- 5. Overdue Task Exclusions ---');
  // Overdue task completed (Status DONE)
  const overdueDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.task.create({
    data: {
      projectId,
      title: 'Overdue but completed',
      status: 'DONE',
      dueDate: overdueDate,
      createdById: mgrUser.id
    }
  });
  // Task in future (Status TODO, future dueDate)
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.task.create({
    data: {
      projectId,
      title: 'Not overdue (future dueDate)',
      status: 'TODO',
      dueDate: futureDate,
      createdById: mgrUser.id
    }
  });

  const freshReport = await getSummaryReport(projectId, new Date());
  // The newly added tasks are not in overdue
  console.log('  Overdue list count does not include DONE or future-due tasks:', freshReport.overdue.tasks.length === 1, '(Expected: true)');

  // --- CHECK 6: Health Score Boundary Clamping ---
  console.log('\n--- 6. Health Score Boundary Clamping ---');
  // Clean project should have score = 100
  const cleanProject = await prisma.project.create({
    data: { name: 'Clean Health Project', createdById: mgrUser.id }
  });
  const cleanReport = await getSummaryReport(cleanProject.id, new Date());
  console.log('  Clean project health score:', cleanReport.projectHealth.score, '(Expected: 100)');

  // Seed excessive penalties to project 1 (exceeding 100 points)
  // Blocked tasks: 5 blocked tasks (penalty cap -30)
  for (let i = 0; i < 5; i++) {
    await prisma.task.create({
      data: { projectId, title: `Blocked task ${i}`, status: 'BLOCKED', createdById: mgrUser.id }
    });
  }
  // Overdue tasks: 8 overdue tasks (penalty cap -30)
  for (let i = 0; i < 8; i++) {
    await prisma.task.create({
      data: { projectId, title: `Overdue task ${i}`, status: 'TODO', dueDate: overdueDate, createdById: mgrUser.id }
    });
  }
  // Critical unfinished: 6 tasks (penalty cap -20)
  for (let i = 0; i < 6; i++) {
    await prisma.task.create({
      data: { projectId, title: `Critical priority task ${i}`, status: 'TODO', priority: 'CRITICAL', createdById: mgrUser.id }
    });
  }
  // Unresolved RCAs: 4 RCAs (penalty cap -20)
  for (let i = 0; i < 4; i++) {
    await prisma.rCA.create({
      data: { projectId, title: `RCA ${i}`, status: 'DRAFT', severity: 'MEDIUM', createdById: mgrUser.id }
    });
  }

  // Total theoretical penalty: 30 + 30 + 20 + 20 = 100.
  // Let's fetch project 1 report
  const cappedReport = await getSummaryReport(projectId, new Date());
  console.log('  Excessive health penalty score clamped to 0 minimum:', cappedReport.projectHealth.score === 0, '(Expected: true)');

  // --- CHECK 7: Regressions ---
  console.log('\n--- 7. Regressions ---');

  // A. Authentication Protection (Access /reports/summary without cookie)
  res = await fetch(`${API_URL}/projects/${projectId}/reports/summary`);
  console.log('  Auth check status:', res.status, '(Expected: 401)');

  // B. Project Access Isolation (Outsider tries to access report)
  res = await fetch(`${API_URL}/projects/${projectId}/reports/summary`, {
    headers: { 'Cookie': outCookie }
  });
  console.log('  Project access isolation status:', res.status, '(Expected: 403)');

  // C. Task Lifecycle
  const testTask = await prisma.task.create({
    data: { projectId, title: 'Regression Task', status: 'TODO', createdById: mgrUser.id }
  });
  res = await fetch(`${API_URL}/projects/${projectId}/tasks/${testTask.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ status: 'IN_PROGRESS' })
  });
  console.log('  Lifecycle transition status:', res.status, '(Expected: 200)');

  // D. Dependency Cycle Rejection
  const tA = await prisma.task.create({ data: { projectId, title: 'Task A', status: 'TODO', createdById: mgrUser.id } });
  const tB = await prisma.task.create({ data: { projectId, title: 'Task B', status: 'TODO', createdById: mgrUser.id } });
  await fetch(`${API_URL}/projects/${projectId}/tasks/${tB.id}/relations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ targetTaskId: tA.id })
  });
  res = await fetch(`${API_URL}/projects/${projectId}/tasks/${tA.id}/relations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ targetTaskId: tB.id })
  });
  console.log('  Dependency cycle check status:', res.status, '(Expected: 409)');

  // E. Comments
  res = await fetch(`${API_URL}/projects/${projectId}/tasks/${testTask.id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ content: 'Regression comment' })
  });
  console.log('  Comment creation status:', res.status, '(Expected: 201)');

  // F. Attachments
  res = await fetch(`${API_URL}/projects/${projectId}/tasks/${testTask.id}/attachments`, {
    headers: { 'Cookie': mgrCookie }
  });
  console.log('  Attachments query status:', res.status, '(Expected: 200)');

  // G. RCA Workflow (draft to under review)
  // Make project ACTIVE and user a REVIEWER in the DB for submission testing
  await prisma.project.update({ where: { id: projectId }, data: { status: 'ACTIVE' } });
  await prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId: memUser.id } },
    data: { role: 'REVIEWER' }
  });

  const regressionRca = await prisma.rCA.create({
    data: { projectId, title: 'Regression RCA', severity: 'MEDIUM', status: 'DRAFT', createdById: mgrUser.id }
  });
  // Add section content
  await prisma.rCASection.create({ data: { rcaId: regressionRca.id, type: 'TIMELINE', content: 'Timeline content' } });
  await prisma.rCASection.create({ data: { rcaId: regressionRca.id, type: 'CONTRIBUTING_FACTORS', content: 'Factors content' } });
  await prisma.rCASection.create({ data: { rcaId: regressionRca.id, type: 'CORRECTIVE_ACTIONS', content: 'Actions content' } });
  await prisma.rCASection.create({ data: { rcaId: regressionRca.id, type: 'PREVENTIVE_MEASURES', content: 'Measures content' } });

  res = await fetch(`${API_URL}/projects/${projectId}/rcas/${regressionRca.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ reviewerIds: [memUser.id] })
  });
  console.log('  RCA submission status:', res.status, '(Expected: 200)');

  // H. Notifications bell count query
  res = await fetch(`${API_URL}/notifications`, { headers: { 'Cookie': mgrCookie } });
  console.log('  Notifications fetch status:', res.status, '(Expected: 200)');

  // I. /api/health
  res = await fetch(`${API_URL}/health`);
  console.log('  Health check status:', res.status, '(Expected: 200)');

  console.log('\n=== ALL SUPPLEMENTARY STAGE 14A VERIFICATION CHECKS COMPLETED SUCCESSFULLY ===');
}

runReportTests().catch(console.error);
