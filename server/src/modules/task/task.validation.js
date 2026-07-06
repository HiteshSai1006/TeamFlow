/**
 * Validates inputs for task creation.
 */
export function validateCreateTask(req, res, next) {
  const { title, priority, status, assigneeId, dueDate, parentId } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({
      success: false,
      status: 'error',
      statusCode: 400,
      message: 'Task title is required.'
    });
  }

  if (priority && !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority)) {
    return res.status(400).json({
      success: false,
      status: 'error',
      statusCode: 400,
      message: 'Invalid task priority value.'
    });
  }

  if (status && !['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'].includes(status)) {
    return res.status(400).json({
      success: false,
      status: 'error',
      statusCode: 400,
      message: 'Invalid task status value.'
    });
  }

  if (assigneeId !== undefined && assigneeId !== null) {
    const parsedId = parseInt(assigneeId, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({
        success: false,
        status: 'error',
        statusCode: 400,
        message: 'Invalid assignee ID format.'
      });
    }
  }

  if (dueDate) {
    const timestamp = Date.parse(dueDate);
    if (isNaN(timestamp)) {
      return res.status(400).json({
        success: false,
        status: 'error',
        statusCode: 400,
        message: 'Invalid due date format.'
      });
    }
  }

  if (parentId !== undefined && parentId !== null) {
    const parsedId = parseInt(parentId, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({
        success: false,
        status: 'error',
        statusCode: 400,
        message: 'Invalid parent task ID format.'
      });
    }
  }

  next();
}

/**
 * Validates inputs for task updates.
 */
export function validateUpdateTask(req, res, next) {
  const { title, priority, status, assigneeId, dueDate, parentId } = req.body;

  if (title !== undefined && (!title || !title.trim())) {
    return res.status(400).json({
      success: false,
      status: 'error',
      statusCode: 400,
      message: 'Task title cannot be empty.'
    });
  }

  if (priority && !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority)) {
    return res.status(400).json({
      success: false,
      status: 'error',
      statusCode: 400,
      message: 'Invalid task priority value.'
    });
  }

  if (status && !['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'].includes(status)) {
    return res.status(400).json({
      success: false,
      status: 'error',
      statusCode: 400,
      message: 'Invalid task status value.'
    });
  }

  if (assigneeId !== undefined && assigneeId !== null) {
    const parsedId = parseInt(assigneeId, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({
        success: false,
        status: 'error',
        statusCode: 400,
        message: 'Invalid assignee ID format.'
      });
    }
  }

  if (dueDate) {
    const timestamp = Date.parse(dueDate);
    if (isNaN(timestamp)) {
      return res.status(400).json({
        success: false,
        status: 'error',
        statusCode: 400,
        message: 'Invalid due date format.'
      });
    }
  }

  if (parentId !== undefined && parentId !== null) {
    const parsedId = parseInt(parentId, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({
        success: false,
        status: 'error',
        statusCode: 400,
        message: 'Invalid parent task ID format.'
      });
    }
  }

  next();
}
