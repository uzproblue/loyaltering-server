import { Request, Response } from 'express';
import mongoose from 'mongoose';
import NotificationPermission from '../models/NotificationPermission';
import Customer from '../models/Customer';
import {
  ApiResponse,
  TypedRequest,
  CreateNotificationPermissionRequest,
  SendNotificationRequest
} from '../types';
import { sendNotificationToRestaurant, getVapidPublicKey } from '../services/notificationService';

/**
 * Store notification permission for a customer-restaurant combination
 */
export const createNotificationPermission = async (
  req: TypedRequest<CreateNotificationPermissionRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { customerId, restaurantId, permissionGranted, pushSubscription } = req.body;

    // Validate required fields
    if (!customerId || !restaurantId) {
      res.status(400).json({
        success: false,
        message: 'Customer ID and Restaurant ID are required'
      });
      return;
    }

    // Validate customerId format
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid customer ID format'
      });
      return;
    }

    // Verify customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
      return;
    }

    // Create or update notification permission
    const permission = await NotificationPermission.findOneAndUpdate(
      { customerId, restaurantId },
      {
        customerId,
        restaurantId,
        permissionGranted: permissionGranted ?? false,
        pushSubscription: pushSubscription || undefined,
        updatedAt: new Date()
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    res.status(201).json({
      success: true,
      message: 'Notification permission saved successfully',
      data: permission
    });
  } catch (error: any) {
    console.error('Error creating notification permission:', error);

    if (error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map((err: any) => err.message)
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Error saving notification permission',
      error: error.message
    });
  }
};

/**
 * Get notification permission for a customer-restaurant combination
 */
export const getNotificationPermission = async (
  req: Request,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { customerId, restaurantId } = req.params;

    if (!customerId || !restaurantId) {
      res.status(400).json({
        success: false,
        message: 'Customer ID and Restaurant ID are required'
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid customer ID format'
      });
      return;
    }

    const permission = await NotificationPermission.findOne({
      customerId,
      restaurantId
    });

    if (!permission) {
      res.status(200).json({
        success: true,
        message: 'No permission found',
        data: { permissionGranted: false }
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Notification permission retrieved successfully',
      data: permission
    });
  } catch (error: any) {
    console.error('Error fetching notification permission:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notification permission',
      error: error.message
    });
  }
};

/**
 * Delete/revoke notification permission for a customer-restaurant combination
 */
export const deleteNotificationPermission = async (
  req: Request,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { customerId, restaurantId } = req.params;

    if (!customerId || !restaurantId) {
      res.status(400).json({
        success: false,
        message: 'Customer ID and Restaurant ID are required'
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid customer ID format'
      });
      return;
    }

    const result = await NotificationPermission.findOneAndDelete({
      customerId,
      restaurantId
    });

    if (!result) {
      res.status(404).json({
        success: false,
        message: 'Notification permission not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Notification permission revoked successfully'
    });
  } catch (error: any) {
    console.error('Error deleting notification permission:', error);
    res.status(500).json({
      success: false,
      message: 'Error revoking notification permission',
      error: error.message
    });
  }
};

/**
 * Send notifications to customers who granted permission for a specific restaurant
 * Can send to all customers or a selected group of customers
 */
export const sendNotification = async (
  req: TypedRequest<SendNotificationRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { restaurantId, title, body, data, customerIds } = req.body;

    if (!restaurantId || !title || !body) {
      res.status(400).json({
        success: false,
        message: 'Restaurant ID, title, and body are required'
      });
      return;
    }

    // Validate customerIds if provided
    if (customerIds && Array.isArray(customerIds)) {
      if (customerIds.length === 0) {
        res.status(400).json({
          success: false,
          message: 'customerIds array cannot be empty. Omit it to send to all customers.'
        });
        return;
      }

      // Validate all customerIds are valid ObjectIds
      const invalidIds = customerIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
      if (invalidIds.length > 0) {
        res.status(400).json({
          success: false,
          message: `Invalid customer IDs: ${invalidIds.join(', ')}`
        });
        return;
      }
    }

    // Send notifications using web-push
    const result = await sendNotificationToRestaurant({
      restaurantId,
      title,
      body,
      data,
      customerIds
    });

    const targetDescription = customerIds && customerIds.length > 0
      ? `${customerIds.length} selected customer(s)`
      : 'all subscribers';

    res.status(200).json({
      success: true,
      message: `Notification sent to ${result.sent} ${targetDescription}`,
      data: {
        restaurantId,
        sent: result.sent,
        failed: result.failed,
        targetCount: customerIds ? customerIds.length : undefined,
        errors: result.errors.length > 0 ? result.errors : undefined
      }
    });
  } catch (error: any) {
    console.error('Error sending notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending notification',
      error: error.message
    });
  }
};

/**
 * Get VAPID public key for client-side push subscription
 */
export const getVapidKey = async (
  _req: Request,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const publicKey = getVapidPublicKey();
    res.status(200).json({
      success: true,
      message: 'VAPID key retrieved successfully',
      data: { publicKey }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving VAPID key',
      error: error.message
    });
  }
};
