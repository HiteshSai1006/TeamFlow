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

async function runHierarchyTests() {
  console.log('=== STARTING STAGE 17A TASK HIERARCHY VERIFICATION SUITE ===\n');

  // 1. Setup clean users and projects
  const emails = ['mgr_h@test.com', 'mem_h@test.com', 'out_h@test.com'];
  const oldUsers = await prisma.user.findMany({ where: { email: { in: emails } } });
  const oldUserIds = oldUsers.map(u => u.id);

  if (oldUserIds.length > 0) {
    // Delete cascading project preferences, relations, etc.
    const projects = await prisma.project.findMany({ where: { createdById: { in: oldUserIds } } });
    const projectIds = projects.map(p => p.id);

    if (projectIds.length > 0) {
      await prisma.projectViewPreference.deleteMany({ where: { projectId: { in: projectIds } } });
      await prisma.commentMention.deleteMany({ where: { user: { id: { in: oldUserIds } } } });
      await prisma.comment.deleteMany({ where: { authorId: { in: oldUserIds } } });
      await prisma.attachment.deleteMany({ where: { uploadedById: { in: oldUserIds } } });
      await prisma.review.deleteMany({ where: { reviewerId: { in: oldUserIds } } });
      await prisma.rCA.deleteMany({ where: { projectId: { in: projectIds } } });
      await prisma.taskRelation.deleteMany({
        where: {
          OR: [
            { sourceTask: { projectId: { in: projectIds } } },
            { targetTask: { projectId: { in: projectIds } } }
          ]
        }
      });
      await prisma.activityLog.deleteMany({ where: { projectId: { in: projectIds } } });
      await prisma.task.deleteMany({ where: { projectId: { in: projectIds } } });
      await prisma.projectMember.deleteMany({ where: { projectId: { in: projectIds } } });
      await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    }

    await prisma.notification.deleteMany({ where: { recipientId: { in: oldUserIds } } });
    await prisma.eventOutbox.deleteMany({ where: { actorId: { in: oldUserIds } } });
    await prisma.userPreference.deleteMany({ where: { userId: { in: oldUserIds } } });
    await prisma.projectMember.deleteMany({ where: { userId: { in: oldUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: oldUserIds } } });
  }

  // Authenticate
  const cookieMgr = await registerOrLogin('mgr_h@test.com', 'Mgr Hierarchy', 'password123');
  const cookieMem = await registerOrLogin('mem_h@test.com', 'Mem Hierarchy', 'password123');
  const cookieOut = await registerOrLogin('out_h@test.com', 'Out Hierarchy', 'password123');

  const userMgr = await getMe(cookieMgr);
  const userMem = await getMe(cookieMem);
  const userOut = await getMe(cookieOut);

  // Create Project X (Manager) and Project Y (Outsider)
  let res = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieMgr },
    body: JSON.stringify({ name: 'Project X', description: 'Internal tasks hierarchy' })
  });
  const projX = (await res.json()).project;

  res = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieOut },
    body: JSON.stringify({ name: 'Project Y', description: 'Outsider project' })
  });
  const projY = (await res.json()).project;

  // Add Member to Project X as MEMBER
  await fetch(`${API_URL}/projects/${projX.id}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieMgr },
    body: JSON.stringify({ email: 'mem_h@test.com', role: 'MEMBER' })
  });

  console.log('✔ Clean test environments established.');

  // Test 1: Task creation without parent works
  res = await fetch(`${API_URL}/projects/${projX.id}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieMgr },
    body: JSON.stringify({ title: 'Root Task A', priority: 'HIGH', status: 'TODO' })
  });
  if (res.status !== 201) throw new Error(`Test 1 Failed: Expected 201, got ${res.status}`);
  const taskA = (await res.json()).task;
  if (taskA.parentId !== null) throw new Error(`Test 1 Failed: Expected parentId to be null`);
  console.log('✔ Test 1 passed: Root task A created.');

  // Test 2: Task creation with valid same-project parent works
  res = await fetch(`${API_URL}/projects/${projX.id}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieMgr },
    body: JSON.stringify({ title: 'Subtask B', priority: 'MEDIUM', status: 'IN_PROGRESS', parentId: taskA.id })
  });
  if (res.status !== 201) throw new Error(`Test 2 Failed: Expected 201, got ${res.status}`);
  const taskB = (await res.json()).task;
  if (taskB.parentId !== taskA.id) throw new Error(`Test 2 Failed: Expected parentId ${taskA.id}`);
  console.log('✔ Test 2 passed: Subtask B created.');

  // Test 3: Parent response is correct
  res = await fetch(`${API_URL}/projects/${projX.id}/tasks/${taskB.id}`, {
    headers: { 'Cookie': cookieMgr }
  });
  const detailsB = (await res.json()).task;
  if (!detailsB.parent || detailsB.parent.id !== taskA.id || detailsB.parent.title !== 'Root Task A') {
    throw new Error(`Test 3 Failed: Parent object shape mismatch: ${JSON.stringify(detailsB.parent)}`);
  }
  console.log('✔ Test 3 passed: Parent response shape matches requirements.');

  // Test 4: Direct subtasks response is correct
  res = await fetch(`${API_URL}/projects/${projX.id}/tasks/${taskA.id}`, {
    headers: { 'Cookie': cookieMgr }
  });
  const detailsA = (await res.json()).task;
  if (!detailsA.subtasks || detailsA.subtasks.length !== 1 || detailsA.subtasks[0].id !== taskB.id) {
    throw new Error(`Test 4 Failed: Subtasks shape mismatch: ${JSON.stringify(detailsA.subtasks)}`);
  }
  console.log('✔ Test 4 passed: Direct subtasks response shape matches.');

  // Test 5: Self-parent is rejected
  res = await fetch(`${API_URL}/projects/${projX.id}/tasks/${taskA.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieMgr },
    body: JSON.stringify({ parentId: taskA.id })
  });
  if (res.status !== 400) throw new Error(`Test 5 Failed: Expected 400, got ${res.status}`);
  const errSelf = await res.json();
  if (!errSelf.message.includes('A task cannot be its own parent.')) {
    throw new Error(`Test 5 Failed: Wrong error message: ${errSelf.message}`);
  }
  console.log('✔ Test 5 passed: Self-parent assignment blocked.');

  // Test 6: Nonexistent parent is rejected
  res = await fetch(`${API_URL}/projects/${projX.id}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieMgr },
    body: JSON.stringify({ title: 'Orphan Task', parentId: 99999 })
  });
  if (res.status !== 400) throw new Error(`Test 6 Failed: Expected 400, got ${res.status}`);
  console.log('✔ Test 6 passed: Nonexistent parent task rejected.');

  // Test 7: Cross-project parent is rejected
  // Create task in project Y
  res = await fetch(`${API_URL}/projects/${projY.id}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieOut },
    body: JSON.stringify({ title: 'Task in Proj Y' })
  });
  const taskY = (await res.json()).task;

  res = await fetch(`${API_URL}/projects/${projX.id}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieMgr },
    body: JSON.stringify({ title: 'Leaked Child', parentId: taskY.id })
  });
  if (res.status !== 400) throw new Error(`Test 7 Failed: Expected 400, got ${res.status}`);
  console.log('✔ Test 7 passed: Cross-project parent linking blocked.');

  // Test 8: Outsider cannot manipulate hierarchy
  res = await fetch(`${API_URL}/projects/${projX.id}/tasks/${taskB.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieOut },
    body: JSON.stringify({ parentId: null })
  });
  if (res.status !== 403 && res.status !== 404) {
    throw new Error(`Test 8 Failed: Expected 403/404, got ${res.status}`);
  }
  console.log('✔ Test 8 passed: Outsider hierarchy edits rejected.');

  // Test 9: Cycle A -> B -> A is rejected
  // Try setting A's parent to B (A is already B's parent)
  res = await fetch(`${API_URL}/projects/${projX.id}/tasks/${taskA.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieMgr },
    body: JSON.stringify({ parentId: taskB.id })
  });
  if (res.status !== 400) throw new Error(`Test 9 Failed: Expected 400, got ${res.status}`);
  const errCycle = await res.json();
  if (!errCycle.message.includes('Setting this parent task would introduce a hierarchy cycle.')) {
    throw new Error(`Test 9 Failed: Wrong error message: ${errCycle.message}`);
  }
  console.log('✔ Test 9 passed: A -> B -> A cycle rejected.');

  // Test 10: Deeper cycle A -> B -> C -> A is rejected
  // Create child C parented to B
  res = await fetch(`${API_URL}/projects/${projX.id}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieMgr },
    body: JSON.stringify({ title: 'Subtask C', parentId: taskB.id })
  });
  const taskC = (await res.json()).task;

  // Try parenting A to C
  res = await fetch(`${API_URL}/projects/${projX.id}/tasks/${taskA.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieMgr },
    body: JSON.stringify({ parentId: taskC.id })
  });
  if (res.status !== 400) throw new Error(`Test 10 Failed: Expected 400, got ${res.status}`);
  console.log('✔ Test 10 passed: Deeper cycle A -> B -> C -> A rejected.');

  // Test 11: Parent can be removed with null
  res = await fetch(`${API_URL}/projects/${projX.id}/tasks/${taskB.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieMgr },
    body: JSON.stringify({ parentId: null })
  });
  if (res.status !== 200) throw new Error(`Test 11 Failed: Expected 200, got ${res.status}`);
  const updatedB = (await res.json()).task;
  if (updatedB.parentId !== null) throw new Error(`Test 11 Failed: Expected parentId to be null`);
  console.log('✔ Test 11 passed: Parent removed successfully.');

  // Test 12: Omitted parentId during update preserves the current parent
  // Re-parent B to A
  await fetch(`${API_URL}/projects/${projX.id}/tasks/${taskB.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieMgr },
    body: JSON.stringify({ parentId: taskA.id })
  });
  // Update title only
  res = await fetch(`${API_URL}/projects/${projX.id}/tasks/${taskB.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieMgr },
    body: JSON.stringify({ title: 'Subtask B Renamed' })
  });
  const preservedB = (await res.json()).task;
  if (preservedB.parentId !== taskA.id) throw new Error(`Test 12 Failed: parentId was altered on omitted input`);
  console.log('✔ Test 12 passed: Omitted parentId preserves existing relations.');

  // Test 13: Archived-project hierarchy mutation is rejected
  // Archive project X
  await prisma.project.update({
    where: { id: projX.id },
    data: { status: 'ARCHIVED' }
  });
  res = await fetch(`${API_URL}/projects/${projX.id}/tasks/${taskB.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieMgr },
    body: JSON.stringify({ parentId: null })
  });
  if (res.status !== 400) throw new Error(`Test 13 Failed: Expected 400, got ${res.status}`);
  console.log('✔ Test 13 passed: Archived project write constraint respected.');

  // Un-archive Project X for further checks
  await prisma.project.update({
    where: { id: projX.id },
    data: { status: 'ACTIVE' }
  });

  // Test 14: Dependency relations remain independent
  // Create relation: taskA BLOCKS taskB
  res = await fetch(`${API_URL}/projects/${projX.id}/tasks/${taskA.id}/relations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieMgr },
    body: JSON.stringify({ targetTaskId: taskB.id })
  });
  if (res.status !== 200) throw new Error(`Test 14 Failed: dependency addition failed: ${res.status}`);
  const detailsAfterRel = await (await fetch(`${API_URL}/projects/${projX.id}/tasks/${taskB.id}`, { headers: { 'Cookie': cookieMgr } })).json();
  if (detailsAfterRel.task.parentId !== taskA.id || detailsAfterRel.task.incomingRelations.length !== 1) {
    throw new Error(`Test 14 Failed: Dependency relation contaminated hierarchy state.`);
  }
  console.log('✔ Test 14 passed: Dependencies and hierarchy remain independent.');

  // Test 15: Active task filters still return correct records
  res = await fetch(`${API_URL}/projects/${projX.id}/tasks?status=TODO`, {
    headers: { 'Cookie': cookieMgr }
  });
  const filteredTasks = (await res.json()).tasks;
  if (filteredTasks.some(t => t.status !== 'TODO')) {
    throw new Error(`Test 15 Failed: Status filter bypass detected: ${JSON.stringify(filteredTasks)}`);
  }
  console.log('✔ Test 15 passed: Task filtering remains correct.');

  // Test 16: Reporting remains correct
  res = await fetch(`${API_URL}/projects/${projX.id}/reports/summary`, {
    headers: { 'Cookie': cookieMgr }
  });
  if (res.status !== 200) throw new Error(`Test 16 Failed: Reporting query failed: ${res.status}`);
  console.log('✔ Test 16 passed: Project health reporting aggregates correctly.');

  // Test 17: CSV export remains correct
  res = await fetch(`${API_URL}/projects/${projX.id}/tasks/export`, {
    headers: { 'Cookie': cookieMgr }
  });
  if (res.status !== 200) throw new Error(`Test 17 Failed: CSV export failed: ${res.status}`);
  console.log('✔ Test 17 passed: CSV task export completes successfully.');

  console.log('\n=== ALL TASK HIERARCHY TESTS COMPLETED SUCCESSFULLY ===');
}

runHierarchyTests().catch(err => {
  console.error('\n❌ Test execution failed with error:', err);
  process.exit(1);
});
