/**
 * Validates inputs for project creation.
 */
export function validateCreateProject(req, res, next) {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      status: 'error',
      statusCode: 400,
      message: 'Project name is required.'
    });
  }

  next();
}

/**
 * Validates inputs for member invitations.
 */
export function validateInviteMember(req, res, next) {
  const { email, role } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({
      success: false,
      status: 'error',
      statusCode: 400,
      message: 'Email address is required.'
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({
      success: false,
      status: 'error',
      statusCode: 400,
      message: 'Invalid email address format.'
    });
  }

  if (role && !['MANAGER', 'MEMBER', 'REVIEWER'].includes(role)) {
    return res.status(400).json({
      success: false,
      status: 'error',
      statusCode: 400,
      message: 'Invited role must be MANAGER, MEMBER, or REVIEWER.'
    });
  }

  next();
}
