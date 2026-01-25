import express, { Router } from 'express';
import * as notificationController from '../controllers/notificationController';

const router: Router = express.Router();

/**
 * @swagger
 * /api/notifications/permission:
 *   post:
 *     summary: Store notification permission for a customer-restaurant combination
 *     tags: [Notifications]
 *     description: Create or update notification permission and push subscription for a customer at a specific restaurant
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerId
 *               - restaurantId
 *               - permissionGranted
 *             properties:
 *               customerId:
 *                 type: string
 *                 description: Customer ID
 *               restaurantId:
 *                 type: string
 *                 description: Restaurant ID
 *               permissionGranted:
 *                 type: boolean
 *                 description: Whether permission was granted
 *               pushSubscription:
 *                 type: object
 *                 properties:
 *                   endpoint:
 *                     type: string
 *                   keys:
 *                     type: object
 *                     properties:
 *                       p256dh:
 *                         type: string
 *                       auth:
 *                         type: string
 *     responses:
 *       201:
 *         description: Permission saved successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Customer not found
 */
router.post('/permission', notificationController.createNotificationPermission);

/**
 * @swagger
 * /api/notifications/permission/{customerId}/{restaurantId}:
 *   get:
 *     summary: Get notification permission for a customer-restaurant combination
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Permission status retrieved
 */
router.get('/permission/:customerId/:restaurantId', notificationController.getNotificationPermission);

/**
 * @swagger
 * /api/notifications/permission/{customerId}/{restaurantId}:
 *   delete:
 *     summary: Revoke notification permission for a customer-restaurant combination
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Permission revoked successfully
 *       404:
 *         description: Permission not found
 */
router.delete('/permission/:customerId/:restaurantId', notificationController.deleteNotificationPermission);

/**
 * @swagger
 * /api/notifications/send:
 *   post:
 *     summary: Send notifications to customers who granted permission for a restaurant
 *     tags: [Notifications]
 *     description: Send a notification to customers. If customerIds is provided, sends only to those specific customers. If omitted, sends to all customers who have granted permission for the specified restaurant.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantId
 *               - title
 *               - body
 *             properties:
 *               restaurantId:
 *                 type: string
 *                 description: Restaurant ID
 *               title:
 *                 type: string
 *                 description: Notification title
 *               body:
 *                 type: string
 *                 description: Notification body text
 *               data:
 *                 type: object
 *                 description: Additional notification data (icon, badge, image, etc.)
 *               customerIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Optional array of customer IDs to send notification to. If not provided, sends to all customers who granted permission.
 *                 example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
 *     responses:
 *       200:
 *         description: Notification sent successfully
 *       400:
 *         description: Validation error (invalid customer IDs, missing required fields, etc.)
 */
router.post('/send', notificationController.sendNotification);

/**
 * @swagger
 * /api/notifications/vapid-key:
 *   get:
 *     summary: Get VAPID public key for push subscription
 *     tags: [Notifications]
 *     description: Retrieve the VAPID public key needed for client-side push subscription
 *     responses:
 *       200:
 *         description: VAPID public key retrieved successfully
 */
router.get('/vapid-key', notificationController.getVapidKey);

export default router;
