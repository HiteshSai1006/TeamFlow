import prisma from '../../config/db.js';

/**
 * Creates a new Project and adds the creator as MANAGER atomically in a transaction.
 */
export async function createProject({ name, description, createdById }) {
  // Atomic transaction
  return await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        createdById
      }
    });

    await tx.projectMember.create({
      data: {
        projectId: project.id,
        userId: createdById,
        role: 'MANAGER'
      }
    });

    return project;
  });
}

/**
 * Lists all projects where the authenticated user is a member.
 */
export async function getProjectsForUser(userId) {
  return await prisma.project.findMany({
    where: {
      members: {
        some: {
          userId
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Gets a specific project's details.
 */
export async function getProjectById(projectId) {
  return await prisma.project.findUnique({
    where: { id: projectId }
  });
}

/**
 * Updates project metadata. Blocked if archived.
 */
export async function updateProject(projectId, updateData) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    const error = new Error('Project not found.');
    error.statusCode = 404;
    throw error;
  }

  if (project.status === 'ARCHIVED') {
    const error = new Error('Cannot update project settings while the project is archived.');
    error.statusCode = 400;
    throw error;
  }

  // Only allow updating name and description
  const data = {};
  if (updateData.name !== undefined) data.name = updateData.name.trim();
  if (updateData.description !== undefined) data.description = updateData.description ? updateData.description.trim() : null;

  return await prisma.project.update({
    where: { id: projectId },
    data
  });
}

/**
 * Explicitly archives a project.
 */
export async function archiveProject(projectId) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    const error = new Error('Project not found.');
    error.statusCode = 404;
    throw error;
  }

  if (project.status === 'ARCHIVED') {
    const error = new Error('Project is already archived.');
    error.statusCode = 400;
    throw error;
  }

  return await prisma.project.update({
    where: { id: projectId },
    data: { status: 'ARCHIVED' }
  });
}

/**
 * Explicitly restores an archived project.
 */
export async function restoreProject(projectId) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    const error = new Error('Project not found.');
    error.statusCode = 404;
    throw error;
  }

  if (project.status !== 'ARCHIVED') {
    const error = new Error('Project is not archived.');
    error.statusCode = 400;
    throw error;
  }

  return await prisma.project.update({
    where: { id: projectId },
    data: { status: 'ACTIVE' }
  });
}

/**
 * Lists all members of a project (without user password hashes).
 */
export async function getProjectMembers(projectId) {
  return await prisma.projectMember.findMany({
    where: { projectId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          systemRole: true
        }
      }
    },
    orderBy: { joinedAt: 'asc' }
  });
}

/**
 * Invites a user by email to join a project. Blocked if archived.
 */
export async function addProjectMember(projectId, email, role = 'MEMBER') {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (project.status === 'ARCHIVED') {
    const error = new Error('Cannot add members while the project is archived.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (!user) {
    const error = new Error('User with this email address was not found.');
    error.statusCode = 404;
    throw error;
  }

  // Check duplicate membership
  const existingMember = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: user.id
      }
    }
  });

  if (existingMember) {
    const error = new Error('User is already a member of this project.');
    error.statusCode = 409;
    throw error;
  }

  return await prisma.projectMember.create({
    data: {
      projectId,
      userId: user.id,
      role
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });
}

/**
 * Updates a member's role. Blocked if archived.
 * Invariant: A project must always contain at least one MANAGER.
 */
export async function updateProjectMemberRole(projectId, memberId, newRole, actorUserId) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (project.status === 'ARCHIVED') {
    const error = new Error('Cannot update member roles while the project is archived.');
    error.statusCode = 400;
    throw error;
  }

  const targetMember = await prisma.projectMember.findUnique({
    where: { id: memberId }
  });

  if (!targetMember || targetMember.projectId !== projectId) {
    const error = new Error('Project member not found.');
    error.statusCode = 404;
    throw error;
  }

  // Manager safety checks: demoting the last manager is rejected
  if (targetMember.role === 'MANAGER' && newRole !== 'MANAGER') {
    const managerCount = await prisma.projectMember.count({
      where: {
        projectId,
        role: 'MANAGER'
      }
    });

    if (managerCount <= 1) {
      const error = new Error('Cannot demote the only MANAGER. A project must always have at least one MANAGER.');
      error.statusCode = 400;
      throw error;
    }
  }

  return await prisma.projectMember.update({
    where: { id: memberId },
    data: { role: newRole },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });
}

/**
 * Removes a member from a project. Blocked if archived.
 * Invariant: A project must always contain at least one MANAGER.
 */
export async function removeProjectMember(projectId, memberId, actorUserId) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (project.status === 'ARCHIVED') {
    const error = new Error('Cannot remove members while the project is archived.');
    error.statusCode = 400;
    throw error;
  }

  const targetMember = await prisma.projectMember.findUnique({
    where: { id: memberId }
  });

  if (!targetMember || targetMember.projectId !== projectId) {
    const error = new Error('Project member not found.');
    error.statusCode = 404;
    throw error;
  }

  // Manager safety checks: removing the last manager is rejected
  if (targetMember.role === 'MANAGER') {
    const managerCount = await prisma.projectMember.count({
      where: {
        projectId,
        role: 'MANAGER'
      }
    });

    if (managerCount <= 1) {
      const error = new Error('Cannot remove the only MANAGER. A project must always have at least one MANAGER.');
      error.statusCode = 400;
      throw error;
    }
  }

  return await prisma.projectMember.delete({
    where: { id: memberId }
  });
}
