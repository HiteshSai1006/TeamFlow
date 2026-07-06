import prisma from '../../config/db.js';

export async function getPreferences(req, res, next) {
  try {
    const userId = req.user.id;

    let pref = await prisma.userPreference.findUnique({
      where: { userId }
    });

    if (!pref) {
      pref = await prisma.userPreference.create({
        data: {
          userId,
          theme: 'LIGHT',
          emailOptOut: false
        }
      });
    }

    return res.status(200).json({
      success: true,
      preference: pref
    });
  } catch (error) {
    next(error);
  }
}

export async function updatePreferences(req, res, next) {
  try {
    const userId = req.user.id;
    const { theme } = req.body;

    if (theme !== undefined && !['LIGHT', 'DARK'].includes(theme)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid theme value.'
      });
    }

    const pref = await prisma.userPreference.upsert({
      where: { userId },
      update: {
        ...(theme !== undefined && { theme })
      },
      create: {
        userId,
        theme: theme || 'LIGHT',
        emailOptOut: false
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
