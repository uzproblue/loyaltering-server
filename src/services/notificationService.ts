import webpush from 'web-push';
import mongoose from 'mongoose';
import NotificationPermission from '../models/NotificationPermission';
import { SendNotificationRequest } from '../types';

// Initialize VAPID keys from environment variables
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  icon?: string;
  badge?: string;
  image?: string;
}

/**
 * Send notification to customers who granted permission for a specific restaurant
 * If customerIds is provided, sends only to those specific customers.
 * If customerIds is not provided, sends to all customers who granted permission.
 */
export const sendNotificationToRestaurant = async (
  request: SendNotificationRequest
): Promise<{ sent: number; failed: number; errors: string[] }> => {
  const { restaurantId, title, body, data, customerIds } = request;

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('VAPID keys are not configured. Please set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.');
  }

  // Build query: find customers who granted permission for this restaurant
  const mongoose = require('mongoose');
  const query: any = {
    restaurantId,
    permissionGranted: true
  };

  // If customerIds provided, filter to only those customers
  if (customerIds && customerIds.length > 0) {
    // Validate all customerIds are valid ObjectIds
    const validCustomerIds = customerIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id));
    
    if (validCustomerIds.length === 0) {
      return {
        sent: 0,
        failed: 0,
        errors: ['No valid customer IDs provided']
      };
    }

    if (validCustomerIds.length < customerIds.length) {
      const invalidIds = customerIds.filter((id: string) => !mongoose.Types.ObjectId.isValid(id));
      return {
        sent: 0,
        failed: 0,
        errors: [`Invalid customer IDs: ${invalidIds.join(', ')}`]
      };
    }

    query.customerId = { $in: validCustomerIds };
  }

  // Find customers who granted permission for this restaurant (and match customerIds if provided)
  const permissions = await NotificationPermission.find(query);

  if (permissions.length === 0) {
    const message = customerIds && customerIds.length > 0
      ? 'No matching customers found with the provided customer IDs'
      : 'No customers found who granted permission for this restaurant';
    return { sent: 0, failed: 0, errors: [message] };
  }

  // Filter to only those with push subscriptions (required for web push)
  const permissionsWithSubscription = permissions.filter(p => p.pushSubscription && p.pushSubscription.endpoint);
  
  if (permissionsWithSubscription.length === 0) {
    // No users with push subscriptions - they need to set up service worker
    return { 
      sent: 0, 
      failed: 0, 
      errors: [`No push subscriptions found. ${permissions.length} user(s) granted permission but need to set up push subscriptions (service worker required).`] 
    };
  }

  const payload: NotificationPayload = {
    title,
    body,
    data: data || {},
    icon: data?.icon,
    badge: data?.badge,
    image: data?.image
  };

  const results = await Promise.allSettled(
    permissionsWithSubscription.map(async (permission: any) => {
      if (!permission.pushSubscription) {
        return { success: false, error: 'No push subscription' };
      }

      try {
        const subscription = {
          endpoint: permission.pushSubscription.endpoint,
          keys: {
            p256dh: permission.pushSubscription.keys.p256dh,
            auth: permission.pushSubscription.keys.auth
          }
        };

        await webpush.sendNotification(subscription, JSON.stringify(payload));
        return { success: true };
      } catch (error: any) {
        console.error(`[Notification Service] Error sending notification to customer ${permission.customerId}:`, error.message);
        // If subscription is invalid, remove it
        if (error.statusCode === 410 || error.statusCode === 404) {
          // Subscription expired or invalid - remove it
          await NotificationPermission.findByIdAndUpdate(permission._id, {
            $unset: { pushSubscription: 1 }
          });
        }
        return { success: false, error: error.message };
      }
    })
  );

  const sent = results.filter((r: any) => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.length - sent;
  const errors = results
    .filter((r: any) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))
    .map((r: any) => r.status === 'rejected' ? r.reason?.message : r.value.error)
    .filter(Boolean) as string[];

  return { sent, failed, errors };
};

/**
 * Get VAPID public key for client-side subscription
 */
export const getVapidPublicKey = (): string => {
  if (!vapidPublicKey) {
    throw new Error('VAPID public key is not configured');
  }
  return vapidPublicKey;
};
