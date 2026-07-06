import prisma from '../../config/db.js';

export async function getPreference(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const userId = req.user.id;

    const pref = await prisma.projectViewPreference.findUnique({
      where: {
        userId_projectId: { userId, projectId }
      }
    });

    return res.status(200).json({
      success: true,
      viewMode: pref ? pref.viewMode : 'KANBAN'
    });
  } catch (error) {
    next(error);
  }
}

export async function updatePreference(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const userId = req.user.id;
    const { viewMode } = req.body;

    if (!['KANBAN', 'CALENDAR', 'LIST'].includes(viewMode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid viewMode.'
      });
    }

    const pref = await prisma.projectViewPreference.upsert({
      where: {
        userId_projectId: { userId, projectId }
      },
      update: {
        viewMode
      },
      create: {
        userId,
        projectId,
        viewMode
      }
    });

    return res.status(200).json({
      success: true,
      preference: pref
    });
  } catch (error) {
    next(error);
  }
}
