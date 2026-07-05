import prisma from '../../config/db.js';

const MAX_COMMENT_LENGTH = 5000;

/**
 * Creates a comment on a task.
 */
export async function createComment(projectId, taskId, content, authorId) {
  if (!content || !content.trim()) {
    const error = new Error('Comment content cannot be empty.');
    error.statusCode = 400;
    throw error;
  }

  if (content.length > MAX_COMMENT_LENGTH) {
    const error = new Error(`Comment content cannot exceed ${MAX_COMMENT_LENGTH} characters.`);
    error.statusCode = 400;
    throw error;
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    const error = new Error('Project not found.');
    error.statusCode = 404;
    throw error;
  }
  if (project.status === 'ARCHIVED') {
    const error = new Error('Cannot add comments in an archived project.');
    error.statusCode = 400;
    throw error;
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.projectId !== projectId) {
    const error = new Error('Task not found.');
    error.statusCode = 404;
    throw error;
  }

  const actorMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: authorId } }
  });
  if (!actorMember) {
    const error = new Error('Access denied. You are not a member of this project.');
    error.statusCode = 403;
    throw error;
  }

  return await prisma.comment.create({
    data: {
      taskId,
      authorId,
      content: content.trim()
    },
    include: {
      author: {
        select: { id: true, name: true, email: true }
      }
    }
  });
}

/**
 * Retrieves all comments for a task, verifying project/task scope.
 */
export async function getCommentsForTask(projectId, taskId, actorUserId) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    const error = new Error('Project not found.');
    error.statusCode = 404;
    throw error;
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
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

  return await prisma.comment.findMany({
    where: { taskId },
    include: {
      author: {
        select: { id: true, name: true, email: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });
}

/**
 * Updates an existing comment with no-op check and editedAt tracking.
 */
export async function updateComment(projectId, taskId, commentId, content, actorUserId) {
  if (!content || !content.trim()) {
    const error = new Error('Comment content cannot be empty.');
    error.statusCode = 400;
    throw error;
  }

  if (content.length > MAX_COMMENT_LENGTH) {
    const error = new Error(`Comment content cannot exceed ${MAX_COMMENT_LENGTH} characters.`);
    error.statusCode = 400;
    throw error;
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    const error = new Error('Project not found.');
    error.statusCode = 404;
    throw error;
  }
  if (project.status === 'ARCHIVED') {
    const error = new Error('Cannot edit comments in an archived project.');
    error.statusCode = 400;
    throw error;
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.projectId !== projectId) {
    const error = new Error('Task not found.');
    error.statusCode = 404;
    throw error;
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: {
      author: {
        select: { id: true, name: true, email: true }
      }
    }
  });
  if (!comment || comment.taskId !== taskId) {
    const error = new Error('Comment not found.');
    error.statusCode = 404;
    throw error;
  }

  if (comment.authorId !== actorUserId) {
    const error = new Error('Access denied. You can only edit your own comments.');
    error.statusCode = 403;
    throw error;
  }

  const trimmedContent = content.trim();

  // No-op Check: if content is unchanged, return immediately
  if (comment.content === trimmedContent) {
    return comment;
  }

  return await prisma.comment.update({
    where: { id: commentId },
    data: {
      content: trimmedContent,
      editedAt: new Date()
    },
    include: {
      author: {
        select: { id: true, name: true, email: true }
      }
    }
  });
}

/**
 * Deletes a comment.
 */
export async function deleteComment(projectId, taskId, commentId, actorUserId) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    const error = new Error('Project not found.');
    error.statusCode = 404;
    throw error;
  }
  if (project.status === 'ARCHIVED') {
    const error = new Error('Cannot delete comments in an archived project.');
    error.statusCode = 400;
    throw error;
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.projectId !== projectId) {
    const error = new Error('Task not found.');
    error.statusCode = 404;
    throw error;
  }

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.taskId !== taskId) {
    const error = new Error('Comment not found.');
    error.statusCode = 404;
    throw error;
  }

  const actorMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: actorUserId } }
  });

  const isAuthor = comment.authorId === actorUserId;
  const isManager = actorMember && actorMember.role === 'MANAGER';

  if (!isAuthor && !isManager) {
    const error = new Error('Access denied. Only the author or a MANAGER can delete this comment.');
    error.statusCode = 403;
    throw error;
  }

  await prisma.comment.delete({ where: { id: commentId } });
  return { success: true };
}
