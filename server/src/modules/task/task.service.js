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
 * Creates a new Task and logs the event atomically in a transaction.
 */
export async function createTask(projectId, taskData, createdById) {
  // Fetch project status
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

  // Fetch creator role
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

  // Assignee validations
  let parsedAssigneeId = null;
  if (assigneeId !== undefined && assigneeId !== null) {
    parsedAssigneeId = parseInt(assigneeId, 10);
    
    // Member check
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

    // Role-based creation constraint: MEMBERS cannot assign tasks
    if (creatorMember.role === 'MEMBER') {
      const error = new Error('Access denied. Only MANAGER can assign tasks.');
      error.statusCode = 403;
      throw error;
    }
  }

  const parsedDueDate = dueDate ? new Date(dueDate) : null;

  // Execute transaction
  return await prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
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

    // Create creation log with full context
    await tx.activityLog.create({
      data: {
        projectId,
        taskId: task.id,
        actorId: createdById,
        eventType: 'TASK_CREATE',
        metadata: {
          taskId: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          assigneeId: task.assigneeId,
          dueDate: task.dueDate ? task.dueDate.toISOString() : null
        }
      }
    });

    return task;
  });
}

/**
 * Lists tasks for a project with optional filters.
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

  return await prisma.task.findMany({
    where,
    include: {
      assignee: {
        select: { id: true, name: true, email: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Gets a specific task detail.
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
      }
    }
  });

  if (!task || task.projectId !== projectId) {
    const error = new Error('Task not found.');
    error.statusCode = 404;
    throw error;
  }

  return task;
}

/**
 * Updates task and writes split categories logs inside a single transaction.
 */
export async function updateTask(projectId, taskId, updateData, actorUserId) {
  // Fetch project status
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

  // Fetch task
  const task = await prisma.task.findUnique({
    where: { id: taskId }
  });

  if (!task || task.projectId !== projectId) {
    const error = new Error('Task not found.');
    error.statusCode = 404;
    throw error;
  }

  // Fetch actor role
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

  // Enforce MEMBER limits
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

  // Status transition check
  if (updateData.status !== undefined && updateData.status !== task.status) {
    if (!validateStatusTransition(task.status, updateData.status)) {
      const error = new Error(`Invalid status transition from ${task.status} to ${updateData.status}.`);
      error.statusCode = 400;
      throw error;
    }
  }

  // Assignee validation
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

  // Determine what has changed to prevent no-op logs
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

  // If there are zero changes, return the task immediately (no-op)
  if (Object.keys(changes).length === 0) {
    return await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: { select: { id: true, name: true, email: true } } }
    });
  }

  // Execute database transaction
  return await prisma.$transaction(async (tx) => {
    // Apply task update
    const updatedTask = await tx.task.update({
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

    // Create logs for each category changed
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

    return updatedTask;
  });
}
