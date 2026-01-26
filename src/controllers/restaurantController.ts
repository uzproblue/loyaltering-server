import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Restaurant from '../models/Restaurant';
import User from '../models/User';
import { ApiResponse, CreateRestaurantRequest, UpdateRestaurantRequest, TypedRequest } from '../types';
import { AuthenticatedRequest } from '../middleware/auth';

export const createRestaurant = async (
  req: TypedRequest<CreateRestaurantRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { name, address, phone, email, description, userId } = req.body;

    // Validate required fields
    if (!name || name.trim() === '') {
      res.status(400).json({
        success: false,
        message: 'Restaurant name is required'
      });
      return;
    }

    // Validate userId if provided
    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
      return;
    }

    // Validate email format if provided
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
      return;
    }

    // Create new restaurant
    const restaurant = new Restaurant({
      name: name.trim(),
      address: address?.trim(),
      phone: phone?.trim(),
      email: email?.trim().toLowerCase(),
      description: description?.trim(),
      userId: userId ? new mongoose.Types.ObjectId(userId) : undefined
    });

    const savedRestaurant = await restaurant.save();
    const restaurantResponse = savedRestaurant.toObject();

    res.status(201).json({
      success: true,
      message: 'Restaurant created successfully',
      data: restaurantResponse
    });
  } catch (error: any) {
    console.error('Error creating restaurant:', error);
    
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
      message: 'Error creating restaurant',
      error: error.message
    });
  }
};

export const getAllRestaurants = async (
  req: Request,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const restaurants = await Restaurant.find();
    res.status(200).json({
      success: true,
      message: 'Restaurants retrieved successfully',
      count: restaurants.length,
      data: restaurants
    });
  } catch (error: any) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching restaurants',
      error: error.message
    });
  }
};

export const getRestaurantById = async (
  req: Request & { params: { id: string } },
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid restaurant ID'
      });
      return;
    }

    const restaurant = await Restaurant.findById(id);
    
    if (!restaurant) {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Restaurant retrieved successfully',
      data: restaurant
    });
  } catch (error: any) {
    console.error('Error fetching restaurant:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching restaurant',
      error: error.message
    });
  }
};

export const updateRestaurant = async (
  req: Request & { body: UpdateRestaurantRequest; params: { id: string } },
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid restaurant ID'
      });
      return;
    }

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
      signupPageConfig
    } = req.body;

    // Validate email format if provided
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
      return;
    }

    // Build update object
    const updateData: any = {};
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
        ...(signupPageConfig.headerImage !== undefined && { headerImage: signupPageConfig.headerImage?.trim() }),
        ...(signupPageConfig.welcomeTitle !== undefined && { welcomeTitle: signupPageConfig.welcomeTitle?.trim() }),
        ...(signupPageConfig.description !== undefined && { description: signupPageConfig.description?.trim() }),
        ...(signupPageConfig.formFields !== undefined && {
          formFields: {
            ...(signupPageConfig.formFields.fullName !== undefined && { fullName: signupPageConfig.formFields.fullName }),
            ...(signupPageConfig.formFields.birthday !== undefined && { birthday: signupPageConfig.formFields.birthday }),
            ...(signupPageConfig.formFields.email !== undefined && { email: signupPageConfig.formFields.email }),
            ...(signupPageConfig.formFields.phone !== undefined && { phone: signupPageConfig.formFields.phone })
          }
        })
      };
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!restaurant) {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Restaurant updated successfully',
      data: restaurant
    });
  } catch (error: any) {
    console.error('Error updating restaurant:', error);
    
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
      message: 'Error updating restaurant',
      error: error.message
    });
  }
};

/**
 * Generate a secure random password
 */
const generatePassword = (length: number = 12): string => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + special;
  
  let password = '';
  // Ensure at least one character from each category
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill the rest with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

