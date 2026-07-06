import { serializeToCSV } from '../../utils/csv.js';

export const TASK_CSV_HEADERS = [
  'Task ID',
  'Title',
  'Description',
  'Status',
  'Priority',
  'Assignee Name',
  'Assignee Email',
  'Due Date',
  'Created At',
  'Updated At'
];

export function mapTaskToCsvRow(task) {
  return [
    task.id,
    task.title,
    task.description || '',
    task.status,
    task.priority,
    task.assignee ? task.assignee.name : 'Unassigned',
    task.assignee ? task.assignee.email : '',
    task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
    new Date(task.createdAt).toISOString(),
    new Date(task.updatedAt).toISOString()
  ];
}

export function tasksToCSV(tasks) {
  const rows = tasks.map(mapTaskToCsvRow);
  return serializeToCSV(TASK_CSV_HEADERS, rows);
}
