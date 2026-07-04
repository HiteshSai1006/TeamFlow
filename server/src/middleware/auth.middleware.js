import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import * as authService from '../modules/auth/auth.service.js';

/**
 * Middleware protecting routes by requiring valid JWT HttpOnly session cookies
 */
export const protect = async (req, res, next) => {
  let token;

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    const error = new Error('Not authorized to access this resource.');
    error.statusCode = 401;
    return next(error);
  }

  try {
    // Verify token signature
    const decoded = jwt.verify(token, env.JWT_SECRET);

    // Retrieve safe user payload from database
    const user = await authService.getUserById(decoded.id);
    
    if (!user) {
      const error = new Error('User account no longer exists.');
      error.statusCode = 401;
      return next(error);
    }

    // Attach safe user record to request object (excludes passwordHash)
    req.user = user;
    next();
  } catch (err) {
    const error = new Error('Not authorized. Invalid or expired token.');
    error.statusCode = 401;
    return next(error);
  }
};
