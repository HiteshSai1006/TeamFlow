import prisma from '../../config/db.js';

/**
 * Calculates standard UTC calendar week boundaries for the past 6 weeks ending with the current Sunday.
 */
export function getWeeklyUTCBuckets(referenceDate = new Date()) {
  const sundayEnd = new Date(Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
    23, 59, 59, 999
  ));
  const day = referenceDate.getUTCDay();
  if (day > 0) {
    sundayEnd.setUTCDate(sundayEnd.getUTCDate() + (7 - day));
  }

  const buckets = [];
  for (let i = 5; i >= 0; i--) {
    const wEnd = new Date(sundayEnd.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const wStart = new Date(wEnd.getTime() - 7 * 24 * 60 * 60 * 1000 + 1);
    buckets.push({
      start: wStart,
      end: wEnd,
      label: `Week ${6 - i} (${formatDate(wStart)} - ${formatDate(wEnd)})`
    });
  }
  return buckets;
}

function formatDate(date) {
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${m}/${d}`;
}

export async function getSummaryReport(projectId, referenceDate = new Date()) {
  // 1. Calculate the UTC boundaries for 6 weeks
  const buckets = getWeeklyUTCBuckets(referenceDate);
  const sixWeeksAgoStart = buckets[0].start;

  // 2. Fetch everything concurrently via Promise.all
  const [
    tasks,
    overdueTasks,
    members,
    unassignedTasks,
    rcas,
    activityLogs,
    rcaLogs
  ] = await Promise.all([
    // All tasks in project
    prisma.task.findMany({
      where: { projectId },
      select: { id: true, status: true, priority: true }
    }),
    // Overdue unfinished tasks
    prisma.task.findMany({
      where: {
        projectId,
        status: { not: 'DONE' },
        dueDate: { lt: referenceDate }
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        assignee: { select: { id: true, name: true } }
      },
      orderBy: { dueDate: 'asc' }
    }),
    // Project members with task references
    prisma.projectMember.findMany({
      where: { projectId },
      select: {
        role: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            assignedTasks: {
              where: { projectId },
              select: { status: true }
            }
          }
        }
      }
    }),
    // Unassigned tasks in project
    prisma.task.findMany({
      where: { projectId, assigneeId: null },
      select: { status: true }
    }),
    // RCAs in project
    prisma.rCA.findMany({
      where: { projectId },
      select: { id: true, status: true, severity: true }
    }),
    // ActivityLogs for velocity calculations
    prisma.activityLog.findMany({
      where: {
        projectId,
        createdAt: { gte: sixWeeksAgoStart, lte: buckets[5].end },
        eventType: { in: ['TASK_STATUS_CHANGE', 'TASK_CREATE'] }
      },
      select: { eventType: true, metadata: true, createdAt: true }
    }),
    // RCAs in range
    prisma.rCA.findMany({
      where: {
        projectId,
        createdAt: { gte: sixWeeksAgoStart, lte: buckets[5].end }
      },
      select: { createdAt: true }
    })
  ]);

  // 3. Completion Rate Calculations
  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter(t => t.status === 'DONE').length;
  const completionRate = totalTasksCount === 0 ? 0 : parseFloat(((completedTasksCount / totalTasksCount) * 100).toFixed(1));

  // 4. Task Status Distributions
  const statusCounts = { TODO: 0, IN_PROGRESS: 0, BLOCKED: 0, DONE: 0 };
  tasks.forEach(t => {
    if (statusCounts[t.status] !== undefined) {
      statusCounts[t.status]++;
    }
  });

  // 5. Task Priority Distributions
  const priorityCounts = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  tasks.forEach(t => {
    if (priorityCounts[t.priority] !== undefined) {
      priorityCounts[t.priority]++;
    }
  });

  // 6. Workload calculations
  const workload = members.map(m => {
    const assigned = m.user.assignedTasks;
    return {
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      totalAssigned: assigned.length,
      activeTasks: assigned.filter(t => t.status !== 'DONE').length,
      completedTasks: assigned.filter(t => t.status === 'DONE').length
    };
  });

  // Add explicit Unassigned row
  workload.push({
    userId: null,
    name: 'Unassigned',
    email: null,
    role: null,
    totalAssigned: unassignedTasks.length,
    activeTasks: unassignedTasks.filter(t => t.status !== 'DONE').length,
    completedTasks: unassignedTasks.filter(t => t.status === 'DONE').length
  });

  // 7. Weekly Velocity calculations (tasks completed per week)
  const velocityTrend = buckets.map(b => {
    let completedCount = 0;
    activityLogs.forEach(log => {
      if (log.createdAt >= b.start && log.createdAt <= b.end) {
        if (log.eventType === 'TASK_STATUS_CHANGE' && log.metadata?.after === 'DONE') {
          completedCount++;
        } else if (log.eventType === 'TASK_CREATE' && log.metadata?.status === 'DONE') {
          completedCount++;
        }
      }
    });
    return {
      label: b.label,
      completedTasks: completedCount
    };
  });

  // 8. RCA Volume Trend calculations (RCAs created per week)
  const rcaVolumeTrend = buckets.map(b => {
    let createdCount = 0;
    rcaLogs.forEach(r => {
      if (r.createdAt >= b.start && r.createdAt <= b.end) {
        createdCount++;
      }
    });
    return {
      label: b.label,
      createdRcas: createdCount
    };
  });

  // 9. RCA distributions
  const rcaStatusCounts = { DRAFT: 0, UNDER_REVIEW: 0, APPROVED: 0, REJECTED: 0, CLOSED: 0 };
  rcas.forEach(r => {
    if (rcaStatusCounts[r.status] !== undefined) {
      rcaStatusCounts[r.status]++;
    }
  });

  const rcaSeverityCounts = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  rcas.forEach(r => {
    if (rcaSeverityCounts[r.severity] !== undefined) {
      rcaSeverityCounts[r.severity]++;
    }
  });

  // 10. Project Health calculations
  const healthFactors = [];
  
  // Overdue unfinished tasks
  const overdueCount = overdueTasks.length;
  const overduePenalty = Math.min(30, overdueCount * 5);
  if (overdueCount > 0) {
    healthFactors.push(`${overdueCount} overdue unfinished task(s) (-${overduePenalty} points)`);
  }

  // Blocked tasks
  const blockedCount = statusCounts.BLOCKED;
  const blockedPenalty = Math.min(30, blockedCount * 10);
  if (blockedCount > 0) {
    healthFactors.push(`${blockedCount} blocked task(s) (-${blockedPenalty} points)`);
  }

  // HIGH/CRITICAL unfinished tasks
  const highCriticalUnfinished = tasks.filter(t => t.status !== 'DONE' && (t.priority === 'HIGH' || t.priority === 'CRITICAL')).length;
  const priorityPenalty = Math.min(20, highCriticalUnfinished * 5);
  if (highCriticalUnfinished > 0) {
    healthFactors.push(`${highCriticalUnfinished} High/Critical priority unfinished task(s) (-${priorityPenalty} points)`);
  }

  // Unresolved RCAs (DRAFT, UNDER_REVIEW, REJECTED)
  const unresolvedRcas = rcas.filter(r => ['DRAFT', 'UNDER_REVIEW', 'REJECTED'].includes(r.status)).length;
  const rcaPenalty = Math.min(20, unresolvedRcas * 10);
  if (unresolvedRcas > 0) {
    healthFactors.push(`${unresolvedRcas} unresolved RCA(s) (-${rcaPenalty} points)`);
  }

  const score = Math.max(0, 100 - overduePenalty - blockedPenalty - priorityPenalty - rcaPenalty);
  let label = 'HEALTHY';
  if (score < 50) {
    label = 'CRITICAL';
  } else if (score < 80) {
    label = 'AT_RISK';
  }

  return {
    projectId,
    generatedAt: referenceDate.toISOString(),
    completion: {
      totalTasks: totalTasksCount,
      completedTasks: completedTasksCount,
      completionRate
    },
    taskStatus: statusCounts,
    taskPriority: priorityCounts,
    overdue: {
      count: overdueCount,
      tasks: overdueTasks
    },
    workload,
    velocity: velocityTrend,
    rcaVolume: {
      total: rcas.length,
      last6Weeks: rcaLogs.length,
      trend: rcaVolumeTrend
    },
    rcaStatus: rcaStatusCounts,
    rcaSeverity: rcaSeverityCounts,
    projectHealth: {
      score,
      label,
      factors: healthFactors
    }
  };
}
