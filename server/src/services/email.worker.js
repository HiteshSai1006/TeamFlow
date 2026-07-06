import prisma from '../config/db.js';
import { processOutboxEvent } from '../modules/notification/notification.service.js';
import { sendEmail } from './email.service.js';

export async function runOutboxWorker() {
  try {
    // 1. Claim PENDING events using atomic SQL claim query with CTE and SKIP LOCKED
    const claimedEvents = await prisma.$queryRaw`
      WITH claimed_events AS (
        UPDATE "EventOutbox"
        SET "processingState" = 'PROCESSING',
            "claimedAt" = NOW(),
            "processingAttempts" = "processingAttempts" + 1
        WHERE id IN (
          SELECT id FROM "EventOutbox"
          WHERE "processingState" = 'PENDING' AND "processingAttempts" < 3
          ORDER BY "createdAt" ASC
          LIMIT 10
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, "eventType", metadata, "processingAttempts"
      )
      SELECT id, "eventType"::text AS "eventType", metadata, "processingAttempts" FROM claimed_events;
    `;

    if (!claimedEvents || claimedEvents.length === 0) return;

    for (const event of claimedEvents) {
      try {
        await processOutboxEvent(event.id);
      } catch (err) {
        console.error(`[Outbox Worker] Error processing event ${event.id}:`, err);
        const attempts = event.processingAttempts;
        if (attempts < 3) {
          await prisma.eventOutbox.update({
            where: { id: event.id },
            data: {
              processingState: 'PENDING',
              claimedAt: null
            }
          });
        } else {
          await prisma.eventOutbox.update({
            where: { id: event.id },
            data: {
              processingState: 'FAILED',
              processingError: err.message,
              claimedAt: null
            }
          });
        }
      }
    }
  } catch (err) {
    console.error('[Outbox Worker] Error in worker loop:', err);
  }
}

export async function runEmailWorker() {
  try {
    // 2. Claim PENDING notifications using atomic SQL claim query with CTE and SKIP LOCKED
    const claimedNotifications = await prisma.$queryRaw`
      WITH claimed_notifications AS (
        UPDATE "Notification"
        SET "emailState" = 'PROCESSING',
            "claimedAt" = NOW(),
            "emailAttempts" = "emailAttempts" + 1
        WHERE id IN (
          SELECT id FROM "Notification"
          WHERE "emailState" = 'PENDING' AND "emailAttempts" < 3
          ORDER BY "createdAt" ASC
          LIMIT 10
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, "recipientId", title, message, "emailAttempts"
      )
      SELECT id, "recipientId", title, message, "emailAttempts" FROM claimed_notifications;
    `;

    if (!claimedNotifications || claimedNotifications.length === 0) return;

    for (const notif of claimedNotifications) {
      try {
        // Fetch recipient preference
        let pref = await prisma.userPreference.findUnique({
          where: { userId: notif.recipientId }
        });
        if (!pref) {
          pref = await prisma.userPreference.create({
            data: { userId: notif.recipientId, emailOptOut: false }
          });
        }

        if (pref.emailOptOut) {
          await prisma.notification.update({
            where: { id: notif.id },
            data: {
              emailState: 'SKIPPED_OPT_OUT',
              claimedAt: null
            }
          });
          continue;
        }

        // Fetch user email address
        const user = await prisma.user.findUnique({
          where: { id: notif.recipientId },
          select: { email: true }
        });

        if (!user || !user.email) {
          throw new Error(`Recipient user not found or missing email for ID ${notif.recipientId}`);
        }

        // Send actual mock email
        await sendEmail({
          recipientEmail: user.email,
          title: notif.title,
          message: notif.message,
          notificationId: notif.id
        });

        // Mark as SENT
        await prisma.notification.update({
          where: { id: notif.id },
          data: {
            emailState: 'SENT',
            claimedAt: null
          }
        });
      } catch (err) {
        console.error(`[Email Worker] Error processing notification ${notif.id}:`, err);
        const attempts = notif.emailAttempts;
        if (attempts < 3) {
          await prisma.notification.update({
            where: { id: notif.id },
            data: {
              emailState: 'PENDING',
              claimedAt: null
            }
          });
        } else {
          await prisma.notification.update({
            where: { id: notif.id },
            data: {
              emailState: 'FAILED',
              emailError: err.message,
              claimedAt: null
            }
          });
        }
      }
    }
  } catch (err) {
    console.error('[Email Worker] Error in worker loop:', err);
  }
}

/**
 * Recovers stale processing records stuck for more than 5 minutes due to worker crash.
 * Resets state back to PENDING and clears claimedAt, without incrementing attempts.
 */
export async function runStaleRecoveryWorker() {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Stale Outbox recovery
    await prisma.eventOutbox.updateMany({
      where: {
        processingState: 'PROCESSING',
        claimedAt: { lt: fiveMinutesAgo }
      },
      data: {
        processingState: 'PENDING',
        claimedAt: null
      }
    });

    // Stale Notification email recovery
    await prisma.notification.updateMany({
      where: {
        emailState: 'PROCESSING',
        claimedAt: { lt: fiveMinutesAgo }
      },
      data: {
        emailState: 'PENDING',
        claimedAt: null
      }
    });
  } catch (err) {
    console.error('[Stale Recovery Worker] Error running recovery:', err);
  }
}

// Start workers
let outboxInterval = null;
let emailInterval = null;
let recoveryInterval = null;

export function startNotificationWorkers(intervalMs = 3000) {
  if (!outboxInterval) {
    outboxInterval = setInterval(runOutboxWorker, intervalMs);
  }
  if (!emailInterval) {
    emailInterval = setInterval(runEmailWorker, intervalMs);
  }
  if (!recoveryInterval) {
    recoveryInterval = setInterval(runStaleRecoveryWorker, intervalMs * 10);
  }
}

export function stopNotificationWorkers() {
  if (outboxInterval) clearInterval(outboxInterval);
  if (emailInterval) clearInterval(emailInterval);
  if (recoveryInterval) clearInterval(recoveryInterval);
  outboxInterval = null;
  emailInterval = null;
  recoveryInterval = null;
}
