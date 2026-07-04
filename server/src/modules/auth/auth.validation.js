/**
 * Validates registration inputs
 * @param {string} name 
 * @param {string} email 
 * @param {string} password 
 * @returns {{isValid: boolean, errors: string[]}}
 */
export const validateRegisterInput = (name, email, password) => {
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Name is required.');
  }

  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    errors.push('Email is required.');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      errors.push('Invalid email format.');
    }
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Normalizes email address by trimming and converting to lowercase
 * @param {string} email 
 * @returns {string}
 */
export const normalizeEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
};
