// Generate VAPID keys for web push notifications
// Run this with: yarn node generate-vapid-keys.js
// or: node -r ./node_modules/web-push generate-vapid-keys.js

const webpush = require('web-push');

// Generate VAPID keys
const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n=== VAPID Keys Generated ===\n');
console.log('Add these to your .env file:\n');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:your-email@example.com\n`);
console.log('Note: Replace "your-email@example.com" with your actual email address.\n');
console.log('⚠️  IMPORTANT: Keep the private key secret! Never commit it to version control.\n');
console.log('📝 After adding to .env, restart your server for the changes to take effect.\n');
