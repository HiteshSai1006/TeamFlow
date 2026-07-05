import * as commentService from './comment.service.js';

export async function create(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const taskId = parseInt(req.params.taskId, 10);
    const comment = await commentService.createComment(projectId, taskId, req.body.content, req.user.id);
    return res.status(201).json({
      success: true,
      comment
    });
  } catch (error) {
    next(error);
  }
}

export async function list(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const taskId = parseInt(req.params.taskId, 10);
    const comments = await commentService.getCommentsForTask(projectId, taskId, req.user.id);
    return res.status(200).json({
      success: true,
      comments
    });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const taskId = parseInt(req.params.taskId, 10);
    const commentId = parseInt(req.params.commentId, 10);
    const comment = await commentService.updateComment(projectId, taskId, commentId, req.body.content, req.user.id);
    return res.status(200).json({
      success: true,
      comment
    });
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const taskId = parseInt(req.params.taskId, 10);
    const commentId = parseInt(req.params.commentId, 10);
    await commentService.deleteComment(projectId, taskId, commentId, req.user.id);
    return res.status(200).json({
      success: true
    });
  } catch (error) {
    next(error);
  }
}
