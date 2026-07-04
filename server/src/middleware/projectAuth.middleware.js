import prisma from '../config/db.js';

/**
 * Middleware to enforce project membership and role authorization.
 * @param {string[]} allowedRoles - Array of roles allowed to access the route ('OWNER', 'MANAGER', 'MEMBER')
 */
export function requireProjectRole(allowedRoles) {
  return async (req, res, next) => {
    try {
      const projectIdVal = req.params.projectId;
      if (!projectIdVal) {
        return res.status(400).json({
          success: false,
          status: 'error',
          statusCode: 400,
          message: 'Project ID parameter is required.'
        });
      }

      const projectId = parseInt(projectIdVal, 10);
      if (isNaN(projectId)) {
        return res.status(400).json({
          success: false,
          status: 'error',
          statusCode: 400,
          message: 'Invalid project ID format.'
        });
      }

      // Query membership
      const member = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: req.user.id
          }
        },
        include: {
          project: true
        }
      });

      if (!member) {
        return res.status(403).json({
          success: false,
          status: 'error',
          statusCode: 403,
          message: 'Access denied. You are not a member of this project.'
        });
      }

      if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(member.role)) {
        return res.status(403).json({
          success: false,
          status: 'error',
          statusCode: 403,
          message: `Access denied. Requires role: ${allowedRoles.join(' or ')}.`
        });
      }

      // Attach information for controller use
      req.projectMember = member;
      req.project = member.project;

      next();
    } catch (error) {
      next(error);
    }
  };
}
