import { Response } from 'express';
import { prisma } from '../utils/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { isR2Configured } from '../config/r2';
import {
  uploadBuffer,
  validateImageBuffer,
  getPresignedUrl,
  MAX_IMAGE_SIZE_BYTES,
} from '../services/r2Service';

export type UploadImageType = 'avatar' | 'restaurant-header' | 'notification';

/**
 * Parse base64 data URL to buffer and content type.
 * Expects format: data:image/png;base64,...
 */
function parseBase64Image(dataUrl: string): { buffer: Buffer; contentType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid image format. Expected data URL: data:image/xxx;base64,...');
  }
  const contentType = match[1].trim().toLowerCase();
  const base64 = match[2];
  if (!base64) throw new Error('Empty base64 data');
  const buffer = Buffer.from(base64, 'base64');
  return { buffer, contentType };
}

/**
 * Build R2 object key from type and context.
 */
function buildKey(
  type: UploadImageType,
  userId: string,
  ext: string,
  restaurantId?: string,
  id?: string
): string {
  const timestamp = Date.now();
  switch (type) {
    case 'avatar':
      return `avatars/${userId}_${timestamp}.${ext}`;
    case 'restaurant-header':
      if (!restaurantId) throw new Error('restaurantId is required for restaurant-header upload');
      return `restaurants/${restaurantId}/header_${timestamp}.${ext}`;
    case 'notification':
      return `notifications/${id || userId}_${timestamp}.${ext}`;
    default:
      throw new Error(`Unknown upload type: ${type}`);
  }
}

/**
 * Upload image (base64 or multipart). Returns { url, key }.
 * Query: type=avatar | restaurant-header | notification
 * Body (JSON): image (data URL) and optionally restaurantId for restaurant-header.
 * Or multipart: field "image" or "file".
 */
export const uploadImage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!isR2Configured()) {
      res.status(503).json({
        success: false,
        message: 'File upload is not configured (R2 missing)',
      });
      return;
    }

    const userId = req.user?.userId;
    const userEmail = req.user?.email;
    if (!userId && !userEmail) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const body = (req as AuthenticatedRequest & { body?: { image?: string; type?: string; restaurantId?: string } }).body;
    const type = ((req as any).query?.type as string) || (body?.type as string);
    if (!type || !['avatar', 'restaurant-header', 'notification'].includes(type)) {
      res.status(400).json({
        success: false,
        message: 'Query param type is required: avatar | restaurant-header | notification',
      });
      return;
    }

    let buffer: Buffer;
    let contentType: string;
    const resolvedUserId =
      userId ||
      (await prisma.user.findFirst({ where: { email: userEmail }, select: { id: true } }).then((u: { id: string } | null) => u?.id));

    if (body?.image && typeof body.image === 'string') {
      const parsed = parseBase64Image(body.image);
      buffer = parsed.buffer;
      contentType = parsed.contentType;
    } else if ((req as any).file?.buffer) {
      const file = (req as any).file;
      buffer = file.buffer;
      contentType = file.mimetype || 'application/octet-stream';
    } else {
      res.status(400).json({
        success: false,
        message: 'Provide image as JSON body { image: "data:image/png;base64,..." } or multipart field "image"',
      });
      return;
    }

    if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
      res.status(400).json({
        success: false,
        message: `Image must be smaller than ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB`,
      });
      return;
    }

    const { ext } = validateImageBuffer(buffer, contentType) as { contentType: string; ext: string };

    let restaurantId: string | undefined;
    if (type === 'restaurant-header') {
      restaurantId = (body?.restaurantId || (req as any).query?.restaurantId) as string;
      if (!restaurantId) {
        res.status(400).json({ success: false, message: 'restaurantId is required for restaurant-header upload' });
        return;
      }
      const user = await prisma.user.findUnique({
        where: { id: resolvedUserId || userId || '' },
        select: { restaurantId: true, role: true },
      });
      const userRestaurantId = user?.restaurantId ?? undefined;
      if (userRestaurantId !== restaurantId && user?.role !== 'admin') {
        res.status(403).json({ success: false, message: 'You can only upload header for your restaurant' });
        return;
      }
    }

    const key = buildKey(type as UploadImageType, resolvedUserId || userId || 'anon', ext, restaurantId, undefined);

    const result = await uploadBuffer(key, buffer, contentType);

    res.status(200).json({
      success: true,
      data: {
        url: result.url,
        key: result.key,
      },
    });
  } catch (err: any) {
    console.error('Upload error:', err);
    const message = err.message || 'Upload failed';
    const status = err.message?.includes('Invalid') || err.message?.includes('smaller') ? 400 : 500;
    res.status(status).json({ success: false, message });
  }
};

/**
 * Redirect to presigned URL for private bucket.
 * GET /api/upload/files/:encodedKey - encodedKey is base64url of the R2 key (e.g. avatars/user_123.jpg).
 */
export const getFileByKey = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!isR2Configured()) {
      res.status(503).json({ success: false, message: 'File serving is not configured' });
      return;
    }
    const encodedKey = (req as any).params?.encodedKey;
    if (!encodedKey) {
      res.status(400).json({ success: false, message: 'Missing encodedKey' });
      return;
    }
    const key = Buffer.from(
      encodedKey.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8');
    const url = await getPresignedUrl(key);
    res.redirect(302, url);
  } catch (err: any) {
    console.error('getFileByKey error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to get file URL' });
  }
};
