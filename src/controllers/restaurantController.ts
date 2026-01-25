import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Restaurant from '../models/Restaurant';
import { ApiResponse, CreateRestaurantRequest, UpdateRestaurantRequest, TypedRequest } from '../types';

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
      billingCycle
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
