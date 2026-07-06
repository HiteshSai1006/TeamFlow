import prisma from '../../config/db.js';

/**
 * Calculates the recipient IDs list based on event type and metadata.
 */
export function calculateRecipients(eventType, metadata, actorId) {
  const recipients = new Set();

  if (eventType === 'TASK_ASSIGNED') {
    const { newAssigneeId } = metadata;
    if (newAssigneeId) {
      recipients.add(Number(newAssigneeId));
    }
  } else if (eventType === 'TASK_STATUS_CHANGED') {
    const { creatorId, assigneeId } = metadata;
    if (creatorId) recipients.add(Number(creatorId));
    if (assigneeId) recipients.add(Number(assigneeId));
  } else if (eventType === 'RCA_SUBMITTED') {
    const { reviewerIds } = metadata;
    if (Array.isArray(reviewerIds)) {
      reviewerIds.forEach(id => recipients.add(Number(id)));
    }
  } else if (eventType === 'RCA_REVIEW_DECIDED') {
    const { rcaCreatorId, currentRoundReviewerIds } = metadata;
    if (rcaCreatorId) recipients.add(Number(rcaCreatorId));
    if (Array.isArray(currentRoundReviewerIds)) {
      currentRoundReviewerIds.forEach(id => recipients.add(Number(id)));
    }
  } else if (eventType === 'TASK_COMMENT_MENTION') {
    const { mentionedUserIds } = metadata;
    if (Array.isArray(mentionedUserIds)) {
      mentionedUserIds.forEach(id => recipients.add(Number(id)));
    }
  }

  // Actor exclusion: user who triggered the event should not receive a notification
  if (actorId) {
    recipients.delete(Number(actorId));
  }

  return Array.from(recipients);
}

/**
 * Generates notification title and message based on type and metadata.
 */
export function generateNotificationContent(eventType, metadata) {
  if (eventType === 'TASK_ASSIGNED') {
    const { taskTitle } = metadata;
    return {
      title: 'Task Assigned',
      message: `You have been assigned to task "${taskTitle}".`
    };
  } else if (eventType === 'TASK_STATUS_CHANGED') {
    const { taskTitle, oldStatus, newStatus } = metadata;
    return {
      title: 'Task Status Changed',
      message: `Task "${taskTitle}" status changed from ${oldStatus} to ${newStatus}.`
    };
  } else if (eventType === 'RCA_SUBMITTED') {
    const { rcaTitle, reviewRound } = metadata;
    return {
      title: 'RCA Submitted for Review',
      message: `RCA "${rcaTitle}" has been submitted for review (Round ${reviewRound}).`
    };
  } else if (eventType === 'RCA_REVIEW_DECIDED') {
    const { rcaTitle, reviewRound, decision } = metadata;
    return {
      title: 'RCA Review Decision Added',
      message: `RCA "${rcaTitle}" review decision: ${decision} (Round ${reviewRound}).`
    };
  } else if (eventType === 'TASK_COMMENT_MENTION') {
    const { taskTitle, authorName } = metadata;
    return {
      title: 'Mentioned in Comment',
      message: `${authorName} mentioned you in a comment on task "${taskTitle}".`
    };
  }
  return { title: 'Notification', message: 'Activity alert.' };
}

/**
 * Atomic fan-out execution for one EventOutbox entry.
 * Creates all notifications and updates EventOutbox state to PROCESSED in a single transaction.
 */
export async function processOutboxEvent(eventId) {
  return await prisma.$transaction(async (tx) => {
    const event = await tx.eventOutbox.findUnique({
      where: { id: eventId }
    });

    if (!event) return;
    if (event.processingState === 'PROCESSED') return;

    const { eventType, metadata, actorId } = event;
    const recipients = calculateRecipients(eventType, metadata, actorId);

    if (recipients.length > 0) {
      const notificationsData = [];
      for (const recipientId of recipients) {
        const { title, message } = generateNotificationContent(eventType, metadata);
        notificationsData.push({
          recipientId,
          eventId,
          dedupKey: `event:${eventId}:recipient:${recipientId}`,
          title,
          message,
          emailState: 'PENDING'
        });
      }

      await tx.notification.createMany({
        data: notificationsData,
        skipDuplicates: true
      });
    }

    await tx.eventOutbox.update({
      where: { id: eventId },
      data: {
        processingState: 'PROCESSED',
        processedAt: new Date(),
        claimedAt: null
      }
    });
  });
}

/**
 * Returns notifications for a recipient, sorted newest first.
 */
export async function getNotificationsForUser(userId) {
  return await prisma.notification.findMany({
    where: { recipientId: userId },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Marks a notification as read. Returns 404/throws if notification belongs to another user.
 */
export async function markNotificationAsRead(notificationId, userId) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId }
  });

  if (!notification || notification.recipientId !== userId) {
    const err = new Error('Notification not found.');
    err.statusCode = 404;
    throw err;
  }

  return await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true }
  });
}

/**
 * Marks all notifications as read for a user.
 */
export async function markAllNotificationsAsRead(userId) {
  return await prisma.notification.updateMany({
    where: { recipientId: userId, read: false },
    data: { read: true }
  });
}

/**
 * Gets or initializes a user's notification email preference.
 */
export async function getUserPreference(userId) {
  let pref = await prisma.userPreference.findUnique({
    where: { userId }
  });
  if (!pref) {
    pref = await prisma.userPreference.create({
      data: { userId, emailOptOut: false }
    });
  }
  return pref;
}

/**
 * Updates a user's notification email preference.
 */
export async function updateUserPreference(userId, emailOptOut) {
  // Ensure initialized
  await getUserPreference(userId);

  return await prisma.userPreference.update({
    where: { userId },
    data: { emailOptOut }
  });
}
