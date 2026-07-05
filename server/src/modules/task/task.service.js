import prisma from '../../config/db.js';

// Status transition matrix
function validateStatusTransition(from, to) {
  if (from === to) return true;
  const allowed = {
    TODO: ['IN_PROGRESS'],
    IN_PROGRESS: ['TODO', 'BLOCKED', 'DONE'],
    BLOCKED: ['IN_PROGRESS', 'TODO'],
    DONE: ['IN_PROGRESS']
  };
  return allowed[from]?.includes(to) || false;
}

/**
 * Returns structured warnings if a task has unresolved prerequisites.
 */
export async function getTaskWarnings(taskId, client = prisma) {
  const incoming = await client.taskRelation.findMany({
    where: { targetTaskId: taskId },
    include: {
      sourceTask: {
        select: { id: true, title: true, status: true, priority: true }
      }
    }
  });

  const unfinished = incoming
    .filter((r) => r.sourceTask.status !== 'DONE')
    .map((r) => r.sourceTask);

  if (unfinished.length > 0) {
    return [
      {
        code: 'UNFINISHED_BLOCKERS',
        message: 'This task is blocked by unfinished tasks.',
        details: unfinished
      }
    ];
  }
  return [];
}

/**
 * BFS cycle checker: starting from target, walks outgoing relations. If it reaches source, cycle is detected.
 */
async function detectCycle(sourceId, targetId, tx) {
  const visited = new Set();
  const queue = [targetId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === sourceId) {
      return true; // Cycle!
    }

    if (!visited.has(current)) {
      visited.add(current);
      const outgoing = await tx.taskRelation.findMany({
        where: { sourceTaskId: current }
      });
      for (const rel of outgoing) {
        if (!visited.has(rel.targetTaskId)) {
          queue.push(rel.targetTaskId);
        }
      }
    }
  }
  return false;
}

/**
 * Creates a new Task and logs the event atomically in a transaction.
 */
