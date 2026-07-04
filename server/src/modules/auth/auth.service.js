import bcrypt from 'bcryptjs';
import prisma from '../../config/db.js';
import { normalizeEmail } from './auth.validation.js';

/**
 * Strips passwordHash and returns a safe user object
 * @param {object} user 
 * @returns {object|null}
 */
export const sanitizeUser = (user) => {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
};

/**
 * Creates a new user in the database
 */
export const createUser = async ({ name, email, password }) => {
  const normalized = normalizeEmail(email);

  // Check for duplicate emails
  const existingUser = await prisma.user.findUnique({
    where: { email: normalized },
  });

  if (existingUser) {
    const error = new Error('Email is already registered.');
    error.statusCode = 400;
    throw error;
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalized,
      passwordHash: hash,
      systemRole: 'MEMBER',
    },
  });

  return sanitizeUser(user);
};

/**
 * Authenticates user credentials
 */
export const authenticateUser = async ({ email, password }) => {
  const normalized = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: normalized },
  });

  if (!user) {
    return null;
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return null;
  }

  return sanitizeUser(user);
};

/**
 * Resolves user profile details by ID
 */
export const getUserById = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });
  return sanitizeUser(user);
};
