import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standard local uploads directory path
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure directory exists programmatically
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Saves binary buffer to disk under a secure generated UUID key.
 * @param {Express.Multer.File} file 
 * @returns {Promise<string>} unique storageKey
 */
export async function saveFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const uniqueKey = `${crypto.randomUUID()}${ext}`;
  
  // Resolve path defensively using basename
  const safeName = path.basename(uniqueKey);
  const targetPath = path.join(UPLOADS_DIR, safeName);
  
  await fs.promises.writeFile(targetPath, file.buffer);
  return uniqueKey;
}

/**
 * Removes file from local filesystem.
 * @param {string} storageKey 
 */
export async function deleteFile(storageKey) {
  const safeName = path.basename(storageKey);
  const targetPath = path.join(UPLOADS_DIR, safeName);
  
  try {
    await fs.promises.unlink(targetPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Treat cleanup as successful if file is already missing
      console.warn(`File not found for deletion (already missing): ${storageKey}`);
      return;
    }
    // Re-throw other unexpected filesystem errors
    throw error;
  }
}

/**
 * Checks file existence and returns absolute path for download streaming.
 * @param {string} storageKey 
 * @returns {string} path
 */
export function getFilePath(storageKey) {
  const safeName = path.basename(storageKey);
  const targetPath = path.join(UPLOADS_DIR, safeName);
  
  if (!fs.existsSync(targetPath)) {
    const error = new Error('Physical file missing on disk.');
    error.code = 'ENOENT';
    throw error;
  }
  
  return targetPath;
}