export async function createTask(projectId, taskData, createdById) {
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    const error = new Error('Project not found.');
    error.statusCode = 404;
    throw error;
  }

  if (project.status === 'ARCHIVED') {
    const error = new Error('Cannot create tasks in an archived project.');
    error.statusCode = 400;
    throw error;
  }

  const creatorMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: createdById } }
  });

  if (!creatorMember) {
    const error = new Error('Access denied. You are not a member of this project.');
    error.statusCode = 403;
    throw error;
  }

  if (creatorMember.role === 'REVIEWER') {
    const error = new Error('Access denied. REVIEWER cannot create tasks.');
    error.statusCode = 403;
    throw error;
  }

  const { title, description, priority, status, assigneeId, dueDate } = taskData;

  let parsedAssigneeId = null;
  if (assigneeId !== undefined && assigneeId !== null) {
    parsedAssigneeId = parseInt(assigneeId, 10);
    
    const assigneeMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: parsedAssigneeId } }
    });

    if (!assigneeMember) {
      const error = new Error('Assignee must be a member of the same project.');
      error.statusCode = 400;
      throw error;
    }

    if (assigneeMember.role === 'REVIEWER') {
      const error = new Error('REVIEWER cannot be assigned execution tasks.');
      error.statusCode = 400;
      throw error;
    }

    if (creatorMember.role === 'MEMBER') {
      const error = new Error('Access denied. Only MANAGER can assign tasks.');
      error.statusCode = 403;
      throw error;
    }
  }

  const parsedDueDate = dueDate ? new Date(dueDate) : null;

  const task = await prisma.$transaction(async (tx) => {
    const createdTask = await tx.task.create({
      data: {
        projectId,
        title: title.trim(),
        description: description ? description.trim() : null,
        priority: priority || 'MEDIUM',
        status: status || 'TODO',
        assigneeId: parsedAssigneeId,
        dueDate: parsedDueDate,
        createdById
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    await tx.activityLog.create({
      data: {
        projectId,
        taskId: createdTask.id,
        actorId: createdById,
        eventType: 'TASK_CREATE',
        metadata: {
          taskId: createdTask.id,
          title: createdTask.title,
          status: createdTask.status,
          priority: createdTask.priority,
          assigneeId: createdTask.assigneeId,
          dueDate: createdTask.dueDate ? createdTask.dueDate.toISOString() : null
        }
      }
    });

    return createdTask;
  });

  const warnings = await getTaskWarnings(task.id);
  return { ...task, warnings };
}

/**
 * Lists tasks for a project with warnings mapped.
 */
export async function getTasksForProject(projectId, filters = {}) {
  const where = { projectId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.priority) {
    where.priority = filters.priority;
  }
  if (filters.assigneeId) {
    where.assigneeId = parseInt(filters.assigneeId, 10);
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignee: {
        select: { id: true, name: true, email: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return await Promise.all(
    tasks.map(async (t) => {
      const warnings = await getTaskWarnings(t.id);
      return { ...t, warnings };
    })
  );
}

/**
 * Gets a specific task detail, including relations and warnings.
 */
export async function getTaskById(projectId, taskId) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignee: {
        select: { id: true, name: true, email: true }
      },
      activityLogs: {
        include: {
          actor: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      },
      incomingRelations: {
        include: {
          sourceTask: {
            select: { id: true, title: true, status: true, priority: true }
          }
        }
      },
      outgoingRelations: {
        include: {
          targetTask: {
            select: { id: true, title: true, status: true, priority: true }
          }
        }
      }
    }
  });

  if (!task || task.projectId !== projectId) {
    const error = new Error('Task not found.');
    error.statusCode = 404;
    throw error;
  }

  const warnings = await getTaskWarnings(task.id);
  return { ...task, warnings };
}

/**
 * Updates task and writes split categories logs inside a single transaction.
 */
export async function updateTask(projectId, taskId, updateData, actorUserId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    const error = new Error('Project not found.');
    error.statusCode = 404;
    throw error;
  }

  if (project.status === 'ARCHIVED') {
    const error = new Error('Cannot update tasks in an archived project.');
    error.statusCode = 400;
    throw error;
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId }
  });

  if (!task || task.projectId !== projectId) {
    const error = new Error('Task not found.');
    error.statusCode = 404;
    throw error;
  }

  const actorMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: actorUserId } }
  });

  if (!actorMember) {
    const error = new Error('Access denied. You are not a member of this project.');
    error.statusCode = 403;
    throw error;
  }

  if (actorMember.role === 'REVIEWER') {
    const error = new Error('Access denied. REVIEWER cannot edit tasks.');
    error.statusCode = 403;
    throw error;
  }

  if (actorMember.role === 'MEMBER') {
    const hasMetadataUpdate = updateData.title !== undefined ||
      updateData.description !== undefined ||
      updateData.priority !== undefined ||
      updateData.dueDate !== undefined;

    if (hasMetadataUpdate) {
      if (task.createdById !== actorUserId && task.assigneeId !== actorUserId) {
        const error = new Error('Access denied. Members can only edit tasks they created or are assigned to.');
        error.statusCode = 403;
        throw error;
      }
    }

    if (updateData.status !== undefined && updateData.status !== task.status) {
      if (task.assigneeId !== actorUserId) {
        const error = new Error('Access denied. Members can only change status of tasks assigned to them.');
        error.statusCode = 403;
        throw error;
      }
    }

    if (updateData.assigneeId !== undefined && updateData.assigneeId !== task.assigneeId) {
      const error = new Error('Access denied. Only MANAGER can assign/reassign tasks.');
      error.statusCode = 403;
      throw error;
    }
  }

  if (updateData.status !== undefined && updateData.status !== task.status) {
    if (!validateStatusTransition(task.status, updateData.status)) {
      const error = new Error(`Invalid status transition from ${task.status} to ${updateData.status}.`);
      error.statusCode = 400;
      throw error;
    }
  }

  let parsedAssigneeId = undefined;
  if (updateData.assigneeId !== undefined) {
    if (updateData.assigneeId === null) {
      parsedAssigneeId = null;
    } else {
      parsedAssigneeId = parseInt(updateData.assigneeId, 10);
      
      const assigneeMember = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: parsedAssigneeId } }
      });

      if (!assigneeMember) {
        const error = new Error('Assignee must be a member of the same project.');
        error.statusCode = 400;
        throw error;
      }

      if (assigneeMember.role === 'REVIEWER') {
        const error = new Error('REVIEWER cannot be assigned execution tasks.');
        error.statusCode = 400;
        throw error;
      }
    }
  }

  const parsedDueDate = updateData.dueDate !== undefined ? (updateData.dueDate ? new Date(updateData.dueDate) : null) : undefined;

  const changes = {};
  if (updateData.title !== undefined && updateData.title.trim() !== task.title) {
    changes.title = { before: task.title, after: updateData.title.trim() };
  }
  if (updateData.description !== undefined && (updateData.description ? updateData.description.trim() : null) !== task.description) {
    changes.description = { before: task.description, after: updateData.description ? updateData.description.trim() : null };
  }
  if (updateData.priority !== undefined && updateData.priority !== task.priority) {
    changes.priority = { before: task.priority, after: updateData.priority };
  }
  if (parsedAssigneeId !== undefined && parsedAssigneeId !== task.assigneeId) {
    changes.assigneeId = { before: task.assigneeId, after: parsedAssigneeId };
  }
  if (updateData.status !== undefined && updateData.status !== task.status) {
    changes.status = { before: task.status, after: updateData.status };
  }
  if (parsedDueDate !== undefined && ((parsedDueDate ? parsedDueDate.getTime() : null) !== (task.dueDate ? task.dueDate.getTime() : null))) {
    changes.dueDate = { before: task.dueDate ? task.dueDate.toISOString() : null, after: parsedDueDate ? parsedDueDate.toISOString() : null };
  }

  if (Object.keys(changes).length === 0) {
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: { select: { id: true, name: true, email: true } } }
    });
    const warnings = await getTaskWarnings(existingTask.id);
    return { ...existingTask, warnings };
  }

  const updatedTask = await prisma.$transaction(async (tx) => {
    const t = await tx.task.update({
      where: { id: taskId },
      data: {
        title: updateData.title !== undefined ? updateData.title.trim() : undefined,
        description: updateData.description !== undefined ? (updateData.description ? updateData.description.trim() : null) : undefined,
        priority: updateData.priority || undefined,
        status: updateData.status || undefined,
        assigneeId: parsedAssigneeId !== undefined ? parsedAssigneeId : undefined,
        dueDate: parsedDueDate !== undefined ? parsedDueDate : undefined
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } }
      }
    });

    if (changes.title || changes.description || changes.priority) {
      const meta = {};
      if (changes.title) meta.title = changes.title;
      if (changes.description) meta.description = changes.description;
      if (changes.priority) meta.priority = changes.priority;

      await tx.activityLog.create({
        data: {
          projectId,
          taskId,
          actorId: actorUserId,
          eventType: 'TASK_UPDATE',
          metadata: meta
        }
      });
    }

    if (changes.assigneeId) {
      const oldUser = changes.assigneeId.before ? await tx.user.findUnique({ where: { id: changes.assigneeId.before } }) : null;
      const newUser = changes.assigneeId.after ? await tx.user.findUnique({ where: { id: changes.assigneeId.after } }) : null;

      await tx.activityLog.create({
        data: {
          projectId,
          taskId,
          actorId: actorUserId,
          eventType: 'TASK_ASSIGN',
          metadata: {
            before: oldUser ? { assigneeId: oldUser.id, email: oldUser.email } : null,
            after: newUser ? { assigneeId: newUser.id, email: newUser.email } : null
          }
        }
      });
    }

    if (changes.status) {
      await tx.activityLog.create({
        data: {
          projectId,
          taskId,
          actorId: actorUserId,
          eventType: 'TASK_STATUS_CHANGE',
          metadata: {
            before: changes.status.before,
            after: changes.status.after
          }
        }
      });
    }

    if (changes.dueDate) {
      await tx.activityLog.create({
        data: {
          projectId,
          taskId,
          actorId: actorUserId,
          eventType: 'TASK_DUE_DATE_CHANGE',
          metadata: {
            before: changes.dueDate.before,
            after: changes.dueDate.after
          }
        }
      });
    }

    return t;
  });

  const warnings = await getTaskWarnings(updatedTask.id);
  return { ...updatedTask, warnings };
}

