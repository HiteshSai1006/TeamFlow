import multer from 'multer';
import path from 'path';

// Exact MIME to Extension mappings
const ALLOWED_MIME_EXTS = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/zip': ['.zip']
};

const fileFilter = (req, file, cb) => {
  // 1. Validate MIME type
  const allowedExts = ALLOWED_MIME_EXTS[file.mimetype];
  if (!allowedExts) {
    const err = new Error('File type rejected. Only PNG, JPEG, WEBP, PDF, TXT, CSV, DOC, DOCX, and ZIP files are allowed.');
    err.statusCode = 400;
    return cb(err, false);
  }

  // 2. Validate Extension matches the MIME type exactly
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExts.includes(ext)) {
    const err = new Error(`Mismatched MIME type and extension. Extension ${ext} is not allowed for MIME type ${file.mimetype}.`);
    err.statusCode = 400;
    return cb(err, false);
  }

  cb(null, true);
};

// Memory storage to keep Multer decoupled from storage service logic
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1 // exactly one file per request
  }
});

const singleUpload = upload.single('file');

/**
 * Middleware wrapper that catches Multer errors and returns 400 Bad Request client errors.
 */
export function handleMulterUpload(req, res, next) {
  singleUpload(req, res, (err) => {
    if (err) {
      // 1. File size limit exceeded
      if (err.code === 'LIMIT_FILE_SIZE') {
        const error = new Error('File size too large. Maximum limit is 5 MB.');
        error.statusCode = 400;
        return next(error);
      }
      // 2. Too many files
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        const error = new Error('Only one file per request is supported.');
        error.statusCode = 400;
        return next(error);
      }
      // 3. Custom file filter errors
      if (err.statusCode) {
        return next(err);
      }
      // General fallback
      err.statusCode = 400;
      return next(err);
    }

    // 4. Missing file check
    if (!req.file) {
      const error = new Error('No file uploaded.');
      error.statusCode = 400;
      return next(error);
    }

    next();
  });
}
