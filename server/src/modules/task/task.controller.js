import * as taskService from './task.service.js';

export async function create(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const task = await taskService.createTask(projectId, req.body, req.user.id);
    return res.status(201).json({
      success: true,
      task
    });
  } catch (error) {
    next(error);
  }
}

export async function list(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const tasks = await taskService.getTasksForProject(projectId, req.query);
    return res.status(200).json({
      success: true,
      tasks
    });
  } catch (error) {
    next(error);
  }
}

export async function get(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const taskId = parseInt(req.params.taskId, 10);
    const task = await taskService.getTaskById(projectId, taskId);
    return res.status(200).json({
      success: true,
      task
    });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const taskId = parseInt(req.params.taskId, 10);
    const task = await taskService.updateTask(projectId, taskId, req.body, req.user.id);
    return res.status(200).json({
      success: true,
      task
    });
  } catch (error) {
    next(error);
  }
}
