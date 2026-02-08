# Cloudflare R2 Implementation Plan

This document outlines how to add Cloudflare R2 object storage to the server for storing and serving files/images (e.g. user avatars, restaurant header images, notification images).

---

## 1. Current State

- **User avatar**: Stored as base64 in MongoDB with ~1MB limit (see `userController.ts` — comment: "consider storing in cloud storage").
- **Restaurant `signupPageConfig.headerImage`**: String URL; no upload flow yet.
- **Notifications**: Support an `image` URL in payloads.
- **No existing file upload** or object-storage integration.

---

## 2. Cloudflare R2 Setup (Outside Code)

1. **Create R2 bucket**
   - Cloudflare Dashboard → R2 → Create bucket (e.g. `cmus-assets`).
   - Choose region if needed (optional).

2. **API credentials**
   - R2 → Manage R2 API Tokens → Create API token.
   - Permissions: Object Read & Write (or more restrictive per bucket if you use multiple).
   - Copy: **Access Key ID**, **Secret Access Key**.

3. **Account ID**
   - Found in Cloudflare Dashboard URL or Overview: **Account ID**.

4. **Public access (choose one)**
   - **Option A – Public bucket**: Enable "Public access" and (recommended) add a custom domain (e.g. `assets.yourdomain.com`) for stable public URLs.
   - **Option B – Private bucket**: Keep bucket private; serve files via **presigned URLs** from your server (more control, no custom domain required).

5. **Environment variables** (add to `.env` and hosting env)

   ```env
   R2_ACCOUNT_ID=your_account_id
   R2_ACCESS_KEY_ID=your_access_key_id
   R2_SECRET_ACCESS_KEY=your_secret_access_key
   R2_BUCKET_NAME=cmus-assets
   R2_REGION=auto
   ```

   If using **public** bucket + custom domain:

   ```env
   R2_PUBLIC_URL=https://assets.yourdomain.com
   ```

   If **private** (presigned URLs only), omit `R2_PUBLIC_URL` or leave empty.

---

## 3. Server Implementation

### 3.1 Dependencies

R2 is S3-compatible. Use the AWS SDK v3 S3 client:

```bash
yarn add @aws-sdk/client-s3
```

No extra multer dependency is strictly required if you accept base64 in JSON; add `multer` only if you want `multipart/form-data` file uploads.

### 3.2 R2 Config Module

**File:** `src/config/r2.ts`

- Read `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_REGION` (default `auto`), `R2_PUBLIC_URL` (optional).
- Export:
  - `r2Config` object (bucket, region, public base URL if set).
  - `isR2Configured(): boolean` so routes can skip upload when R2 is not set.

### 3.3 R2 Service Layer

**File:** `src/services/r2Service.ts`

- **S3 client**: Use `@aws-sdk/client-s3` with endpoint:
  - `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`
- **Key naming**: Use a prefix + unique id + extension, e.g.:
  - `avatars/{userId}_{timestamp}.{ext}`
  - `restaurants/{restaurantId}/header_{timestamp}.{ext}`
  - `notifications/{id}_{timestamp}.{ext}`
- **Functions**:
  - `uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<string>`
    - PutObject to R2; return either public URL (`R2_PUBLIC_URL` + key) or the key (for presigned URL later).
  - `deleteObject(key: string): Promise<void>`
  - `getPresignedUrl(key: string, expiresInSeconds?: number): Promise<string>` (only needed if bucket is private).
- **Validation**: Centralize allowed MIME types (e.g. `image/jpeg`, `image/png`, `image/webp`, `image/gif`) and max file size (e.g. 2MB for avatars/headers). Reject invalid uploads in the service or in a small helper used by controllers.

### 3.4 Upload API

**Option A – Dedicated upload route (recommended)**

**File:** `src/controllers/uploadController.ts`

- `uploadImage(req, res)`:
  - Accept either:
    - **Base64**: JSON body `{ image: "data:image/png;base64,..." }` (e.g. for avatar from existing profile flow), or
    - **Multipart**: one file field (e.g. `file` or `image`) using `multer` (add dependency + memory storage).
  - Validate: MIME type, size.
  - Determine "type" from query or body: e.g. `avatar`, `restaurant-header`, `notification`.
  - Build key using type + `userId` / `restaurantId` (from auth or body).
  - Call `r2Service.uploadBuffer(key, buffer, contentType)`.
  - Return JSON: `{ url: string, key: string }` (url = public URL or presigned URL if private).

**File:** `src/routes/uploadRoutes.ts`

- `POST /api/upload/image?type=avatar` (or `type=restaurant-header`, etc.)
- Auth: `authenticate` middleware so only logged-in users can upload.
- Optional: restrict `type=restaurant-header` to users who own the restaurant (check `restaurantId`).

**Option B – Inline in existing endpoints**

