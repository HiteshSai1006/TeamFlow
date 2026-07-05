import prisma from '../../config/db.js';
import * as storageService from '../../services/storage.service.js';

/**
 * Creates an attachment record after saving file.
 */
export async function createAttachment(projectId, taskId, file, actorUserId) {
  if (!file) {
    const error = new Error('No file provided.');
    error.statusCode = 400;
    throw error;
  }

  // Save the physical file on disk
  const storageKey = await storageService.saveFile(file);

  try {
    // Write metadata record to the database
    return await prisma.attachment.create({
      data: {
        taskId,
        uploadedById: actorUserId,
        originalName: file.originalname,
        storageKey,
        mimeType: file.mimetype,
        size: file.size
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  } catch (dbError) {
    // Database creation fails after the file is saved, delete physical file
    console.error(`Database record creation failed. Cleaning up disk file ${storageKey}...`, dbError);
    await storageService.deleteFile(storageKey).catch(err => {
      console.error(`Emergency file cleanup failed for ${storageKey}:`, err);
    });
    throw dbError;
  }
}

/**
 * Returns attachments list.
 */
export async function getAttachmentsForTask(projectId, taskId) {
  return await prisma.attachment.findMany({
    where: { taskId },
    include: {
      uploadedBy: {
        select: { id: true, name: true, email: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Returns safe file path details for download streaming.
 */
export async function getAttachmentPath(projectId, taskId, attachmentId) {
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || attachment.taskId !== taskId) {
    const error = new Error('Attachment not found.');
    error.statusCode = 404;
    throw error;
  }

  try {
    const filePath = storageService.getFilePath(attachment.storageKey);
    return {
      filePath,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      const err = new Error('Physical file missing on disk.');
      err.statusCode = 404;
      throw err;
    }
    throw error;
  }
}

/**
 * Deletes attachment.
 */
export async function deleteAttachment(projectId, taskId, attachmentId, actorUserId, actorRole) {
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || attachment.taskId !== taskId) {
    const error = new Error('Attachment not found.');
    error.statusCode = 404;
    throw error;
  }

  const isUploader = attachment.uploadedById === actorUserId;
  const isManager = actorRole === 'MANAGER';

  if (!isUploader && !isManager) {
    const error = new Error('Access denied. Only the uploader or a MANAGER can delete this attachment.');
    error.statusCode = 403;
    throw error;
  }

  // Deletion consistency:
  // 1. Delete database metadata record first
  await prisma.attachment.delete({ where: { id: attachmentId } });

  // 2. Attempt physical filesystem deletion
  try {
    await storageService.deleteFile(attachment.storageKey);
  } catch (fsError) {
    console.error(`[ORPHANED_CLEANUP_ALERT] Failed to delete file on disk. storageKey: ${attachment.storageKey}`, fsError);
  }

  return { success: true };
}
