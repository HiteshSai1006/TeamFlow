import jwt from 'jsonwebtoken';
import env from '../../config/env.js';
import * as authService from './auth.service.js';
import { validateRegisterInput } from './auth.validation.js';

const COOKIE_NAME = 'token';
const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 1 Day in milliseconds

/**
 * Signs JWT token and configures secure HttpOnly cookie
 */
const sendTokenResponse = (user, statusCode, res) => {
  const token = jwt.sign(
    { id: user.id, email: user.email, systemRole: user.systemRole },
    env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  const cookieOptions = {
    expires: new Date(Date.now() + ONE_DAY_MS),
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
  };

  res
    .status(statusCode)
    .cookie(COOKIE_NAME, token, cookieOptions)
    .json({
      success: true,
      user,
    });
};

/**
 * Handles POST /api/auth/register
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const validation = validateRegisterInput(name, email, password);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(' '));
      error.statusCode = 400;
      throw error;
    }

    const user = await authService.createUser({ name, email, password });
    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

/**
 * Handles POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      const error = new Error('Email and password are required.');
      error.statusCode = 400;
      throw error;
    }

    const user = await authService.authenticateUser({ email, password });
    if (!user) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

/**
 * Handles POST /api/auth/logout
 */
export const logout = async (req, res, next) => {
  try {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handles GET /api/auth/me
 */
export const me = async (req, res, next) => {
  try {
    // req.user has already been verified and attached by auth middleware
    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
};
