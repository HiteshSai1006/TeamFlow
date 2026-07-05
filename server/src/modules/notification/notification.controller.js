import * as notificationService from './notification.service.js';

export async function list(req, res, next) {
  try {
    const list = await notificationService.getNotificationsForUser(req.user.id);
    return res.status(200).json({ notifications: list });
  } catch (err) {
    next(err);
  }
}

export async function read(req, res, next) {
  try {
    const notificationId = Number(req.params.id);
    if (isNaN(notificationId)) {
      return res.status(400).json({ message: 'Invalid notification ID.' });
    }
    const updated = await notificationService.markNotificationAsRead(notificationId, req.user.id);
    return res.status(200).json({ notification: updated });
  } catch (err) {
    next(err);
  }
}

export async function readAll(req, res, next) {
  try {
    await notificationService.markAllNotificationsAsRead(req.user.id);
    return res.status(200).json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
}

export async function getPref(req, res, next) {
  try {
    const pref = await notificationService.getUserPreference(req.user.id);
    return res.status(200).json({ preference: pref });
  } catch (err) {
    next(err);
  }
}

export async function updatePref(req, res, next) {
  try {
    const emailOptOut = !!req.body.emailOptOut;
    const pref = await notificationService.updateUserPreference(req.user.id, emailOptOut);
    return res.status(200).json({ preference: pref });
  } catch (err) {
    next(err);
  }
}
