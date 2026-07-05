import * as attachmentService from './attachment.service.js';

export async function uploadFile(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const taskId = parseInt(req.params.taskId, 10);
    
    const attachment = await attachmentService.createAttachment(projectId, taskId, req.file, req.user.id);
    return res.status(201).json({
      success: true,
      attachment
    });
  } catch (error) {
    next(error);
  }
}

export async function list(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const taskId = parseInt(req.params.taskId, 10);

    const attachments = await attachmentService.getAttachmentsForTask(projectId, taskId);
    return res.status(200).json({
      success: true,
      attachments
    });
  } catch (error) {
    next(error);
  }
}

export async function download(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const taskId = parseInt(req.params.taskId, 10);
    const attachmentId = parseInt(req.params.attachmentId, 10);

    const { filePath, originalName } = await attachmentService.getAttachmentPath(projectId, taskId, attachmentId);
    
    // Sanitize the stored display filename by removing path components and control characters
    const sanitizedName = originalName
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/[\x00-\x1F\x7F]/g, '_');

    // Use Express res.download to safely generate download disposition
    return res.download(filePath, sanitizedName);
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const taskId = parseInt(req.params.taskId, 10);
    const attachmentId = parseInt(req.params.attachmentId, 10);

    await attachmentService.deleteAttachment(projectId, taskId, attachmentId, req.user.id, req.projectMember.role);
    return res.status(200).json({
      success: true
    });
  } catch (error) {
    next(error);
  }
}
