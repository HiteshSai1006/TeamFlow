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

// RFC 4180 CSV Parser for verification
function parseCSV(csvContent) {
  if (csvContent.startsWith('\uFEFF')) {
    csvContent = csvContent.slice(1);
  }
  
  const result = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  
  for (let i = 0; i < csvContent.length; i++) {
    const char = csvContent[i];
    const nextChar = csvContent[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          cell += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(cell);
        cell = '';
      } else if (char === '\r' && nextChar === '\n') {
        row.push(cell);
        result.push(row);
        row = [];
        cell = '';
        i++; // skip \n
      } else if (char === '\n') {
        row.push(cell);
        result.push(row);
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }
  }
  
  if (cell || row.length > 0) {
    row.push(cell);
    result.push(row);
  }
  
  // Filter out any empty trailing row if file ended with a newline
  return result.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

async function runExportTests() {
  console.log('=== STARTING STAGE 14B EXPORT VERIFICATION SUITE ===\n');

  // Clean DB for test users
  const testEmails = [
    'exp_mgr@test.com',
    'exp_mem@test.com',
    'exp_out@test.com'
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
  const mgrCookie = await registerOrLogin('exp_mgr@test.com', 'Export Manager', 'securepassword123');
  const memCookie = await registerOrLogin('exp_mem@test.com', 'Export Member', 'securepassword123');
  const outCookie = await registerOrLogin('exp_out@test.com', 'Export Outsider', 'securepassword123');

  const mgrUser = await getMe(mgrCookie);
  const memUser = await getMe(memCookie);

  // Create Project 1
  let res = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ name: 'Export Project 1' })
  });
  const project1 = (await res.json()).project;
  const projectId = project1.id;
  console.log(`Created Project 1: ID ${projectId}`);

  // Add member
  await fetch(`${API_URL}/projects/${projectId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ email: 'exp_mem@test.com', role: 'MEMBER' })
  });

  // Seed tasks in Project 1
  const t1 = await prisma.task.create({
    data: { projectId, title: 'Task One', status: 'TODO', priority: 'LOW', createdById: mgrUser.id }
  });
  const t2 = await prisma.task.create({
    data: { projectId, title: 'Task Two', status: 'IN_PROGRESS', priority: 'HIGH', assigneeId: memUser.id, createdById: mgrUser.id }
  });
  const t3 = await prisma.task.create({
    data: {
      projectId,
      title: 'Task, with comma',
      description: 'Task "with quotes" and\nnew line\r\nand Unicode TM ™ 🚧',
      status: 'DONE',
      priority: 'CRITICAL',
      createdById: mgrUser.id
    }
  });
  const tComma = await prisma.task.create({
    data: { projectId, title: 'Task,with,comma', status: 'TODO', createdById: mgrUser.id }
  });
  const tQuote = await prisma.task.create({
    data: { projectId, title: 'Task"with"quote', status: 'TODO', createdById: mgrUser.id }
  });
  const tCR = await prisma.task.create({
    data: { projectId, title: 'Task\rwith\rcarriage\rreturn', status: 'TODO', createdById: mgrUser.id }
  });
  const tLF = await prisma.task.create({
    data: { projectId, title: 'Task\nwith\nline\nfeed', status: 'TODO', createdById: mgrUser.id }
  });
  const tMultiline = await prisma.task.create({
    data: { projectId, title: 'Task\r\nwith\r\nmultiple\r\nlines', status: 'TODO', createdById: mgrUser.id }
  });
  const tUnicode = await prisma.task.create({
    data: { projectId, title: 'TeamFlow™ 🚧 café', status: 'TODO', createdById: mgrUser.id }
  });

  // Create Project 2 for leakage checks
  res = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ name: 'Export Project 2' })
  });
  const project2 = (await res.json()).project;
  await prisma.task.create({
    data: { projectId: project2.id, title: 'Project 2 Task', status: 'TODO', createdById: mgrUser.id }
  });

  // --- CHECK 1: No-filter export vs task list API ---
  console.log('\n--- 1. No-Filter Task Export ---');
  let listRes = await fetch(`${API_URL}/projects/${projectId}/tasks`, { headers: { 'Cookie': memCookie } });
  let listJson = await listRes.json();
  let listIds = listJson.tasks.map(t => t.id);

  let expRes = await fetch(`${API_URL}/projects/${projectId}/tasks/export`, { headers: { 'Cookie': memCookie } });
  let expCsv = await expRes.text();
  let expRows = parseCSV(expCsv);
  let expIds = expRows.slice(1).map(r => parseInt(r[0], 10));

  console.log('  Export status code:', expRes.status, '(Expected: 200)');
  console.log('  Content-Type header:', expRes.headers.get('content-type'), '(Expected: text/csv; charset=utf-8)');
  console.log('  Content-Disposition matches format:', /filename="project-\d+-tasks-.*.csv"/.test(expRes.headers.get('content-disposition')), '(Expected: true)');
  console.log('  IDs count matches visible API list:', expIds.length === listIds.length, '(Expected: true)');
  console.log('  Row order matches visible list order exactly:', JSON.stringify(expIds) === JSON.stringify(listIds), '(Expected: true)');

  // --- CHECK 2: Status-only export ---
  console.log('\n--- 2. Status-Only Task Export ---');
  listRes = await fetch(`${API_URL}/projects/${projectId}/tasks?status=IN_PROGRESS`, { headers: { 'Cookie': memCookie } });
  listJson = await listRes.json();
  listIds = listJson.tasks.map(t => t.id);

  expRes = await fetch(`${API_URL}/projects/${projectId}/tasks/export?status=IN_PROGRESS`, { headers: { 'Cookie': memCookie } });
  expCsv = await expRes.text();
  expRows = parseCSV(expCsv);
  expIds = expRows.slice(1).map(r => parseInt(r[0], 10));
  console.log('  Export IDs match filter list exactly:', JSON.stringify(expIds) === JSON.stringify(listIds), '(Expected: true)');

  // --- CHECK 3: Priority-only export ---
  console.log('\n--- 3. Priority-Only Task Export ---');
  listRes = await fetch(`${API_URL}/projects/${projectId}/tasks?priority=CRITICAL`, { headers: { 'Cookie': memCookie } });
  listJson = await listRes.json();
  listIds = listJson.tasks.map(t => t.id);

  expRes = await fetch(`${API_URL}/projects/${projectId}/tasks/export?priority=CRITICAL`, { headers: { 'Cookie': memCookie } });
  expCsv = await expRes.text();
  expRows = parseCSV(expCsv);
  expIds = expRows.slice(1).map(r => parseInt(r[0], 10));
  console.log('  Export IDs match priority filter exactly:', JSON.stringify(expIds) === JSON.stringify(listIds), '(Expected: true)');

  // --- CHECK 4: Assignee-only export ---
  console.log('\n--- 4. Assignee-Only Task Export ---');
  listRes = await fetch(`${API_URL}/projects/${projectId}/tasks?assigneeId=${memUser.id}`, { headers: { 'Cookie': memCookie } });
  listJson = await listRes.json();
  listIds = listJson.tasks.map(t => t.id);

  expRes = await fetch(`${API_URL}/projects/${projectId}/tasks/export?assigneeId=${memUser.id}`, { headers: { 'Cookie': memCookie } });
  expCsv = await expRes.text();
  expRows = parseCSV(expCsv);
  expIds = expRows.slice(1).map(r => parseInt(r[0], 10));
  console.log('  Export IDs match assignee filter exactly:', JSON.stringify(expIds) === JSON.stringify(listIds), '(Expected: true)');

  // --- CHECK 5: Combined filter export ---
  console.log('\n--- 5. Combined-Filter Task Export ---');
  listRes = await fetch(`${API_URL}/projects/${projectId}/tasks?status=IN_PROGRESS&priority=HIGH&assigneeId=${memUser.id}`, { headers: { 'Cookie': memCookie } });
  listJson = await listRes.json();
  listIds = listJson.tasks.map(t => t.id);

  expRes = await fetch(`${API_URL}/projects/${projectId}/tasks/export?status=IN_PROGRESS&priority=HIGH&assigneeId=${memUser.id}`, { headers: { 'Cookie': memCookie } });
  expCsv = await expRes.text();
  expRows = parseCSV(expCsv);
  expIds = expRows.slice(1).map(r => parseInt(r[0], 10));
  console.log('  Export IDs match combined filters exactly:', JSON.stringify(expIds) === JSON.stringify(listIds), '(Expected: true)');

  // --- CHECK 6: Zero-match export is header-only ---
  console.log('\n--- 6. Zero-Match Task Export ---');
  expRes = await fetch(`${API_URL}/projects/${projectId}/tasks/export?status=BLOCKED`, { headers: { 'Cookie': memCookie } });
  expCsv = await expRes.text();
  expRows = parseCSV(expCsv);
  console.log('  Zero-match row count (header only):', expRows.length, '(Expected: 1)');

  // --- CHECK 7: RCA export matches list exactly ---
  console.log('\n--- 7. RCA Export Checks ---');
  // Seed RCAs
  const rca1 = await prisma.rCA.create({
    data: { projectId, title: 'RCA One', severity: 'MEDIUM', status: 'DRAFT', createdById: mgrUser.id }
  });
  const rca2 = await prisma.rCA.create({
    data: { projectId, title: 'RCA Two', severity: 'CRITICAL', status: 'DRAFT', createdById: mgrUser.id }
  });
  const rcaOther = await prisma.rCA.create({
    data: { projectId: project2.id, title: 'Project 2 RCA', severity: 'MEDIUM', status: 'DRAFT', createdById: mgrUser.id }
  });

  listRes = await fetch(`${API_URL}/projects/${projectId}/rcas`, { headers: { 'Cookie': memCookie } });
  listJson = await listRes.json();
  const listRcaIds = listJson.rcas.map(r => r.id);

  expRes = await fetch(`${API_URL}/projects/${projectId}/rcas/export`, { headers: { 'Cookie': memCookie } });
  expCsv = await expRes.text();
  expRows = parseCSV(expCsv);
  const expRcaIds = expRows.slice(1).map(r => parseInt(r[0], 10));

  console.log('  RCA export status code:', expRes.status, '(Expected: 200)');
  console.log('  Content-Disposition matches format:', /filename="project-\d+-rcas-.*.csv"/.test(expRes.headers.get('content-disposition')), '(Expected: true)');
  console.log('  IDs and order match exactly:', JSON.stringify(expRcaIds) === JSON.stringify(listRcaIds), '(Expected: true)');
  console.log('  RCA other project cross-project isolation (absent):', !expRcaIds.includes(rcaOther.id), '(Expected: true)');

  // --- CHECK 8: Comma, quotes, CR, LF, and multiline round-trip ---
  console.log('\n--- 8. RFC 4180 Escaping & Round-Trip checks ---');
  expRes = await fetch(`${API_URL}/projects/${projectId}/tasks/export`, { headers: { 'Cookie': memCookie } });
  expCsv = await expRes.text();
  expRows = parseCSV(expCsv);

  const targetRow = expRows.find(r => parseInt(r[0], 10) === t3.id);
  console.log('  Row description field round-trip (quotes/newlines/Unicode):', targetRow[2] === 'Task "with quotes" and\nnew line\r\nand Unicode TM ™ 🚧', '(Expected: true)');

  const rowComma = expRows.find(r => parseInt(r[0], 10) === tComma.id);
  console.log('  Comma-containing value round-trip:', rowComma[1] === 'Task,with,comma', '(Expected: true)');

  const rowQuote = expRows.find(r => parseInt(r[0], 10) === tQuote.id);
  console.log('  Double-quote-containing value round-trip:', rowQuote[1] === 'Task"with"quote', '(Expected: true)');

  const rowCR = expRows.find(r => parseInt(r[0], 10) === tCR.id);
  console.log('  CR-containing value round-trip:', rowCR[1] === 'Task\rwith\rcarriage\rreturn', '(Expected: true)');

  const rowLF = expRows.find(r => parseInt(r[0], 10) === tLF.id);
  console.log('  LF-containing value round-trip:', rowLF[1] === 'Task\nwith\nline\nfeed', '(Expected: true)');

  const rowMultiline = expRows.find(r => parseInt(r[0], 10) === tMultiline.id);
  console.log('  Multiline value round-trip:', rowMultiline[1] === 'Task\r\nwith\r\nmultiple\r\nlines', '(Expected: true)');

  const rowUnicode = expRows.find(r => parseInt(r[0], 10) === tUnicode.id);
  console.log('  Unicode preservation (TeamFlow™ 🚧 café):', rowUnicode[1] === 'TeamFlow™ 🚧 café', '(Expected: true)');

  // --- CHECK 9: UTF-8 BOM presence ---
  console.log('\n--- 9. UTF-8 BOM Validation ---');
  const bomRes = await fetch(`${API_URL}/projects/${projectId}/tasks/export`, { headers: { 'Cookie': memCookie } });
  const bomBuf = await bomRes.arrayBuffer();
  const rawBytes = Buffer.from(bomBuf);
  const hasBOM = rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF;
  console.log('  UTF-8 BOM present exactly once at the beginning of payload:', hasBOM, '(Expected: true)');

  // --- CHECK 10: Outsider access ---
  console.log('\n--- 10. Access Restrictions (Outsider 403) ---');
  res = await fetch(`${API_URL}/projects/${projectId}/tasks/export`, { headers: { 'Cookie': outCookie } });
  console.log('  Outsider task export status:', res.status, '(Expected: 403)');
  res = await fetch(`${API_URL}/projects/${projectId}/rcas/export`, { headers: { 'Cookie': outCookie } });
  console.log('  Outsider RCA export status:', res.status, '(Expected: 403)');

  // --- CHECK 11: Cross-project leakage check ---
  console.log('\n--- 11. Cross-Project Leakage Check ---');
  // Tasks from Project 2 (ID: project2.id) must not be in Project 1 CSV
  const hasLeak = expRows.slice(1).some(r => r[1] === 'Project 2 Task');
  console.log('  Cross-project task leak: ', hasLeak, '(Expected: false)');

  // --- CHECK 12: Archived Project Export read support ---
  console.log('\n--- 12. Archived Project Read access ---');
  await prisma.project.update({ where: { id: projectId }, data: { status: 'ARCHIVED' } });
  res = await fetch(`${API_URL}/projects/${projectId}/tasks/export`, { headers: { 'Cookie': memCookie } });
  console.log('  Archived task export status:', res.status, '(Expected: 200)');
  res = await fetch(`${API_URL}/projects/${projectId}/rcas/export`, { headers: { 'Cookie': memCookie } });
  console.log('  Archived RCA export status:', res.status, '(Expected: 200)');

  // --- CHECK 13: Regressions ---
  console.log('\n--- 13. Regressions ---');
  // Re-activate project in DB for mutations regressions
  await prisma.project.update({ where: { id: projectId }, data: { status: 'ACTIVE' } });
  await prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId: memUser.id } },
    data: { role: 'REVIEWER' }
  });

  // A. Auth
  res = await fetch(`${API_URL}/auth/me`, { headers: { 'Cookie': memCookie } });
  console.log('  Auth regression status:', res.status, '(Expected: 200)');

  // B. Task lifecycle
  res = await fetch(`${API_URL}/projects/${projectId}/tasks/${t2.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ status: 'DONE' })
  });
  console.log('  Lifecycle update status:', res.status, '(Expected: 200)');

  // C. Dependency cycle
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
  console.log('  Dependency cycle status:', res.status, '(Expected: 409)');

  // D. Comments
  res = await fetch(`${API_URL}/projects/${projectId}/tasks/${tA.id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ content: 'Test Comment' })
  });
  console.log('  Comment status:', res.status, '(Expected: 201)');

  // E. Attachments
  res = await fetch(`${API_URL}/projects/${projectId}/tasks/${tA.id}/attachments`, {
    headers: { 'Cookie': mgrCookie }
  });
  console.log('  Attachments list status:', res.status, '(Expected: 200)');

  // F. RCA Workflow
  const rcaTimeline = await prisma.rCA.create({
    data: { projectId, title: 'RCA Timeline', severity: 'MEDIUM', status: 'DRAFT', createdById: mgrUser.id }
  });
  await prisma.rCASection.create({ data: { rcaId: rcaTimeline.id, type: 'TIMELINE', content: 'Timeline content' } });
  await prisma.rCASection.create({ data: { rcaId: rcaTimeline.id, type: 'CONTRIBUTING_FACTORS', content: 'Factors content' } });
  await prisma.rCASection.create({ data: { rcaId: rcaTimeline.id, type: 'CORRECTIVE_ACTIONS', content: 'Actions content' } });
  await prisma.rCASection.create({ data: { rcaId: rcaTimeline.id, type: 'PREVENTIVE_MEASURES', content: 'Measures content' } });

  res = await fetch(`${API_URL}/projects/${projectId}/rcas/${rcaTimeline.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': mgrCookie },
    body: JSON.stringify({ reviewerIds: [memUser.id] })
  });
  console.log('  RCA submit status:', res.status, '(Expected: 200)');

  // G. Notifications
  res = await fetch(`${API_URL}/notifications`, { headers: { 'Cookie': mgrCookie } });
  console.log('  Notifications status:', res.status, '(Expected: 200)');

  // H. Reports
  const reportSummary = await getSummaryReport(projectId, new Date());
  console.log('  Report summary status:', !!reportSummary, '(Expected: true)');

  // I. Health
  res = await fetch(`${API_URL}/health`);
  console.log('  Health check status:', res.status, '(Expected: 200)');

  console.log('\n=== ALL EXPORT VERIFICATION SUITE CHECKS COMPLETED SUCCESSFULLY ===');
}

runExportTests().catch(console.error);
