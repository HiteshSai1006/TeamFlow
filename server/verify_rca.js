import prisma from 'file:///d:/Projects/New%20folder/server/src/config/db.js';

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

async function runRcaTests() {
  console.log('=== STARTING EXPLICIT STAGE 12 VERIFICATION SUITE ===\n');

  // Clear any existing test users and projects to prevent FK collisions
  const testEmails = [
    'rca_manager@test.com',
    'rca_member1@test.com',
    'rca_member2@test.com',
    'rca_rev1@test.com',
    'rca_rev2@test.com',
    'rca_outsider@test.com'
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

    await prisma.projectMember.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  // Authenticate users
  const managerCookie = await registerOrLogin('rca_manager@test.com', 'RCA Manager', 'securepassword123');
  const member1Cookie = await registerOrLogin('rca_member1@test.com', 'RCA Member 1', 'securepassword123');
  const member2Cookie = await registerOrLogin('rca_member2@test.com', 'RCA Member 2', 'securepassword123');
  const reviewer1Cookie = await registerOrLogin('rca_rev1@test.com', 'Reviewer One', 'securepassword123');
  const reviewer2Cookie = await registerOrLogin('rca_rev2@test.com', 'Reviewer Two', 'securepassword123');
  const outsiderCookie = await registerOrLogin('rca_outsider@test.com', 'RCA Outsider', 'securepassword123');

  // Extract User IDs
  const getMe = async (cookie) => {
    const res = await fetch(`${API_URL}/auth/me`, { headers: { 'Cookie': cookie } });
    const data = await res.json();
    return data.user;
  };
  const managerUser = await getMe(managerCookie);
  const member1User = await getMe(member1Cookie);
  const member2User = await getMe(member2Cookie);
  const rev1User = await getMe(reviewer1Cookie);
  const rev2User = await getMe(reviewer2Cookie);
  const outsiderUser = await getMe(outsiderCookie);

  // 1. Create a Project and configure Roles
  const projRes = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': managerCookie },
    body: JSON.stringify({ name: 'RCA main project' })
  });
  const project = (await projRes.json()).project;
  const projectId = project.id;

  const invite = async (email, role) => {
    await fetch(`${API_URL}/projects/${projectId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': managerCookie },
      body: JSON.stringify({ email, role })
    });
  };
  await invite('rca_member1@test.com', 'MEMBER');
  await invite('rca_member2@test.com', 'MEMBER');
  await invite('rca_rev1@test.com', 'REVIEWER');
  await invite('rca_rev2@test.com', 'REVIEWER');

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

  // Create an RCA
  const rcaRes = await fetch(`${API_URL}/projects/${projectId}/rcas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': member1Cookie },
    body: JSON.stringify({ title: 'System Outage RCA', severity: 'HIGH' })
  });
  const rca = (await rcaRes.json()).rca;
  await populateSections(rca.id, member1Cookie);

  // Submit it first to get active review IDs
  let submitRes = await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': member1Cookie },
    body: JSON.stringify({ reviewerIds: [rev1User.id, rev2User.id] })
  });
  const rcaSubmitted = (await submitRes.json()).rca;
  const reviewId = rcaSubmitted.reviews[0].id;

  // Reopen it to DRAFT for metadata / section editing testing
  await fetch(`${API_URL}/reviews/${rcaSubmitted.reviews[0].id}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': reviewer1Cookie },
    body: JSON.stringify({ decision: 'REJECTED', comment: 'Rejected' })
  });
  await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}/reopen`, {
    method: 'POST',
    headers: { 'Cookie': member1Cookie }
  });

  // --- ARCHIVED PROJECT MUTATIONS BLOCKS ---
  console.log('--- ARCHIVED PROJECT MUTATIONS ---');
  // Archive project
  await fetch(`${API_URL}/projects/${projectId}/archive`, {
    method: 'POST',
    headers: { 'Cookie': managerCookie }
  });

  // metadata edit
  let res = await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': member1Cookie },
    body: JSON.stringify({ title: 'Archived Edit' })
  });
  console.log('  metadata edit on archived status:', res.status, '(Expected: 400)');

  // section edit
  res = await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}/sections/TIMELINE`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': member1Cookie },
    body: JSON.stringify({ content: 'Archived content' })
  });
  console.log('  section edit on archived status:', res.status, '(Expected: 400)');

  // submit
  res = await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': member1Cookie },
    body: JSON.stringify({ reviewerIds: [rev1User.id] })
  });
  console.log('  submit on archived status:', res.status, '(Expected: 400)');

  // review decision
  res = await fetch(`${API_URL}/reviews/${reviewId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': reviewer1Cookie },
    body: JSON.stringify({ decision: 'APPROVED', comment: 'Looks good' })
  });
  console.log('  review decision on archived status:', res.status, '(Expected: 400)');

  // reopen
  res = await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}/reopen`, {
    method: 'POST',
    headers: { 'Cookie': member1Cookie }
  });
  console.log('  reopen on archived status:', res.status, '(Expected: 400)');

  // close
  res = await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}/close`, {
    method: 'POST',
    headers: { 'Cookie': managerCookie }
  });
  console.log('  close on archived status:', res.status, '(Expected: 400)');

  // Restore Project
  await fetch(`${API_URL}/projects/${projectId}/restore`, {
    method: 'POST',
    headers: { 'Cookie': managerCookie }
  });

  // --- OWNERSHIP / ROLE CHECKS ---
  console.log('\n--- OWNERSHIP / ROLE CHECKS ---');
  
  // MEMBER cannot submit another user\'s RCA
  res = await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': member2Cookie },
    body: JSON.stringify({ reviewerIds: [rev1User.id] })
  });
  console.log('  MEMBER cannot submit another user\'s RCA status:', res.status, '(Expected: 403)');

  // MEMBER cannot reopen another user\'s RCA (Must first reject and make it REJECTED)
  // Submit by owner (member 1)
  await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': member1Cookie },
    body: JSON.stringify({ reviewerIds: [rev1User.id] })
  });
  // Get new round review ID
  const rcaSubmitted2 = await (await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}`, { headers: { 'Cookie': member1Cookie } })).json();
  const reviewId2 = rcaSubmitted2.rca.reviews.filter(r => r.round === 2)[0].id;
  // Reject
  await fetch(`${API_URL}/reviews/${reviewId2}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': reviewer1Cookie },
    body: JSON.stringify({ decision: 'REJECTED', comment: 'Rejected round 3' })
  });
  // MEMBER2 tries to reopen MEMBER1's RCA
  res = await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}/reopen`, {
    method: 'POST',
    headers: { 'Cookie': member2Cookie }
  });
  console.log('  MEMBER cannot reopen another user\'s RCA status:', res.status, '(Expected: 403)');

  // MANAGER can submit another user\'s RCA
  // Reopen it first by manager
  await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}/reopen`, {
    method: 'POST',
    headers: { 'Cookie': managerCookie }
  });
  res = await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': managerCookie },
    body: JSON.stringify({ reviewerIds: [rev1User.id] })
  });
  console.log('  MANAGER can submit another user\'s RCA status:', res.status, '(Expected: 200)');

  // Get round 4 review ID
  const rcaSubmitted3 = await (await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}`, { headers: { 'Cookie': member1Cookie } })).json();
  const reviewId3 = rcaSubmitted3.rca.reviews.filter(r => r.round === 3)[0].id;
  // Reject
  await fetch(`${API_URL}/reviews/${reviewId3}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': reviewer1Cookie },
    body: JSON.stringify({ decision: 'REJECTED', comment: 'Rejected round 4' })
  });

  // MANAGER can reopen another user\'s RCA
  res = await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}/reopen`, {
    method: 'POST',
    headers: { 'Cookie': managerCookie }
  });
  console.log('  MANAGER can reopen another user\'s RCA status:', res.status, '(Expected: 200)');

  // REVIEWER cannot reopen an RCA
  // Submit and Reject again to put in REJECTED
  await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': member1Cookie },
    body: JSON.stringify({ reviewerIds: [rev1User.id] })
  });
  const rcaSubmitted4 = await (await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}`, { headers: { 'Cookie': member1Cookie } })).json();
  const reviewId4 = rcaSubmitted4.rca.reviews.filter(r => r.round === 4)[0].id;
  await fetch(`${API_URL}/reviews/${reviewId4}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': reviewer1Cookie },
    body: JSON.stringify({ decision: 'REJECTED', comment: 'Rejected round 5' })
  });

  res = await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}/reopen`, {
    method: 'POST',
    headers: { 'Cookie': reviewer1Cookie }
  });
  console.log('  REVIEWER cannot reopen an RCA status:', res.status, '(Expected: 403)');

  // REVIEWER cannot close an RCA
  // Submit and Approve to put in APPROVED
  await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}/reopen`, {
    method: 'POST',
    headers: { 'Cookie': managerCookie }
  });
  await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': member1Cookie },
    body: JSON.stringify({ reviewerIds: [rev1User.id] })
  });
  const rcaSubmitted5 = await (await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}`, { headers: { 'Cookie': member1Cookie } })).json();
  const reviewId5 = rcaSubmitted5.rca.reviews.filter(r => r.round === 5)[0].id;
  await fetch(`${API_URL}/reviews/${reviewId5}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': reviewer1Cookie },
    body: JSON.stringify({ decision: 'APPROVED', comment: 'Approved round 6' })
  });

  res = await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}/close`, {
    method: 'POST',
    headers: { 'Cookie': reviewer1Cookie }
  });
  console.log('  REVIEWER cannot close an RCA status:', res.status, '(Expected: 403)');

  // --- WORKFLOW CHECKS ---
  console.log('\n--- WORKFLOW CHECKS ---');

  // submit outside DRAFT returns 400 (rca is currently APPROVED)
  res = await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': member1Cookie },
    body: JSON.stringify({ reviewerIds: [rev1User.id] })
  });
  console.log('  submit outside DRAFT status:', res.status, '(Expected: 400)');

  // Reopen to REJECTED/DRAFT for review decision tests
  // Close it first to make it CLOSED
  await fetch(`${API_URL}/projects/${projectId}/rcas/${rca.id}/close`, {
    method: 'POST',
    headers: { 'Cookie': managerCookie }
  });
  // Reopen CLOSED is not allowed directly, let's create a new RCA and submit to UNDER_REVIEW
  const rcaWorkflowRes = await fetch(`${API_URL}/projects/${projectId}/rcas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': member1Cookie },
    body: JSON.stringify({ title: 'Workflow Verification RCA', severity: 'MEDIUM' })
  });
  const rcaWorkflow = (await rcaWorkflowRes.json()).rca;
  await populateSections(rcaWorkflow.id, member1Cookie);
  const submitWorkflowRes = await fetch(`${API_URL}/projects/${projectId}/rcas/${rcaWorkflow.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': member1Cookie },
    body: JSON.stringify({ reviewerIds: [rev1User.id] })
  });
  const rcaWorkflowSubmitted = (await submitWorkflowRes.json()).rca;
  const workflowReviewId = rcaWorkflowSubmitted.reviews[0].id;

  // unassigned REVIEWER cannot decide a review
  res = await fetch(`${API_URL}/reviews/${workflowReviewId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': reviewer2Cookie },
    body: JSON.stringify({ decision: 'APPROVED', comment: 'Unassigned vote attempt.' })
  });
  console.log('  unassigned REVIEWER cannot decide status:', res.status, '(Expected: 403)');

  // MANAGER cannot decide another user\'s assigned review
  res = await fetch(`${API_URL}/reviews/${workflowReviewId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': managerCookie },
    body: JSON.stringify({ decision: 'APPROVED', comment: 'Manager decide attempt.' })
  });
  console.log('  MANAGER cannot decide status:', res.status, '(Expected: 403)');

  // MEMBER cannot decide another user\'s assigned review
  res = await fetch(`${API_URL}/reviews/${workflowReviewId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': member2Cookie },
    body: JSON.stringify({ decision: 'APPROVED', comment: 'Member decide attempt.' })
  });
  console.log('  MEMBER cannot decide status:', res.status, '(Expected: 403)');

  console.log('\n=== ALL EXPLICIT VERIFICATION CHECKS SUCCESSFULLY COMPLETED ===');
}

runRcaTests().catch(console.error);
