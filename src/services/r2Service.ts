import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Config, isR2Configured } from '../config/r2';

/** Allowed image MIME types for uploads */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

/** Max file size for avatars/headers (2MB) */
export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

const extByMime: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function getS3Client(): S3Client | null {
  if (!isR2Configured() || !r2Config.endpoint) return null;
  return new S3Client({
    region: r2Config.region,
    endpoint: r2Config.endpoint,
    credentials: {
      accessKeyId: r2Config.accessKeyId,
      secretAccessKey: r2Config.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

/**
 * Validate buffer: MIME type and size. Throws if invalid.
 */
export function validateImageBuffer(
  buffer: Buffer,
  contentType: string
): { contentType: string; ext: string } {
  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`Image must be smaller than ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB`);
  }
  const normalized = contentType.split(';')[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(normalized as any)) {
    throw new Error(
      `Invalid image type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`
    );
  }
  const ext = extByMime[normalized] || 'bin';
  return { contentType: normalized, ext };
}

/**
 * Upload a buffer to R2. Returns the permanent URL (if public) or the object key.
 * Caller can use key with getPresignedUrl when bucket is private.
 */
export async function uploadBuffer(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<{ url: string; key: string }> {
  const client = getS3Client();
  if (!client) throw new Error('R2 is not configured');
  const { contentType: normalized } = validateImageBuffer(buffer, contentType);

  await client.send(
    new PutObjectCommand({
      Bucket: r2Config.bucket,
      Key: key,
      Body: buffer,
      ContentType: normalized,
    })
  );

  const url = r2Config.publicUrl
    ? `${r2Config.publicUrl}/${key}`
    : await getPresignedUrl(key);
  return { url, key };
}

/**
 * Delete an object from R2 by key.
 */
export async function deleteObject(key: string): Promise<void> {
  const client = getS3Client();
  if (!client) throw new Error('R2 is not configured');
  await client.send(
    new DeleteObjectCommand({
      Bucket: r2Config.bucket,
      Key: key,
    })
  );
}

const PRESIGNED_EXPIRES_DEFAULT = 3600; // 1 hour

/**
 * Get a presigned URL for reading an object (for private bucket).
 */
export async function getPresignedUrl(
  key: string,
  expiresInSeconds: number = PRESIGNED_EXPIRES_DEFAULT
): Promise<string> {
  const client = getS3Client();
  if (!client) throw new Error('R2 is not configured');
  const command = new GetObjectCommand({
    Bucket: r2Config.bucket,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Resolve stored avatar/header value to a URL the client can use.
 * - If value is already an absolute URL (http/https) or data URL, return as-is.
 * - Otherwise treat as R2 key: return public URL or presigned URL.
 */
export async function resolveImageUrl(stored: string): Promise<string> {
  if (!stored) return '';
  if (stored.startsWith('http://') || stored.startsWith('https://') || stored.startsWith('data:')) {
    return stored;
  }
  if (!isR2Configured()) return stored;
  if (r2Config.publicUrl) {
    return `${r2Config.publicUrl}/${stored}`;
  }
  return getPresignedUrl(stored);
}
