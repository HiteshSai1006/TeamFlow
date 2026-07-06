import prisma from './src/config/db.js';
import { runEmailWorker } from './src/services/email.worker.js';
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

async function runMentionsTests() {
  console.log('=== STARTING STAGE 15A MENTIONS & GAP AUDIT VERIFICATION ===\n');

  // Clean DB for test users
  const testEmails = [
    'mention_user_a@test.com',
    'mention_user_b@test.com',
    'mention_user_c@test.com',
    'mention_user_d@test.com'
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
        await prisma.commentMention.deleteMany({ where: { comment: { taskId: { in: taskIds } } } });
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
    await prisma.commentMention.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.userPreference.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.eventOutbox.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.projectMember.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  // Register / Login Users
  const cookieA = await registerOrLogin('mention_user_a@test.com', 'Mention User A', 'securepassword123');
  const cookieB = await registerOrLogin('mention_user_b@test.com', 'Mention User B', 'securepassword123');
  const cookieC = await registerOrLogin('mention_user_c@test.com', 'Mention User C', 'securepassword123');
  const cookieD = await registerOrLogin('mention_user_d@test.com', 'Mention User D', 'securepassword123');

  const userA = await getMe(cookieA);
  const userB = await getMe(cookieB);
  const userC = await getMe(cookieC);
  const userD = await getMe(cookieD);

  console.log('✔ Test users registered successfully.');

  // Create Project A (User A) and add B and C as members
  let res = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ name: 'Project A' })
  });
  const projectA = (await res.json()).project;

  await prisma.projectMember.createMany({
    data: [
      { projectId: projectA.id, userId: userB.id, role: 'MEMBER' },
      { projectId: projectA.id, userId: userC.id, role: 'MEMBER' }
    ]
  });

  // Create Project B (User D)
  res = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieD },
    body: JSON.stringify({ name: 'Project B' })
  });
  const projectB = (await res.json()).project;

  // Create Task A in Project A
  res = await fetch(`${API_URL}/projects/${projectA.id}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ title: 'Task A', status: 'TODO', priority: 'MEDIUM' })
  });
  const taskA = (await res.json()).task;

  console.log('✔ Workspace setup complete.');

  // Test 1: Ordinary Comment Still Works
  console.log('\n- Test 1: Posting ordinary comment...');
  res = await fetch(`${API_URL}/projects/${projectA.id}/tasks/${taskA.id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ content: 'Just a plain comment.' })
  });
  if (res.status !== 201) throw new Error(`Ordinary comment creation failed: ${res.status}`);
  console.log('✔ Ordinary comment creation returned 201.');

  // Test 2: Literal "@" Text Creates No False Structured Mentions
  console.log('\n- Test 2: Posting literal @ text comment...');
  res = await fetch(`${API_URL}/projects/${projectA.id}/tasks/${taskA.id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ content: 'Contact me @hello or email@example.com or standalone @ symbol' })
  });
  const commentLiteral = (await res.json()).comment;
  const literalMentionsCount = await prisma.commentMention.count({ where: { commentId: commentLiteral.id } });
  if (literalMentionsCount !== 0) throw new Error(`Expected 0 mentions, found ${literalMentionsCount}`);
  console.log('✔ Literal @ strings created zero false mention records.');

  // Test 3: Mention One Member Works
  console.log('\n- Test 3: Mentioning one member...');
  res = await fetch(`${API_URL}/projects/${projectA.id}/tasks/${taskA.id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({
      content: `Hello @[Mention User B](user:${userB.id}) please review this task.`,
      mentionedUserIds: [userB.id]
    })
  });
  if (res.status !== 201) throw new Error(`Failed to mention member: ${res.status}`);
  const commentSingle = (await res.json()).comment;
  const singleMentions = await prisma.commentMention.findMany({ where: { commentId: commentSingle.id } });
  if (singleMentions.length !== 1 || singleMentions[0].userId !== userB.id) {
    throw new Error(`Expected exactly 1 mention record for B, found: ${JSON.stringify(singleMentions)}`);
  }
  const singleOutboxCount = await prisma.eventOutbox.count({
    where: { eventType: 'TASK_COMMENT_MENTION', entityId: commentSingle.id }
  });
  if (singleOutboxCount !== 1) throw new Error(`Expected exactly 1 EventOutbox row, found ${singleOutboxCount}`);
  console.log('✔ Single member mention created exactly 1 CommentMention and 1 EventOutbox row.');

  // Test 4: Mention Multiple Members Works
  console.log('\n- Test 4: Mentioning multiple members...');
  res = await fetch(`${API_URL}/projects/${projectA.id}/tasks/${taskA.id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({
      content: `Hey @[Mention User B](user:${userB.id}) and @[Mention User C](user:${userC.id}) check this!`,
      mentionedUserIds: [userB.id, userC.id]
    })
  });
  const commentMulti = (await res.json()).comment;
  const multiMentions = await prisma.commentMention.findMany({ where: { commentId: commentMulti.id } });
  if (multiMentions.length !== 2) throw new Error(`Expected exactly 2 mention rows, found ${multiMentions.length}`);
  const multiOutboxCount = await prisma.eventOutbox.count({
    where: { eventType: 'TASK_COMMENT_MENTION', entityId: commentMulti.id }
  });
  if (multiOutboxCount !== 1) throw new Error(`Expected exactly 1 EventOutbox row for multi-mention, found ${multiOutboxCount}`);
  console.log('✔ Multi-member mention created exactly 2 CommentMentions and 1 EventOutbox row.');

  // Test 5: Duplicate IDs Deduplication
  console.log('\n- Test 5: Deduplication of mentioned IDs...');
  res = await fetch(`${API_URL}/projects/${projectA.id}/tasks/${taskA.id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({
      content: `Hello @[Mention User B](user:${userB.id}) and @[Mention User B](user:${userB.id}) again!`,
      mentionedUserIds: [userB.id, userB.id]
    })
  });
  const commentDup = (await res.json()).comment;
  const dupMentions = await prisma.commentMention.findMany({ where: { commentId: commentDup.id } });
  if (dupMentions.length !== 1) throw new Error(`Expected exactly 1 mention record for duplicate IDs, found ${dupMentions.length}`);
  console.log('✔ Duplicate mentioned IDs deduplicated successfully.');

  // Test 6: Self-Mentions Exclusion
  console.log('\n- Test 6: Self-mention exclusion...');
  res = await fetch(`${API_URL}/projects/${projectA.id}/tasks/${taskA.id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({
      content: `Self mention @[Mention User A](user:${userA.id})!`,
      mentionedUserIds: [userA.id]
    })
  });
  const commentSelf = (await res.json()).comment;
  const selfMentionsCount = await prisma.commentMention.count({ where: { commentId: commentSelf.id } });
  if (selfMentionsCount !== 0) throw new Error(`Self mention created ${selfMentionsCount} records.`);
  const selfOutboxCount = await prisma.eventOutbox.count({
    where: { eventType: 'TASK_COMMENT_MENTION', entityId: commentSelf.id }
  });
  if (selfOutboxCount !== 0) throw new Error(`Self mention created EventOutbox entry.`);
  console.log('✔ Self-mention correctly excluded from database records and outbox events.');

  // Test 7: Outsider User ID Rejection (400)
  console.log('\n- Test 7: Outsider ID rejection (User D is not a member of A)...');
  res = await fetch(`${API_URL}/projects/${projectA.id}/tasks/${taskA.id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({
      content: `Pinging outsider @[Mention User D](user:${userD.id})`,
      mentionedUserIds: [userD.id]
    })
  });
  if (res.status !== 400) throw new Error(`Expected 400 for outsider ID, got ${res.status}`);
  console.log('✔ Mentioning outsider user successfully rejected with 400.');

  // Test 8: Cross-Project User ID Rejection (400)
  console.log('\n- Test 8: Cross-project ID rejection...');
  res = await fetch(`${API_URL}/projects/${projectA.id}/tasks/${taskA.id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({
      content: `Pinging cross-project user @[Mention User D](user:${userD.id})`,
      mentionedUserIds: [userB.id, userD.id] // B is member, D is cross-project
    })
  });
  if (res.status !== 400) throw new Error(`Expected 400 for cross-project ID payload, got ${res.status}`);
  console.log('✔ Mentioning cross-project user successfully rejected with 400.');

  // Test 9: Transaction Rollback on Failure
  console.log('\n- Test 9: Transaction safety check...');
  const commentsBefore = await prisma.comment.count();
  const mentionsBefore = await prisma.commentMention.count();
  const outboxBefore = await prisma.eventOutbox.count();

  // Try to create comment with manipulated payload: valid member + outsider (fails validation inside the endpoint logic)
  res = await fetch(`${API_URL}/projects/${projectA.id}/tasks/${taskA.id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({
      content: 'Rollback test',
      mentionedUserIds: [userB.id, userD.id]
    })
  });

  const commentsAfter = await prisma.comment.count();
  const mentionsAfter = await prisma.commentMention.count();
  const outboxAfter = await prisma.eventOutbox.count();

  if (commentsAfter !== commentsBefore || mentionsAfter !== mentionsBefore || outboxAfter !== outboxBefore) {
    throw new Error('Transaction rollback failed! Database records were modified on failed request.');
  }
  console.log('✔ Verified: Zero records committed when the validation fails.');

  // Test 10: Repeated Outbox processing creates no duplicate notification
  console.log('\n- Test 10: Deduplication on repeated outbox processing...');
  const multiEvent = await prisma.eventOutbox.findFirst({
    where: { eventType: 'TASK_COMMENT_MENTION', entityId: commentMulti.id }
  });
  if (!multiEvent) throw new Error('Multi-mention event not found.');

  // Process the event outbox row manually
  await processOutboxEvent(multiEvent.id);
  const deliveredNotifsCount1 = await prisma.notification.count({ where: { eventId: multiEvent.id } });

  // Process the exact same event outbox row again (simulating duplicate worker run)
  await processOutboxEvent(multiEvent.id);
  const deliveredNotifsCount2 = await prisma.notification.count({ where: { eventId: multiEvent.id } });

  if (deliveredNotifsCount1 !== deliveredNotifsCount2 || deliveredNotifsCount1 !== 2) {
    throw new Error(`Deduplication failed! Initial count: ${deliveredNotifsCount1}, secondary count: ${deliveredNotifsCount2}`);
  }
  console.log('✔ Repeated processing of the same outbox event produced no duplicate notifications.');

  // Test 11: Email Opt-out Behaviour
  console.log('\n- Test 11: Email opt-out checks...');
  // Opt out User B from emails
  await fetch(`${API_URL}/notifications/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieB },
    body: JSON.stringify({ emailOptOut: true })
  });

  // Create another comment mentioning User B
  res = await fetch(`${API_URL}/projects/${projectA.id}/tasks/${taskA.id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({
      content: `Pinging opted-out user @[Mention User B](user:${userB.id})`,
      mentionedUserIds: [userB.id]
    })
  });
  const commentOptOut = (await res.json()).comment;
  const optOutEvent = await prisma.eventOutbox.findFirst({
    where: { eventType: 'TASK_COMMENT_MENTION', entityId: commentOptOut.id }
  });

  // Process event and execute email worker
  await processOutboxEvent(optOutEvent.id);
  await runEmailWorker();

  const optOutNotif = await prisma.notification.findFirst({ where: { eventId: optOutEvent.id, recipientId: userB.id } });
  if (!optOutNotif || optOutNotif.emailState !== 'SKIPPED_OPT_OUT') {
    throw new Error(`Expected emailState SKIPPED_OPT_OUT, got ${optOutNotif ? optOutNotif.emailState : 'NONE'}`);
  }
  console.log('✔ Opted-out user notification mapped successfully to SKIPPED_OPT_OUT.');

  // Test 12: Archived Project Behaviour
  console.log('\n- Test 12: Archived project comments block...');
  // Archive Project A
  await fetch(`${API_URL}/projects/${projectA.id}/archive`, {
    method: 'POST',
    headers: { 'Cookie': cookieA }
  });

  // Attempt comment posting in Project A
  res = await fetch(`${API_URL}/projects/${projectA.id}/tasks/${taskA.id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
    body: JSON.stringify({ content: 'Post inside archived project' })
  });
  if (res.status !== 400) throw new Error(`Expected 400 in archived project comment post, got ${res.status}`);
  console.log('✔ Posting comment in archived project rejected with 400.');

  // Test 13: General Regressions Checks
  console.log('\n- Test 13: Running regression checks...');
  // A. Health check
  res = await fetch(`${API_URL}/health`);
  if (res.status !== 200) throw new Error('Health check regression failed');
  console.log('✔ Health check regression passed.');

  // Restore Project A to make sure DB state remains valid
  await fetch(`${API_URL}/projects/${projectA.id}/restore`, {
    method: 'POST',
    headers: { 'Cookie': cookieA }
  });

  console.log('\n=== ALL STAGE 15A MENTIONS & GAP AUDIT VERIFICATION TESTS PASSED ===');
}

runMentionsTests().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