/**
 * Create a new location and operator user
 */
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

    // Find current user (inviter)
    let currentUser;
    if (userId) {
      currentUser = await User.findById(userId);
    } else if (userEmail) {
      currentUser = await User.findOne({ email: userEmail });
    }

    if (!currentUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Only admins can create locations
    if (currentUser.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Only admins can create locations' });
      return;
    }

    const { storeName, address, category, operatorName, operatorEmail, autoInvite } = req.body;

    // Validate required fields
    if (!storeName || !address || !category || !operatorName || !operatorEmail) {
      res.status(400).json({
        success: false,
        message: 'Store name, address, category, operator name, and operator email are required'
      });
      return;
    }

    // Validate email format
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(operatorEmail)) {
      res.status(400).json({
        success: false,
        message: 'Invalid operator email format'
      });
      return;
    }

    // Check if operator email already exists
    const existingUser = await User.findOne({ email: operatorEmail.toLowerCase().trim() });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
      return;
    }

    // Get restaurantId from current user
    const restaurantId = (currentUser as any).restaurantId;
    if (!restaurantId) {
      res.status(400).json({
        success: false,
        message: 'Current user does not have a restaurant associated'
      });
      return;
    }

    // Create new location (Restaurant document)
    // Note: userId field in Restaurant model references the owner/admin user
    const location = new Restaurant({
      name: storeName.trim(),
      address: address.trim(),
      category: category.trim(),
      userId: currentUser._id, // Reference to the admin user who created this location
    });

    const savedLocation = await location.save();
    const locationId = savedLocation._id.toString();

    // Generate secure password for operator
    const generatedPassword = generatePassword(12);

    // Create operator user
    const operatorUser = new User({
      name: operatorName.trim(),
      email: operatorEmail.toLowerCase().trim(),
      password: generatedPassword, // Will be hashed by pre-save hook
      role: 'user',
      restaurantId: restaurantId,
      locationAccess: [locationId],
      invitedBy: currentUser._id,
      onboardingCompleted: false
    });

    await operatorUser.save();

    // TODO: If autoInvite is true, send email with credentials (can be added later)

    // Return location and user data
    res.status(201).json({
      success: true,
      message: 'Location and operator created successfully',
      data: {
        location: {
          id: savedLocation._id.toString(),
          name: savedLocation.name,
          address: savedLocation.address,
          category: savedLocation.category,
          createdAt: savedLocation.createdAt
        },
        operator: {
          id: operatorUser._id.toString(),
          name: operatorUser.name,
          email: operatorUser.email,
          role: operatorUser.role,
          locationAccess: (operatorUser as any).locationAccess || [],
          password: generatedPassword, // Include password so admin can share it
          createdAt: operatorUser.createdAt
        }
      }
    });
  } catch (error: any) {
    console.error('Error creating location:', error);
    
    if (error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map((err: any) => err.message)
      });
      return;
    }
    
    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Error creating location',
      error: error.message
    });
  }
};

/**
 * Get all locations for the current user's restaurant
 */
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

    // Find current user
    let currentUser;
    if (userId) {
      currentUser = await User.findById(userId);
    } else if (userEmail) {
      currentUser = await User.findOne({ email: userEmail });
    }

    if (!currentUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const restaurantId = (currentUser as any).restaurantId;
    if (!restaurantId) {
      res.status(400).json({
        success: false,
        message: 'User does not have a restaurant associated'
      });
      return;
    }

    // Get all users with this restaurantId to collect their locationAccess arrays
    const users = await User.find({ restaurantId: new mongoose.Types.ObjectId(restaurantId) });
    
    // Collect all unique location IDs from all users' locationAccess arrays
    const locationIds = new Set<string>();
    users.forEach((user) => {
      const access = (user as any).locationAccess || [];
      access.forEach((locId: string) => {
        if (locId && mongoose.Types.ObjectId.isValid(locId)) {
          locationIds.add(locId);
        }
      });
    });

    // Convert to array of ObjectIds
    const locationObjectIds = Array.from(locationIds).map(id => new mongoose.Types.ObjectId(id));

    // Fetch all location Restaurant documents
    const locations = await Restaurant.find({
      _id: { $in: locationObjectIds }
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Locations retrieved successfully',
      count: locations.length,
      data: locations
    });
  } catch (error: any) {
    console.error('Error fetching restaurant locations:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching locations',
      error: error.message
    });
  }
};
