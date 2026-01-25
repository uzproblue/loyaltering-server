# VAPID Keys Setup Guide

VAPID (Voluntary Application Server Identification) keys are required for web push notifications. These keys identify your application server to push services.

## How to Generate VAPID Keys

### Option 1: Using the provided script (Recommended)

1. Make sure dependencies are installed:
   ```bash
   yarn install
   ```

2. Run the generation script:
   ```bash
   yarn generate-vapid-keys
   ```
   
   Or directly:
   ```bash
   node generate-vapid-keys.js
   ```

3. The script will output your keys. Copy them to your `.env` file.

### Option 2: Using npx (if you have npm/npx)

```bash
npx web-push generate-vapid-keys
```

### Option 3: Using an online generator

Visit: https://vapidkeys.com/ or https://steveseguin.github.io/vapid/

## Setting Up Your .env File

After generating the keys, add them to your `server/.env` file:

```env
VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
VAPID_SUBJECT=mailto:your-email@example.com
```

### Important Notes:

1. **VAPID_SUBJECT**: This should be a `mailto:` URL with your contact email. This is used to contact you if there are issues with your push service.

2. **Keep Private Key Secret**: Never commit the `VAPID_PRIVATE_KEY` to version control. It should only exist in your `.env` file (which should be in `.gitignore`).

3. **Public Key**: The public key is safe to expose and will be sent to the client-side application.

4. **One-Time Generation**: Generate these keys once and reuse them. Don't regenerate them unless necessary, as existing push subscriptions will break.

## After Setup

1. Add the keys to your `.env` file
2. Restart your server
3. The server will automatically use these keys when sending push notifications

## Verification

You can verify the keys are loaded by checking the server logs. If keys are missing, you'll see an error when trying to send notifications.

To test if the public key is accessible:
```bash
curl http://localhost:3000/api/notifications/vapid-key
```

This should return the public key (which is safe to expose).
