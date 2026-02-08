import express, { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { uploadImage, getFileByKey } from '../controllers/uploadController';
import { MAX_IMAGE_SIZE_BYTES } from '../services/r2Service';
const router: Router = express.Router();

const memoryStorage = multer.memoryStorage();
const upload = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allowed.join(', ')}`) as any, false);
    }
  },
});

/**
 * POST /api/upload/image?type=avatar|restaurant-header|notification
 * Body: JSON { image: "data:image/png;base64,..." } or multipart field "image"
 * For restaurant-header: body or query restaurantId required.
 * Returns: { success, data: { url, key } }
 */
router.post(
  '/image',
  authenticate,
  (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.startsWith('multipart/form-data')) {
      return upload.single('image')(req, res, (err: any) => {
        if (err) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: `Image must be smaller than ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB` });
          }
          return res.status(400).json({ success: false, message: err.message || 'File upload error' });
        }
        return next();
      });
    }
    return next();
  },
  uploadImage
);

/**
 * GET /api/upload/files/:key - redirect to presigned URL (for private bucket).
 * Key can contain slashes, e.g. avatars/userId_timestamp.jpg
 * Cast to any to avoid PathParams (RegExp) vs string conflict with @types/swagger-ui-express.
 */
(router as any).get(/^\/files\/(.+)$/, (req: any, res: any) => {
  req.params = { key: req.params[0] ?? req.params.key };
  return getFileByKey(req, res);
});

export default router;
