import prisma from '../../config/db.js';

/**
 * Creates a new RCA in DRAFT status.
 */
export async function createRCA(projectId, { title, description, severity }, actorUserId) {
  // Validate project status
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    const err = new Error('Project not found.');
    err.statusCode = 404;
    throw err;
  }
  if (project.status === 'ARCHIVED') {
    const err = new Error('Cannot mutate RCAs in an archived project.');
    err.statusCode = 400;
    throw err;
  }

  if (!title || !title.trim()) {
    const err = new Error('Title is required.');
    err.statusCode = 400;
    throw err;
  }

  if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severity)) {
    const err = new Error('Invalid severity level.');
    err.statusCode = 400;
    throw err;
  }

  return await prisma.rCA.create({
    data: {
      projectId,
      title: title.trim(),
      description: description ? description.trim() : null,
      severity,
      status: 'DRAFT',
      reviewRound: 1,
      createdById: actorUserId
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } }
    }
  });
}

/**
 * Lists all RCAs for a project.
 */
export async function listRCAs(projectId) {
  return await prisma.rCA.findMany({
    where: { projectId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      sections: true,
      reviews: {
        include: {
          reviewer: { select: { id: true, name: true, email: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Gets a single RCA details.
 */
export async function getRCA(projectId, rcaId) {
  const rca = await prisma.rCA.findUnique({
    where: { id: rcaId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      sections: true,
      reviews: {
        include: {
          reviewer: { select: { id: true, name: true, email: true } }
        }
      }
    }
  });

  if (!rca || rca.projectId !== projectId) {
    const err = new Error('RCA not found.');
    err.statusCode = 404;
    throw err;
  }

  return rca;
}

/**
 * Patches a DRAFT RCA.
 */
export async function patchRCA(projectId, rcaId, { title, description, severity }, actorUserId, actorRole) {
  // Obtain advisory lock
  await prisma.$executeRaw`SELECT pg_advisory_xact_lock(1002, CAST(${rcaId} AS integer))`;

  const rca = await prisma.rCA.findUnique({ where: { id: rcaId } });
  if (!rca || rca.projectId !== projectId) {
    const err = new Error('RCA not found.');
    err.statusCode = 404;
    throw err;
  }

  // Archived check
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (project.status === 'ARCHIVED') {
    const err = new Error('Cannot mutate RCAs in an archived project.');
    err.statusCode = 400;
    throw err;
  }

  if (rca.status !== 'DRAFT') {
    const err = new Error('RCA can only be modified in DRAFT status.');
    err.statusCode = 400;
    throw err;
  }

  // Authorization check
  const isCreator = rca.createdById === actorUserId;
  const isManager = actorRole === 'MANAGER';
  if (!isCreator && !isManager) {
    const err = new Error('Access denied. Only the creator or a MANAGER can edit this RCA.');
    err.statusCode = 403;
    throw err;
  }

  const updateData = {};
  if (title !== undefined) {
    if (!title || !title.trim()) {
      const err = new Error('Title is required.');
      err.statusCode = 400;
      throw err;
    }
    updateData.title = title.trim();
  }
  if (description !== undefined) {
    updateData.description = description ? description.trim() : null;
  }
  if (severity !== undefined) {
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severity)) {
      const err = new Error('Invalid severity level.');
      err.statusCode = 400;
      throw err;
    }
    updateData.severity = severity;
  }

  return await prisma.rCA.update({
    where: { id: rcaId },
    data: updateData,
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      sections: true,
      reviews: {
        include: {
          reviewer: { select: { id: true, name: true, email: true } }
        }
      }
    }
  });
}

/**
 * Upserts a section for a DRAFT RCA.
 */
export async function upsertSection(projectId, rcaId, type, { content }, actorUserId, actorRole) {
  if (!['TIMELINE', 'CONTRIBUTING_FACTORS', 'CORRECTIVE_ACTIONS', 'PREVENTIVE_MEASURES'].includes(type)) {
    const err = new Error('Invalid section type.');
    err.statusCode = 400;
    throw err;
  }

  if (!content || !content.trim()) {
    const err = new Error('Section content cannot be empty.');
    err.statusCode = 400;
    throw err;
  }

  // Obtain advisory lock
  await prisma.$executeRaw`SELECT pg_advisory_xact_lock(1002, CAST(${rcaId} AS integer))`;

  const rca = await prisma.rCA.findUnique({ where: { id: rcaId } });
  if (!rca || rca.projectId !== projectId) {
    const err = new Error('RCA not found.');
    err.statusCode = 404;
    throw err;
  }

  // Archived check
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (project.status === 'ARCHIVED') {
    const err = new Error('Cannot mutate RCAs in an archived project.');
    err.statusCode = 400;
    throw err;
  }

  if (rca.status !== 'DRAFT') {
    const err = new Error('RCA sections can only be modified in DRAFT status.');
    err.statusCode = 400;
    throw err;
  }

  // Authorization check
  const isCreator = rca.createdById === actorUserId;
  const isManager = actorRole === 'MANAGER';
  if (!isCreator && !isManager) {
    const err = new Error('Access denied. Only the creator or a MANAGER can edit sections.');
    err.statusCode = 403;
    throw err;
  }

  return await prisma.rCASection.upsert({
    where: { rcaId_type: { rcaId, type } },
    update: { content: content.trim() },
    create: { rcaId, type, content: content.trim() }
  });
}

/**
 * Submits the RCA for review.
 */
export async function submitRCA(projectId, rcaId, { reviewerIds }, actorUserId, actorRole) {
  if (!reviewerIds || !Array.isArray(reviewerIds) || reviewerIds.length === 0) {
    const err = new Error('At least one reviewer is required.');
    err.statusCode = 400;
    throw err;
  }

  // Check for duplicates
  const uniqueReviewers = new Set(reviewerIds);
  if (uniqueReviewers.size !== reviewerIds.length) {
    const err = new Error('Duplicate reviewers are not allowed.');
    err.statusCode = 400;
    throw err;
  }

  return await prisma.$transaction(async (tx) => {
    // Acquire advisory lock
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1002, CAST(${rcaId} AS integer))`;

    const rca = await tx.rCA.findUnique({
      where: { id: rcaId },
      include: { sections: true }
    });

    if (!rca || rca.projectId !== projectId) {
      const err = new Error('RCA not found.');
      err.statusCode = 404;
      throw err;
    }

    // Archived check
    const project = await tx.project.findUnique({ where: { id: projectId } });
    if (project.status === 'ARCHIVED') {
      const err = new Error('Cannot mutate RCAs in an archived project.');
      err.statusCode = 400;
      throw err;
    }

    if (rca.status !== 'DRAFT') {
      const err = new Error('RCA can only be submitted in DRAFT status.');
      err.statusCode = 400;
      throw err;
    }

    // Authorization check
    const isCreator = rca.createdById === actorUserId;
    const isManager = actorRole === 'MANAGER';
    if (!isCreator && !isManager) {
      const err = new Error('Access denied. Only the creator or a MANAGER can submit this RCA.');
      err.statusCode = 403;
      throw err;
    }

    // Validate sections: All four types must exist and be non-empty
    const requiredTypes = ['TIMELINE', 'CONTRIBUTING_FACTORS', 'CORRECTIVE_ACTIONS', 'PREVENTIVE_MEASURES'];
    const sectionTypes = rca.sections.map(s => s.type);
    const hasAllSections = requiredTypes.every(t => sectionTypes.includes(t));
    if (!hasAllSections) {
      const err = new Error('All four required sections (TIMELINE, CONTRIBUTING_FACTORS, CORRECTIVE_ACTIONS, PREVENTIVE_MEASURES) must exist before submission.');
      err.statusCode = 400;
      throw err;
    }

    const hasEmptySections = rca.sections.some(s => !s.content || !s.content.trim());
    if (hasEmptySections) {
      const err = new Error('All sections must contain non-whitespace content.');
      err.statusCode = 400;
      throw err;
    }

    // Validate reviewers: Must belong to project and have role REVIEWER
    const members = await tx.projectMember.findMany({
      where: {
        projectId,
        userId: { in: reviewerIds }
      }
    });

    if (members.length !== reviewerIds.length) {
      const err = new Error('One or more selected reviewers are not members of this project.');
      err.statusCode = 400;
      throw err;
    }

    const nonReviewers = members.filter(m => m.role !== 'REVIEWER');
    if (nonReviewers.length > 0) {
      const err = new Error('All selected reviewers must have the ProjectRole REVIEWER.');
      err.statusCode = 400;
      throw err;
    }

    // Create PENDING Review rows
    const reviewData = reviewerIds.map(reviewerId => ({
      rcaId,
      reviewerId,
      round: rca.reviewRound,
      decision: 'PENDING'
    }));

    await tx.review.createMany({
      data: reviewData
    });

    // Update RCA status to UNDER_REVIEW
    const updated = await tx.rCA.update({
      where: { id: rcaId },
      data: { status: 'UNDER_REVIEW' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        sections: true,
        reviews: {
          include: {
            reviewer: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    // Create EventOutbox row for RCA_SUBMITTED
    await tx.eventOutbox.create({
      data: {
        eventType: 'RCA_SUBMITTED',
        entityId: rcaId,
        actorId: actorUserId,
        metadata: {
          rcaId,
          rcaTitle: rca.title,
          reviewRound: rca.reviewRound,
          reviewerIds: reviewerIds,
          actorId: actorUserId
        }
      }
    });

    return updated;
  });
}

/**
 * Reopens a REJECTED RCA.
 */
export async function reopenRCA(projectId, rcaId, actorUserId, actorRole) {
  return await prisma.$transaction(async (tx) => {
    // Acquire advisory lock
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1002, CAST(${rcaId} AS integer))`;

    const rca = await tx.rCA.findUnique({ where: { id: rcaId } });
    if (!rca || rca.projectId !== projectId) {
      const err = new Error('RCA not found.');
      err.statusCode = 404;
      throw err;
    }

    // Archived check
    const project = await tx.project.findUnique({ where: { id: projectId } });
    if (project.status === 'ARCHIVED') {
      const err = new Error('Cannot mutate RCAs in an archived project.');
      err.statusCode = 400;
      throw err;
    }

    if (rca.status !== 'REJECTED') {
      const err = new Error('Only REJECTED RCAs can be reopened.');
      err.statusCode = 400;
      throw err;
    }

    // Authorization check: MANAGER or creator
    const isCreator = rca.createdById === actorUserId;
    const isManager = actorRole === 'MANAGER';
    if (!isCreator && !isManager) {
      const err = new Error('Access denied. Only the creator or a MANAGER can reopen this RCA.');
      err.statusCode = 403;
      throw err;
    }

    // Update status to DRAFT and increment reviewRound
    return await tx.rCA.update({
      where: { id: rcaId },
      data: {
        status: 'DRAFT',
        reviewRound: rca.reviewRound + 1
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        sections: true,
        reviews: {
          include: {
            reviewer: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });
  });
}

/**
 * Closes an APPROVED RCA.
 */
export async function closeRCA(projectId, rcaId, actorUserId, actorRole) {
  return await prisma.$transaction(async (tx) => {
    // Acquire advisory lock
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1002, CAST(${rcaId} AS integer))`;

    const rca = await tx.rCA.findUnique({ where: { id: rcaId } });
    if (!rca || rca.projectId !== projectId) {
      const err = new Error('RCA not found.');
      err.statusCode = 404;
      throw err;
    }

    // Archived check
    const project = await tx.project.findUnique({ where: { id: projectId } });
    if (project.status === 'ARCHIVED') {
      const err = new Error('Cannot mutate RCAs in an archived project.');
      err.statusCode = 400;
      throw err;
    }

    if (rca.status !== 'APPROVED') {
      const err = new Error('Only APPROVED RCAs can be closed.');
      err.statusCode = 400;
      throw err;
    }

    // Authorization check: MANAGER only
    if (actorRole !== 'MANAGER') {
      const err = new Error('Access denied. Only a MANAGER can close this RCA.');
      err.statusCode = 403;
      throw err;
    }

    return await tx.rCA.update({
      where: { id: rcaId },
      data: { status: 'CLOSED' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        sections: true,
        reviews: {
          include: {
            reviewer: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });
  });
}
