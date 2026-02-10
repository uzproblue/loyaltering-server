import { Request, Response } from 'express';
import { prisma } from '../utils/db';
import { hashPassword } from '../utils/auth';
import {
  ApiResponse,
  CreateRestaurantRequest,
  UpdateRestaurantRequest,
  TypedRequest,
} from '../types';
import { AuthenticatedRequest } from '../middleware/auth';

async function findUserByIdOrEmail(userId: string | undefined, userEmail: string | undefined) {
  if (userId) return prisma.user.findUnique({ where: { id: userId } });
  if (userEmail) return prisma.user.findFirst({ where: { email: userEmail } });
  return null;
}

const generatePassword = (length: number = 12): string => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + special;
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

export const createRestaurant = async (
  req: TypedRequest<CreateRestaurantRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { name, address, phone, email, description, userId } = req.body;

    if (!name || name.trim() === '') {
      res.status(400).json({
        success: false,
        message: 'Restaurant name is required',
      });
      return;
    }

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
      });
      return;
    }

    const savedRestaurant = await prisma.restaurant.create({
      data: {
        name: name.trim(),
        address: address?.trim(),
        phone: phone?.trim(),
        email: email?.trim().toLowerCase(),
        description: description?.trim(),
        userId: userId || undefined,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Restaurant created successfully',
      data: savedRestaurant,
    });
  } catch (error: any) {
    console.error('Error creating restaurant:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating restaurant',
      error: error.message,
    });
  }
};

export const getAllRestaurants = async (
  req: Request,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const restaurants = await prisma.restaurant.findMany();
    res.status(200).json({
      success: true,
      message: 'Restaurants retrieved successfully',
      count: restaurants.length,
      data: restaurants,
    });
  } catch (error: any) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching restaurants',
      error: error.message,
    });
  }
};

export const getRestaurantById = async (
  req: Request & { params: { id: string } },
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { id } = req.params;

    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
    });
    if (!restaurant) {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Restaurant retrieved successfully',
      data: restaurant,
    });
  } catch (error: any) {
    console.error('Error fetching restaurant:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching restaurant',
      error: error.message,
    });
  }
};

export const updateRestaurant = async (
  req: Request & { body: UpdateRestaurantRequest; params: { id: string } },
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      address,
      phone,
      email,
      description,
      category,
      locations,
      country,
      plan,
      billingCycle,
      signupPageConfig,
    } = req.body;

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
      });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (address !== undefined) updateData.address = address?.trim();
    if (phone !== undefined) updateData.phone = phone?.trim();
    if (email !== undefined) updateData.email = email?.trim().toLowerCase();
    if (description !== undefined) updateData.description = description?.trim();
    if (category !== undefined) updateData.category = category?.trim();
    if (locations !== undefined) updateData.locations = locations?.trim();
    if (country !== undefined) updateData.country = country?.trim();
    if (plan !== undefined) updateData.plan = plan?.trim();
    if (billingCycle !== undefined) updateData.billingCycle = billingCycle;
    if (signupPageConfig !== undefined) {
      updateData.signupPageConfig = {
        ...(signupPageConfig.headerImage !== undefined && {
          headerImage: signupPageConfig.headerImage?.trim(),
        }),
        ...(signupPageConfig.welcomeTitle !== undefined && {
          welcomeTitle: signupPageConfig.welcomeTitle?.trim(),
        }),
        ...(signupPageConfig.description !== undefined && {
          description: signupPageConfig.description?.trim(),
        }),
        ...(signupPageConfig.formFields !== undefined && {
          formFields: {
            ...(signupPageConfig.formFields.fullName !== undefined && {
              fullName: signupPageConfig.formFields.fullName,
            }),
            ...(signupPageConfig.formFields.birthday !== undefined && {
              birthday: signupPageConfig.formFields.birthday,
            }),
            ...(signupPageConfig.formFields.email !== undefined && {
              email: signupPageConfig.formFields.email,
            }),
            ...(signupPageConfig.formFields.phone !== undefined && {
              phone: signupPageConfig.formFields.phone,
            }),
          },
        }),
      };
    }

    const restaurant = await prisma.restaurant.update({
      where: { id },
      data: updateData as any,
    });

    res.status(200).json({
      success: true,
      message: 'Restaurant updated successfully',
      data: restaurant,
    });
  } catch (error: any) {
    console.error('Error updating restaurant:', error);
    if (error.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Error updating restaurant',
      error: error.message,
    });
  }
};

export const createLocation = async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userEmail = req.user?.email;
    if (!userId && !userEmail) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const currentUser = await findUserByIdOrEmail(userId, userEmail);
    if (!currentUser || currentUser.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Only admins can create locations',
      });
      return;
    }

    const { storeName, address, category, operatorName, operatorEmail, autoInvite } = req.body;

    if (!storeName || !address || !category || !operatorName || !operatorEmail) {
      res.status(400).json({
        success: false,
        message: 'Store name, address, category, operator name, and operator email are required',
      });
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(operatorEmail)) {
      res.status(400).json({
        success: false,
        message: 'Invalid operator email format',
      });
      return;
    }

    const normalizedEmail = operatorEmail.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
      return;
    }

    const restaurantId = currentUser.restaurantId;
    if (!restaurantId) {
      res.status(400).json({
        success: false,
        message: 'Current user does not have a restaurant associated',
      });
      return;
    }

    const savedLocation = await prisma.restaurant.create({
      data: {
        name: storeName.trim(),
        address: address.trim(),
        category: category.trim(),
        userId: currentUser.id,
      },
    });

    const generatedPassword = generatePassword(12);
    const hashed = await hashPassword(generatedPassword);

    const operatorUser = await prisma.user.create({
      data: {
        name: operatorName.trim(),
        email: normalizedEmail,
        password: hashed,
        role: 'user',
        restaurantId,
        locationAccess: [savedLocation.id],
        invitedBy: currentUser.id,
        onboardingCompleted: false,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Location and operator created successfully',
      data: {
        location: {
          id: savedLocation.id,
          name: savedLocation.name,
          address: savedLocation.address,
          category: savedLocation.category,
          createdAt: savedLocation.createdAt,
        },
        operator: {
          id: operatorUser.id,
          name: operatorUser.name,
          email: operatorUser.email,
          role: operatorUser.role,
          locationAccess: operatorUser.locationAccess || [],
          password: generatedPassword,
          createdAt: operatorUser.createdAt,
        },
      },
    });
  } catch (error: any) {
    console.error('Error creating location:', error);
    if (error.code === 'P2002') {
      res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Error creating location',
      error: error.message,
    });
  }
};

export const getRestaurantLocations = async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userEmail = req.user?.email;
    if (!userId && !userEmail) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const currentUser = await findUserByIdOrEmail(userId, userEmail);
    if (!currentUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const restaurantId = currentUser.restaurantId;
    if (!restaurantId) {
      res.status(400).json({
        success: false,
        message: 'User does not have a restaurant associated',
      });
      return;
    }

    const users = await prisma.user.findMany({
      where: { restaurantId },
    });

    const locationIds = new Set<string>();
    users.forEach((user: { locationAccess?: string[] | null }) => {
      const access = user.locationAccess || [];
      access.forEach((locId: string) => {
        if (locId) locationIds.add(locId);
      });
    });

    const locations = await prisma.restaurant.findMany({
      where: { id: { in: Array.from(locationIds) } },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      message: 'Locations retrieved successfully',
      count: locations.length,
      data: locations,
    });
  } catch (error: any) {
    console.error('Error fetching restaurant locations:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching locations',
      error: error.message,
    });
  }
};