- **Profile update**: Instead of storing base64 in `avatar`, call R2 upload (from base64 or multipart), then set `user.avatar` to the returned URL (or key if you serve via presigned).
- **Restaurant update**: Accept `signupPageConfig.headerImage` as URL (after client uploads to R2 via Option A) or add a dedicated "upload header image" that returns URL and then PATCH restaurant with that URL.

Recommendation: **Option A** (dedicated upload route) keeps concerns separated and allows reuse for notifications and future image types.

### 3.5 Serving Files (Private Bucket)

If you do **not** set `R2_PUBLIC_URL`:

- Store only the **object key** in DB (e.g. `avatars/user123_1234567890.jpg`).
- When the app needs to show the image (e.g. profile API, restaurant API), call `r2Service.getPresignedUrl(key)` and include that URL in the response.
- Presigned URL lifetime: e.g. 1 hour (3600 seconds); adjust as needed.

Alternatively, add a server route:

- `GET /api/files/:key` (or encoded key) that generates a presigned URL and redirects (302) to it, so the client can use a stable API URL and still get the image.

### 3.6 Integrate with Existing Features

- **User avatar**
  - **Upload**: Client calls `POST /api/upload/image?type=avatar` with image; receives `url`.
  - **Profile update**: `PUT /api/users/profile` accepts `avatar: string` (URL). Store that URL in `User.avatar`. Remove base64 handling and 1MB limit from `userController.updateUserProfile`; optionally allow empty string to clear avatar.
  - **Profile get**: Keep returning `avatar` as stored (URL or presigned URL if you inject it).

- **Restaurant header image**
  - **Upload**: Client calls `POST /api/upload/image?type=restaurant-header` with `restaurantId` (body or query); server returns `url`.
  - **Restaurant update**: Client sends `signupPageConfig.headerImage = url` in existing PATCH; no change to restaurant controller except validation (allow only your R2 domain or presigned pattern if you want to lock it down).

- **Notifications**
  - Already use `image` URL; campaigns can use the same upload endpoint (e.g. `type=notification`) and pass the returned URL as `image` in the notification payload.

### 3.7 Cleanup on Delete (Optional)

- When user is deleted or clears avatar: delete object from R2 by key (if you store key; if you store full URL, parse key from URL or store key in DB).
- When restaurant header is changed: optionally delete previous object to avoid orphaned files (same idea: keep key or derive from URL).

---

## 4. Security Checklist

- Validate **content type** (whitelist: image/* only).
- Enforce **max file size** (e.g. 2MB) before upload.
- Use **authenticate** (and optionally role/restaurant ownership) on upload routes.
- **Key naming**: Include user/restaurant context so keys are predictable and you can implement per-user or per-restaurant cleanup; avoid user-controlled filenames in key (or sanitize strictly).
- **CORS**: If clients load images from R2 public URL, configure CORS on the bucket if needed.
- Keep **R2_SECRET_ACCESS_KEY** and **R2_ACCESS_KEY_ID** only in server env; never expose in client.

---

## 5. File Structure Summary

```
server/
  src/
    config/
      r2.ts              # R2 env and isR2Configured()
    services/
      r2Service.ts       # uploadBuffer, deleteObject, getPresignedUrl
    controllers/
      uploadController.ts # uploadImage (base64 or multipart)
    routes/
      uploadRoutes.ts    # POST /api/upload/image
```

- **index.ts**: Mount `uploadRoutes` at `/api/upload` (only when `isR2Configured()` if you want graceful no-op when R2 is not set).

---

## 6. Implementation Order

1. Add env vars and **config/r2.ts**.
2. Add **services/r2Service.ts** (upload, delete, optional presigned).
3. Add **uploadController** and **uploadRoutes**; mount routes; test upload and URL in response.
4. Change **userController** to accept avatar URL and remove base64 path (and optionally add "delete old R2 object" when avatar is updated).
5. Use same upload flow for **restaurant header** (client uploads then PATCHes restaurant with URL).
6. (Optional) Presigned URL helper and `GET /api/files/:key` redirect for private bucket.
7. (Optional) Cleanup on user/restaurant delete or avatar/header change.

---

## 7. Testing

- **Unit**: Mock S3 client in `r2Service`; assert correct key naming and that upload/delete/presigned are called with expected args.
- **Integration**: With real R2 credentials (or LocalStack S3), test upload → get URL → delete; test presigned URL if used.
- **E2E**: Upload avatar via API, then GET profile and confirm avatar URL loads in browser; same for restaurant header.

---

## 8. References

- [Cloudflare R2 – S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/)
- [R2 – Public bucket / custom domain](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- AWS SDK v3 for JavaScript: `@aws-sdk/client-s3` (PutObject, DeleteObject, GetObjectCommand + getSignedUrl).
