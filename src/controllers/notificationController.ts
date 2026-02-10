import { Request, Response } from 'express';
import { prisma } from '../utils/db';
import {
  ApiResponse,
  TypedRequest,
  CreateNotificationPermissionRequest,
  SendNotificationRequest,
} from '../types';
import { sendNotificationToRestaurant, getVapidPublicKey } from '../services/notificationService';

export const createNotificationPermission = async (
  req: TypedRequest<CreateNotificationPermissionRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { customerId, restaurantId, permissionGranted, pushSubscription } = req.body;

    if (!customerId || !restaurantId) {
      res.status(400).json({
        success: false,
        message: 'Customer ID and Restaurant ID are required',
      });
      return;
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
      return;
    }

    const permission = await prisma.notificationPermission.upsert({
      where: {
        customerId_restaurantId: { customerId, restaurantId },
      },
      create: {
        customerId,
        restaurantId,
        permissionGranted: permissionGranted ?? false,
        pushSubscription: (pushSubscription as object) || undefined,
      },
      update: {
        permissionGranted: permissionGranted ?? false,
        pushSubscription: (pushSubscription as object) || undefined,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Notification permission saved successfully',
      data: permission,
    });
  } catch (error: any) {
    console.error('Error creating notification permission:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving notification permission',
      error: error.message,
    });
  }
};

export const getNotificationPermission = async (
  req: Request,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { customerId, restaurantId } = req.params;

    if (!customerId || !restaurantId) {
      res.status(400).json({
        success: false,
        message: 'Customer ID and Restaurant ID are required',
      });
      return;
    }

    const permission = await prisma.notificationPermission.findUnique({
      where: {
        customerId_restaurantId: { customerId, restaurantId },
      },
    });

    if (!permission) {
      res.status(200).json({
        success: true,
        message: 'No permission found',
        data: { permissionGranted: false },
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Notification permission retrieved successfully',
      data: permission,
    });
  } catch (error: any) {
    console.error('Error fetching notification permission:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notification permission',
      error: error.message,
    });
  }
};

export const deleteNotificationPermission = async (
  req: Request,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { customerId, restaurantId } = req.params;

    if (!customerId || !restaurantId) {
      res.status(400).json({
        success: false,
        message: 'Customer ID and Restaurant ID are required',
      });
      return;
    }

    try {
      await prisma.notificationPermission.delete({
        where: {
          customerId_restaurantId: { customerId, restaurantId },
        },
      });
    } catch (e: any) {
      if (e.code === 'P2025') {
        res.status(404).json({
          success: false,
          message: 'Notification permission not found',
        });
        return;
      }
      throw e;
    }

    res.status(200).json({
      success: true,
      message: 'Notification permission revoked successfully',
    });
  } catch (error: any) {
    console.error('Error deleting notification permission:', error);
    res.status(500).json({
      success: false,
      message: 'Error revoking notification permission',
      error: error.message,
    });
  }
};

export const sendNotification = async (
  req: TypedRequest<SendNotificationRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { restaurantId, title, body, data, customerIds } = req.body;

    if (!restaurantId || !title || !body) {
      res.status(400).json({
        success: false,
        message: 'Restaurant ID, title, and body are required',
      });
      return;
    }

    if (customerIds && Array.isArray(customerIds) && customerIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'customerIds array cannot be empty. Omit it to send to all customers.',
      });
      return;
    }

    const result = await sendNotificationToRestaurant({
      restaurantId,
      title,
      body,
      data,
      customerIds,
    });

    const targetDescription =
      customerIds && customerIds.length > 0
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
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    });
  } catch (error: any) {
    console.error('Error sending notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending notification',
      error: error.message,
    });
  }
};

export const getVapidKey = async (
  _req: Request,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const publicKey = getVapidPublicKey();
    res.status(200).json({
      success: true,
      message: 'VAPID key retrieved successfully',
      data: { publicKey },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving VAPID key',
      error: error.message,
    });
  }
};
