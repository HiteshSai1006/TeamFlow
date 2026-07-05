import prisma from '../../config/db.js';

/**
 * Lists all pending reviews assigned to the logged-in user where the parent RCA is UNDER_REVIEW.
 */
export async function listMyPendingReviews(actorUserId) {
  return await prisma.review.findMany({
    where: {
      reviewerId: actorUserId,
      decision: 'PENDING',
      rca: {
        status: 'UNDER_REVIEW'
      }
    },
    include: {
      rca: {
        include: {
          project: true,
          createdBy: { select: { id: true, name: true, email: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Submits an APPROVED or REJECTED decision with a comment.
 */
export async function decideReview(reviewId, { decision, comment }, actorUserId) {
  // First, find the review to discover rcaId
  const initialReview = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { rca: true }
  });

  if (!initialReview) {
    const err = new Error('Review not found.');
    err.statusCode = 404;
    throw err;
  }

  const rcaId = initialReview.rcaId;

  return await prisma.$transaction(async (tx) => {
    // 1. Acquire advisory lock
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1002, CAST(${rcaId} AS integer))`;

    // 2. Re-fetch and validate RCA, Review, current round, PENDING state, and project status
    const rca = await tx.rCA.findUnique({
      where: { id: rcaId },
      include: {
        project: true
      }
    });

    if (!rca) {
      const err = new Error('RCA not found.');
      err.statusCode = 404;
      throw err;
    }

    // Archived project validation
    if (rca.project.status === 'ARCHIVED') {
      const err = new Error('Cannot mutate reviews in an archived project.');
      err.statusCode = 400;
      throw err;
    }

    if (rca.status !== 'UNDER_REVIEW') {
      const err = new Error('Decisions can only be submitted on UNDER_REVIEW RCAs.');
      err.statusCode = 400;
      throw err;
    }

    const review = await tx.review.findUnique({
      where: { id: reviewId }
    });

    if (!review) {
      const err = new Error('Review not found.');
      err.statusCode = 404;
      throw err;
    }

    if (review.reviewerId !== actorUserId) {
      const err = new Error('Access denied. You are not authorized to decide this review.');
      err.statusCode = 403;
      throw err;
    }

    if (review.decision !== 'PENDING') {
      const err = new Error('This review has already been decided.');
      err.statusCode = 400;
      throw err;
    }

    if (review.round !== rca.reviewRound) {
      const err = new Error('This review belongs to a historical round and cannot be modified.');
      err.statusCode = 400;
      throw err;
    }

    // Validate request parameters
    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      const err = new Error('Decision must be APPROVED or REJECTED.');
      err.statusCode = 400;
      throw err;
    }

    if (!comment || !comment.trim()) {
      const err = new Error('A non-empty comment is required for review decisions.');
      err.statusCode = 400;
      throw err;
    }

    // 3. Write decision
    await tx.review.update({
      where: { id: reviewId },
      data: {
        decision,
        comment: comment.trim(),
        decidedAt: new Date()
      }
    });

    // 4. Aggregated state evaluation (current round only)
    const allReviews = await tx.review.findMany({
      where: {
        rcaId,
        round: rca.reviewRound
      }
    });

    const hasRejected = allReviews.some(r => r.decision === 'REJECTED');
    const allDecided = allReviews.every(r => r.decision !== 'PENDING');

    let nextStatus = 'UNDER_REVIEW';
    if (hasRejected) {
      nextStatus = 'REJECTED';
    } else if (allDecided) {
      nextStatus = 'APPROVED';
    }

    let updatedRca = rca;
    if (nextStatus !== 'UNDER_REVIEW') {
      updatedRca = await tx.rCA.update({
        where: { id: rcaId },
        data: { status: nextStatus },
        include: {
          project: true,
          createdBy: { select: { id: true, name: true, email: true } },
          sections: true,
          reviews: {
            include: {
              reviewer: { select: { id: true, name: true, email: true } }
            }
          }
        }
      });
    } else {
      updatedRca = await tx.rCA.findUnique({
        where: { id: rcaId },
        include: {
          project: true,
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

    // Fetch all reviewers of the current round to notify them
    const currentRoundReviewers = allReviews.map(r => r.reviewerId);

    // Create EventOutbox row for RCA_REVIEW_DECIDED
    await tx.eventOutbox.create({
      data: {
        eventType: 'RCA_REVIEW_DECIDED',
        entityId: rcaId,
        actorId: actorUserId,
        metadata: {
          rcaId,
          rcaTitle: rca.title,
          reviewId,
          reviewRound: rca.reviewRound,
          decision: decision,
          rcaCreatorId: rca.createdById,
          currentRoundReviewerIds: currentRoundReviewers,
          actorId: actorUserId
        }
      }
    });

    return {
      review: await tx.review.findUnique({
        where: { id: reviewId },
        include: {
          reviewer: { select: { id: true, name: true, email: true } }
        }
      }),
      rca: updatedRca
    };
  });
}