/**
 * Creates a BLOCKS dependency relation: sourceTaskId BLOCKS targetTaskId.
 * Acquired transaction-level advisory locks prevent race conditions.
 */
export async function addDependency(projectId, sourceTaskId, targetTaskId, actorUserId) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    const error = new Error('Project not found.');
    error.statusCode = 404;
    throw error;
  }
  if (project.status === 'ARCHIVED') {
    const error = new Error('Cannot add dependency in an archived project.');
    error.statusCode = 400;
    throw error;
  }

  if (sourceTaskId === targetTaskId) {
    const error = new Error('A task cannot block itself.');
    error.statusCode = 400;
    throw error;
  }

  const targetTask = await prisma.task.findUnique({ where: { id: targetTaskId } });
  if (!targetTask || targetTask.projectId !== projectId) {
    const error = new Error('Target task not found.');
    error.statusCode = 404;
    throw error;
  }

  const sourceTask = await prisma.task.findUnique({ where: { id: sourceTaskId } });
  if (!sourceTask || sourceTask.projectId !== projectId) {
    const error = new Error('Source task not found.');
    error.statusCode = 404;
    throw error;
  }

  const actorMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: actorUserId } }
  });
  if (!actorMember) {
    const error = new Error('Access denied. You are not a member of this project.');
    error.statusCode = 403;
    throw error;
  }
  if (actorMember.role === 'REVIEWER') {
    const error = new Error('Access denied. REVIEWER cannot edit dependencies.');
    error.statusCode = 403;
    throw error;
  }
  if (actorMember.role === 'MEMBER') {
    if (targetTask.createdById !== actorUserId && targetTask.assigneeId !== actorUserId) {
      const error = new Error('Access denied. Members can only add dependencies if they can edit the target task.');
      error.statusCode = 403;
      throw error;
    }
  }

  return await prisma.$transaction(async (tx) => {
    // Acquire PostgreSQL transaction advisory lock scoped to dependency namespace and project
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1001, CAST(${projectId} AS integer))`;

    // Re-verify under locks
    const tTask = await tx.task.findUnique({ where: { id: targetTaskId } });
    const sTask = await tx.task.findUnique({ where: { id: sourceTaskId } });
    if (!tTask || tTask.projectId !== projectId || !sTask || sTask.projectId !== projectId) {
      const error = new Error('Tasks not found in this project.');
      error.statusCode = 404;
      throw error;
    }

    const existing = await tx.taskRelation.findFirst({
      where: { sourceTaskId, targetTaskId }
    });
    if (existing) {
      const error = new Error('This dependency relation already exists.');
      error.statusCode = 409;
      throw error;
    }

    const isCycle = await detectCycle(sourceTaskId, targetTaskId, tx);
    if (isCycle) {
      const error = new Error('Creating this relation would introduce a dependency cycle.');
      error.statusCode = 409;
      throw error;
    }

    const relation = await tx.taskRelation.create({
      data: {
        sourceTaskId,
        targetTaskId,
        type: 'BLOCKS'
      }
    });

    await tx.activityLog.create({
      data: {
        projectId,
        taskId: targetTaskId,
        actorId: actorUserId,
        eventType: 'TASK_DEPENDENCY_ADDED',
        metadata: {
          relationId: relation.id,
          sourceTaskId,
          sourceTaskTitle: sTask.title,
          targetTaskId,
          targetTaskTitle: tTask.title
        }
      }
    });

    const warnings = await getTaskWarnings(targetTaskId, tx);
    return { relation, warnings };
  });
}

/**
 * Removes a BLOCKS dependency relation.
 */
export async function removeDependency(projectId, targetTaskId, relationId, actorUserId) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    const error = new Error('Project not found.');
    error.statusCode = 404;
    throw error;
  }
  if (project.status === 'ARCHIVED') {
    const error = new Error('Cannot remove dependency in an archived project.');
    error.statusCode = 400;
    throw error;
  }

  const relation = await prisma.taskRelation.findUnique({
    where: { id: relationId },
    include: {
      sourceTask: true,
      targetTask: true
    }
  });

  if (!relation) {
    const error = new Error('Dependency relation not found.');
    error.statusCode = 404;
    throw error;
  }

  if (relation.sourceTask.projectId !== projectId || relation.targetTask.projectId !== projectId) {
    const error = new Error('Relation mismatch for this project.');
    error.statusCode = 404;
    throw error;
  }

  const actorMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: actorUserId } }
  });
  if (!actorMember) {
    const error = new Error('Access denied. You are not a member of this project.');
    error.statusCode = 403;
    throw error;
  }
  if (actorMember.role === 'REVIEWER') {
    const error = new Error('Access denied. REVIEWER cannot edit dependencies.');
    error.statusCode = 403;
    throw error;
  }
  if (actorMember.role === 'MEMBER') {
    if (relation.targetTask.createdById !== actorUserId && relation.targetTask.assigneeId !== actorUserId) {
      const error = new Error('Access denied. Members can only remove dependencies if they can edit the target task.');
      error.statusCode = 403;
      throw error;
    }
  }

  return await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1001, CAST(${projectId} AS integer))`;

    await tx.taskRelation.delete({
      where: { id: relationId }
    });

    await tx.activityLog.create({
      data: {
        projectId,
        taskId: relation.targetTaskId,
        actorId: actorUserId,
        eventType: 'TASK_DEPENDENCY_REMOVED',
        metadata: {
          relationId: relation.id,
          sourceTaskId: relation.sourceTaskId,
          sourceTaskTitle: relation.sourceTask.title,
          targetTaskId: relation.targetTaskId,
          targetTaskTitle: relation.targetTask.title
        }
      }
    });

    const warnings = await getTaskWarnings(relation.targetTaskId, tx);
    return { success: true, warnings };
  });
}
