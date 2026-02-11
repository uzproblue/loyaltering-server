import { Response } from 'express';
import { prisma } from '../utils/db';
import { ApiResponse, TypedRequest } from '../types';
import {
  createGoogleWalletSaveUrl,
  isGoogleWalletConfigured,
  type CustomerWalletInfo,
} from '../services/googleWalletService';

export interface GooglePassRequest {
  customerId: string;
  restaurantId: string;
}

/**
 * POST /api/wallet/google-pass
 * Returns Add to Google Wallet save URL for the given customer.
 * Customer must exist and belong to the given restaurant.
 */
export const createGooglePass = async (
  req: TypedRequest<GooglePassRequest>,
  res: Response<ApiResponse<{ saveUrl: string }>>
): Promise<void> => {
  try {
    if (!isGoogleWalletConfigured()) {
      res.status(503).json({
        success: false,
        message: 'Google Wallet is not configured on this server.',
      });
      return;
    }

    const { customerId, restaurantId } = req.body;

    if (!customerId || typeof customerId !== 'string' || !customerId.trim()) {
      res.status(400).json({
        success: false,
        message: 'customerId is required',
      });
      return;
    }
    if (!restaurantId || typeof restaurantId !== 'string' || !restaurantId.trim()) {
      res.status(400).json({
        success: false,
        message: 'restaurantId is required',
      });
      return;
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId.trim() },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            signupPageConfig: true,
          },
        },
      },
    });

    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
      return;
    }

    if (customer.restaurantId !== restaurantId.trim()) {
      res.status(403).json({
        success: false,
        message: 'Customer does not belong to this restaurant',
      });
      return;
    }

    const restaurant = customer.restaurant;
    const restaurantName = restaurant?.name ?? 'Loyalty Card';
    const signupConfig = (restaurant?.signupPageConfig as { headerImage?: string } | null) ?? {};
    const logoUrl = typeof signupConfig.headerImage === 'string' ? signupConfig.headerImage : undefined;
    const heroImageUrl = logoUrl; // use same image as hero when available

    const info: CustomerWalletInfo = {
      customerId: customer.id,
      name: customer.name ?? customer.email.split('@')[0] ?? 'Member',
      memberCode: customer.memberCode,
      restaurantName,
      restaurantId: customer.restaurantId,
      logoUrl,
      heroImageUrl,
    };

    const saveUrl = createGoogleWalletSaveUrl(info);

    res.status(200).json({
      success: true,
      message: 'Google Wallet pass created',
      data: { saveUrl },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create Google Wallet pass';
    console.error('[walletController] createGooglePass:', message);
    res.status(500).json({
      success: false,
      message,
    });
  }
};
