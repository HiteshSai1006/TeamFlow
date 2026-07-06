import * as taskService from './task.service.js';
import { tasksToCSV } from './task.export.js';

export async function create(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const result = await taskService.createTask(projectId, req.body, req.user.id);
    return res.status(201).json({
      success: true,
      task: result
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

export async function addRelation(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const sourceTaskId = parseInt(req.params.taskId, 10);
    const { targetTaskId } = req.body;
    
    const result = await taskService.addDependency(projectId, sourceTaskId, parseInt(targetTaskId, 10), req.user.id);
    return res.status(200).json({
      success: true,
      relation: result.relation,
      warnings: result.warnings
    });
  } catch (error) {
    next(error);
  }
}

export async function removeRelation(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const targetTaskId = parseInt(req.params.taskId, 10);
    const relationId = parseInt(req.params.relationId, 10);
    
    const result = await taskService.removeDependency(projectId, targetTaskId, relationId, req.user.id);
    return res.status(200).json({
      success: true,
      warnings: result.warnings
    });
  } catch (error) {
    next(error);
  }
}

export async function exportCSV(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const tasks = await taskService.getTasksForProject(projectId, req.query);
    const csvContent = tasksToCSV(tasks);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `project-${projectId}-tasks-${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
}
