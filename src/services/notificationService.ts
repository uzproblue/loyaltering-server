import webpush from 'web-push';
import { prisma } from '../utils/db';
import type { NotificationPermissionDocument, SendNotificationRequest } from '../types';

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

export const sendNotificationToRestaurant = async (
  request: SendNotificationRequest
): Promise<{ sent: number; failed: number; errors: string[] }> => {
  const { restaurantId, title, body, data, customerIds } = request;

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error(
      'VAPID keys are not configured. Please set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.'
    );
  }

  const where: { restaurantId: string; permissionGranted: boolean; customerId?: { in: string[] } } = {
    restaurantId,
    permissionGranted: true,
  };
  if (customerIds && customerIds.length > 0) {
    where.customerId = { in: customerIds };
  }

  const permissions = await prisma.notificationPermission.findMany({
    where,
  });

  if (permissions.length === 0) {
    const message =
      customerIds && customerIds.length > 0
        ? 'No matching customers found with the provided customer IDs'
        : 'No customers found who granted permission for this restaurant';
    return { sent: 0, failed: 0, errors: [message] };
  }

  const permissionsWithSubscription = permissions.filter(
    (p: NotificationPermissionDocument) =>
      p.pushSubscription && typeof (p.pushSubscription as any)?.endpoint === 'string'
  );

  if (permissionsWithSubscription.length === 0) {
    return {
      sent: 0,
      failed: 0,
      errors: [
        `No push subscriptions found. ${permissions.length} user(s) granted permission but need to set up push subscriptions (service worker required).`,
      ],
    };
  }

  const payload: NotificationPayload = {
    title,
    body,
    data: data || {},
    icon: data?.icon,
    badge: data?.badge,
    image: data?.image,
  };

  const results = await Promise.allSettled(
    permissionsWithSubscription.map(async (permission: NotificationPermissionDocument) => {
      const sub = permission.pushSubscription as any;
      if (!sub?.endpoint) {
        return { success: false, error: 'No push subscription' };
      }

      try {
        const subscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys?.p256dh,
            auth: sub.keys?.auth,
          },
        };

        await webpush.sendNotification(subscription, JSON.stringify(payload));
        return { success: true };
      } catch (error: any) {
        console.error(
          `[Notification Service] Error sending notification to customer ${permission.customerId}:`,
          error.message
        );
        if (error.statusCode === 410 || error.statusCode === 404) {
          await prisma.notificationPermission.update({
            where: { id: permission.id },
            data: { pushSubscription: undefined },
          });
        }
        return { success: false, error: error.message };
      }
    })
  );

  const sent = results.filter(
    (r: any) => r.status === 'fulfilled' && r.value?.success
  ).length;
  const failed = results.length - sent;
  const errors = results
    .filter(
      (r: any) =>
        r.status === 'rejected' || (r.status === 'fulfilled' && !r.value?.success)
    )
    .map((r: any) =>
      r.status === 'rejected' ? (r as PromiseRejectedResult).reason?.message : (r as PromiseFulfilledResult<any>).value?.error
    )
    .filter(Boolean) as string[];

  return { sent, failed, errors };
};

export const getVapidPublicKey = (): string => {
  if (!vapidPublicKey) {
    throw new Error('VAPID public key is not configured');
  }
  return vapidPublicKey;
};
