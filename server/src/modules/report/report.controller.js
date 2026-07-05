import * as reportService from './report.service.js';

export async function getSummary(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID.' });
    }

    const report = await reportService.getSummaryReport(projectId);
    return res.status(200).json(report);
  } catch (error) {
    next(error);
  }
}
