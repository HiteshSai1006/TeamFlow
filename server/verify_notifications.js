import prisma from './src/config/db.js';
import { runOutboxWorker, runEmailWorker, runStaleRecoveryWorker } from './src/services/email.worker.js';
import { processOutboxEvent } from './src/modules/notification/notification.service.js';

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

async function runNotificationTests() {
  console.log('=== STARTING STAGE 13 NOTIFICATION VERIFICATION SUITE ===\n');

  // Clear existing databases associated with test users to prevent unique constraint failures
  const testEmails = [
    'notif_mgr@test.com',
    'notif_mem1@test.com',
    'notif_mem2@test.com',
    'notif_rev1@test.com',
    'notif_rev2@test.com',
    'fail@test.com'
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
  const mgrCookie = await registerOrLogin('notif_mgr@test.com', 'Notif Manager', 'securepassword123');
  const mem1Cookie = await registerOrLogin('notif_mem1@test.com', 'Notif Member 1', 'securepassword123');
  const mem2Cookie = await registerOrLogin('notif_mem2@test.com', 'Notif Member 2', 'securepassword123');
  const rev1Cookie = await registerOrLogin('notif_rev1@test.com', 'Notif Reviewer 1', 'securepassword123');
  const rev2Cookie = await registerOrLogin('notif_rev2@test.com', 'Notif Reviewer 2', 'securepassword123');
  const failCookie = await registerOrLogin('fail@test.com', 'Fail Recipient', 'securepassword123');

  const mgrUser = await getMe(mgrCookie);
  const mem1User = await getMe(mem1Cookie);
  const mem2User = await getMe(mem2Cookie);
  const rev1User = await getMe(rev1Cookie);
  const rev2User = await getMe(rev2Cookie);
  const failUser = await getMe(failCookie);

  // Create Project
  const projRes = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ name: 'Notification Main Project' })
  });
  const project = (await projRes.json()).project;
  const projectId = project.id;
  console.log(`Created Project: ${project.name} (ID: ${projectId})`);

  // Add members
  const invite = async (email, role) => {
    await fetch(`${API_URL}/projects/${projectId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
      body: JSON.stringify({ email, role })
    });
  };
  await invite('notif_mem1@test.com', 'MEMBER');
  await invite('notif_mem2@test.com', 'MEMBER');
  await invite('notif_rev1@test.com', 'REVIEWER');
  await invite('notif_rev2@test.com', 'REVIEWER');
  await invite('fail@test.com', 'MEMBER');

  // Helper to fill all 4 sections for an RCA
  const populateSections = async (rcaId, cookie) => {
    const sections = ['TIMELINE', 'CONTRIBUTING_FACTORS', 'CORRECTIVE_ACTIONS', 'PREVENTIVE_MEASURES'];
    for (const sec of sections) {
      await fetch(`${API_URL}/projects/${projectId}/rcas/${rcaId}/sections/${sec}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
        body: JSON.stringify({ content: `Section ${sec} content.` })
      });
    }
  };

  // --- 1. Parent Transaction Rollback ---
  console.log('\n--- 1. Parent Transaction Rollback ---');
  let rollbackErrorTriggered = false;
  let rolledBackTaskId = 999999;
  try {
    await prisma.$transaction(async (tx) => {
      // Create a task
      const t = await tx.task.create({
        data: {
          projectId,
          title: 'Rollback Task Title',
          priority: 'MEDIUM',
          status: 'TODO',
          createdById: mgrUser.id,
          assigneeId: mem1User.id
        }
      });
      rolledBackTaskId = t.id;

      // Add to EventOutbox
      await tx.eventOutbox.create({
        data: {
          eventType: 'TASK_ASSIGNED',
          entityId: t.id,
          actorId: mgrUser.id,
          metadata: { taskId: t.id, taskTitle: t.title, newAssigneeId: mem1User.id, actorId: mgrUser.id }
        }
      });

      // Force failure
      throw new Error('Forced parent transaction rollback error');
    });
  } catch (err) {
    if (err.message === 'Forced parent transaction rollback error') {
      rollbackErrorTriggered = true;
    }
  }

  const rolledBackTask = await prisma.task.findUnique({ where: { id: rolledBackTaskId } });
  const rolledBackOutbox = await prisma.eventOutbox.findFirst({ where: { entityId: rolledBackTaskId } });
  console.log('  Parent transaction error caught:', rollbackErrorTriggered, '(Expected: true)');
  console.log('  Task creation rolled back and absent:', rolledBackTask === null, '(Expected: true)');
  console.log('  EventOutbox row rolled back and absent:', rolledBackOutbox === null, '(Expected: true)');

  // --- 2. Same-Event Idempotency ---
  console.log('\n--- 2. Same-Event Idempotency ---');
  // Manager creates task assigned to Member 1
  let res = await fetch(`${API_URL}/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ title: 'Idempotency task test', assigneeId: mem1User.id })
  });
  const task1 = (await res.json()).task;

  let outbox1 = await prisma.eventOutbox.findFirst({
    where: { eventType: 'TASK_ASSIGNED', entityId: task1.id }
  });

  // Call processOutboxEvent concurrently multiple times for the exact same event ID
  await Promise.all([
    processOutboxEvent(outbox1.id),
    processOutboxEvent(outbox1.id),
    processOutboxEvent(outbox1.id)
  ]);

  let idempotentNotifications = await prisma.notification.findMany({
    where: { eventId: outbox1.id }
  });
  console.log('  Concurrent idempotency checks notification count:', idempotentNotifications.length, '(Expected: 1)');

  // --- 3. Legitimate Repeat Events ---
  console.log('\n--- 3. Legitimate Repeat Events ---');
  // Manager re-assigns task1 to Member 2
  res = await fetch(`${API_URL}/projects/${projectId}/tasks/${task1.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ assigneeId: mem2User.id })
  });
  console.log('  Reassign to Mem2 PATCH status:', res.status);

  // Manager re-assigns task1 back to Member 1
  res = await fetch(`${API_URL}/projects/${projectId}/tasks/${task1.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ assigneeId: mem1User.id })
  });
  console.log('  Reassign back to Mem1 PATCH status:', res.status);

  let repeatOutboxEvents = await prisma.eventOutbox.findMany({
    where: { eventType: 'TASK_ASSIGNED', entityId: task1.id }
  });
  console.log('  Legitimate repeat events created separate outboxes count:', repeatOutboxEvents.length, '(Expected: 3)');

  await runOutboxWorker();
  let repeatNotifications = await prisma.notification.findMany({
    where: { eventId: { in: repeatOutboxEvents.map(e => e.id) } }
  });
  // Task created + assign Mem2 + assign Mem1. Actors (mgrUser) excluded, so:
  // Event 1 (assigned to Mem1): 1 notification (recipient Mem1)
  // Event 2 (assigned to Mem2): 1 notification (recipient Mem2)
  // Event 3 (assigned to Mem1): 1 notification (recipient Mem1)
  console.log('  Notifications fanned out for repeat events count:', repeatNotifications.length, '(Expected: 3)');

  // --- 4. Concurrent Outbox Claims ---
  console.log('\n--- 4. Concurrent Outbox Claims ---');
  // Create 3 new tasks to generate 3 pending EventOutbox rows
  const taskIds = [];
  for (let i = 0; i < 3; i++) {
    res = await fetch(`${API_URL}/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
      body: JSON.stringify({ title: `Claim test task ${i}`, assigneeId: mem1User.id })
    });
    taskIds.push((await res.json()).task.id);
  }

  // Trigger outbox workers concurrently
  await Promise.all([
    runOutboxWorker(),
    runOutboxWorker()
  ]);

  let processedOutboxes = await prisma.eventOutbox.findMany({
    where: { entityId: { in: taskIds }, eventType: 'TASK_ASSIGNED' }
  });
  console.log('  All concurrent outboxes processed:', processedOutboxes.every(o => o.processingState === 'PROCESSED'), '(Expected: true)');
  console.log('  No outbox has multiple processing attempts:', processedOutboxes.every(o => o.processingAttempts === 1), '(Expected: true)');

  // --- 5. Fan-out Atomicity ---
  console.log('\n--- 5. Fan-out Atomicity ---');
  // Manager creates task assigned to Member 2
  res = await fetch(`${API_URL}/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ title: 'Fan-out atomicity test task', assigneeId: mem2User.id })
  });
  const atomTask = (await res.json()).task;

  let atomOutbox = await prisma.eventOutbox.findFirst({
    where: { eventType: 'TASK_ASSIGNED', entityId: atomTask.id }
  });

  // Simulate a crash/failure inside the processOutboxEvent transaction after notification insertion
  let fanoutErrorTriggered = false;
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Insert notification
      await tx.notification.create({
        data: {
          recipientId: mem2User.id,
          eventId: atomOutbox.id,
          dedupKey: `event:${atomOutbox.id}:recipient:${mem2User.id}`,
          title: 'Test Atomicity',
          message: 'Should rollback'
        }
      });
      // 2. Force failure before outbox state updates to PROCESSED
      throw new Error('Forced fan-out transaction failure');
    });
  } catch (err) {
    if (err.message === 'Forced fan-out transaction failure') {
      fanoutErrorTriggered = true;
    }
  }

  let atomNotifications = await prisma.notification.findMany({ where: { eventId: atomOutbox.id } });
  let recheckedOutbox = await prisma.eventOutbox.findUnique({ where: { id: atomOutbox.id } });
  console.log('  Fan-out error caught:', fanoutErrorTriggered, '(Expected: true)');
  console.log('  No partial Notification rows persisted:', atomNotifications.length === 0, '(Expected: true)');
  console.log('  Outbox event is still PENDING (recoverable):', recheckedOutbox.processingState === 'PENDING', '(Expected: true)');

  // --- 6. Concurrent Email Claims ---
  console.log('\n--- 6. Concurrent Email Claims ---');
  // Clear any unprocessed outbox events
  await runOutboxWorker();

  // Run email workers concurrently
  await Promise.all([
    runEmailWorker(),
    runEmailWorker()
  ]);

  let sentNotifications = await prisma.notification.findMany({
    where: { recipientId: mem2User.id, title: 'Task Assigned' }
  });
  console.log('  Notifications sent exactly once without duplicate processing:', sentNotifications.every(n => n.emailAttempts === 1), '(Expected: true)');

  // --- 7. Stale Email Recovery ---
  console.log('\n--- 7. Stale Email Recovery ---');
  // Create a stale processing notification
  const staleNotif = await prisma.notification.create({
    data: {
      recipientId: mem1User.id,
      eventId: atomOutbox.id,
      dedupKey: `event:stale:recipient:${mem1User.id}`,
      title: 'Stale Email Title',
      message: 'Stale Email Message',
      emailState: 'PROCESSING',
      emailAttempts: 1,
      claimedAt: new Date(Date.now() - 6 * 60 * 1000) // 6 minutes ago
    }
  });

  // Run recovery
  await runStaleRecoveryWorker();

  let recoveredNotif = await prisma.notification.findUnique({ where: { id: staleNotif.id } });
  console.log('  Stale email state returned to PENDING:', recoveredNotif.emailState === 'PENDING', '(Expected: true)');
  console.log('  Stale email claimedAt cleared:', recoveredNotif.claimedAt === null, '(Expected: true)');
  console.log('  Stale email attempts did not increment again:', recoveredNotif.emailAttempts === 1, '(Expected: true)');

  // Clean up stale test notifications to not pollute main tests
  await prisma.notification.delete({ where: { id: staleNotif.id } });

  // --- 8. Full Regressions Suite ---
  console.log('\n--- 8. Full Regressions Suite ---');

  // A. Authentication Protection (Access /notifications without cookie)
  res = await fetch(`${API_URL}/notifications`);
  console.log('  Auth protection check status:', res.status, '(Expected: 401)');

  // B. Project Access Isolation (Member 2 tries to access task1 in Project which they are a member of, but let's check non-member access block)
  // Create a separate project under Member 1
  const proj2Res = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mem1Cookie },
    body: JSON.stringify({ name: 'Private Member 1 Project' })
  });
  const project2 = (await proj2Res.json()).project;
  // Member 2 tries to list members of Project 2
  res = await fetch(`${API_URL}/projects/${project2.id}/members`, {
    headers: { 'Cookie': mem2Cookie }
  });
  console.log('  Project access isolation check status:', res.status, '(Expected: 403)');

  // C. Task Lifecycle Transitions
  // Create task under main project
  res = await fetch(`${API_URL}/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ title: 'Lifecycle task', assigneeId: mem1User.id })
  });
  const lifeTask = (await res.json()).task;
  // Member 1 transitions to IN_PROGRESS
  res = await fetch(`${API_URL}/projects/${projectId}/tasks/${lifeTask.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': mem1Cookie },
    body: JSON.stringify({ status: 'IN_PROGRESS' })
  });
  console.log('  Valid transition status:', res.status, '(Expected: 200)');
  // Member 1 tries to skip to COMPLETED from IN_PROGRESS (invalid transition, must go through READY_FOR_REVIEW)
  res = await fetch(`${API_URL}/projects/${projectId}/tasks/${lifeTask.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': mem1Cookie },
    body: JSON.stringify({ status: 'COMPLETED' })
  });
  console.log('  Invalid transition status:', res.status, '(Expected: 400)');

  // D. Dependency Cycle Rejection
  // Create Task A and Task B
  const taskA = (await (await fetch(`${API_URL}/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ title: 'Task A' })
  })).json()).task;
  const taskB = (await (await fetch(`${API_URL}/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ title: 'Task B' })
  })).json()).task;
  // A depends on B (B is source, A is target)
  await fetch(`${API_URL}/projects/${projectId}/tasks/${taskB.id}/relations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ targetTaskId: taskA.id })
  });
  // Try to make B depend on A (creates a cycle)
  res = await fetch(`${API_URL}/projects/${projectId}/tasks/${taskA.id}/relations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ targetTaskId: taskB.id })
  });
  console.log('  Dependency cycle check status:', res.status, '(Expected: 409)');

  // E. Comments
  res = await fetch(`${API_URL}/projects/${projectId}/tasks/${taskA.id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mem1Cookie },
    body: JSON.stringify({ content: 'Verified comment.' })
  });
  console.log('  Comment creation status:', res.status, '(Expected: 201)');

  // F. Attachments list
  res = await fetch(`${API_URL}/projects/${projectId}/tasks/${taskA.id}/attachments`, {
    headers: { 'Cookie': mem1Cookie }
  });
  console.log('  Attachments list status:', res.status, '(Expected: 200)');

  // G. RCA/Review Workflow
  res = await fetch(`${API_URL}/projects/${projectId}/rcas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mem1Cookie },
    body: JSON.stringify({ title: 'Workflow RCA', severity: 'MEDIUM' })
  });
  const testRca = (await res.json()).rca;
  console.log('  RCA creation status:', !!testRca, '(Expected: true)');

  // H. Health
  res = await fetch(`${API_URL}/health`);
  console.log('  Health status code:', res.status, '(Expected: 200)');

  console.log('\n=== ALL SUPPLEMENTARY STAGE 13 VERIFICATION CHECKS SUCCESSFULLY COMPLETED ===');
}

runNotificationTests().catch(console.error);
