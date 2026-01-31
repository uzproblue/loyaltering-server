import { Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User';
import Restaurant from '../models/Restaurant';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/emailService';
import { ApiResponse, RegisterRequest, LoginRequest, ForgotPasswordRequest, ResetPasswordRequest, TypedRequest } from '../types';

// Generate JWT token
const generateToken = (userId: string, email: string, role: 'admin' | 'user'): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined');
  }

  return jwt.sign(
    { userId, email, role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Register a new platform user
export const register = async (
  req: TypedRequest<RegisterRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { fullName, email, businessName, password } = req.body;

    // Validate required fields
    if (!fullName || !email || !password) {
      res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password'
      });
      return;
    }

    // Validate businessName is provided (required for restaurant creation)
    if (!businessName || businessName.trim() === '') {
      res.status(400).json({
        success: false,
        message: 'Business name is required'
      });
      return;
    }

    // Validate password length
    if (password.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
      return;
    }

    // Create new user (password will be hashed by pre-save hook)
    const user = new User({
      email,
      password,
      name: fullName,
      businessName: businessName.trim(),
      role: 'admin' // Platform users registered through the registration page are admins
    });

    const savedUser = await user.save();
    
    // Create restaurant linked to the user
    const restaurant = new Restaurant({
      name: businessName.trim(),
      email: email.toLowerCase().trim(),
      userId: savedUser._id
    });

    const savedRestaurant = await restaurant.save();
    
    // Update user with restaurantId
    savedUser.restaurantId = savedRestaurant._id;
    await savedUser.save();

    // Send welcome email asynchronously (do not block or fail response)
    setImmediate(() => {
      sendWelcomeEmail(savedUser.email, savedUser.name).catch((err) =>
        console.error('[authController] register sendWelcomeEmail:', err)
      );
    });

    // Remove password from response
    const userResponse = savedUser.toObject();
    delete (userResponse as any).password;

    // Generate token
    const token = generateToken(savedUser._id.toString(), savedUser.email, savedUser.role);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: userResponse._id.toString(),
        email: userResponse.email,
        name: userResponse.name,
        businessName: userResponse.businessName,
        role: userResponse.role,
        restaurantId: (userResponse as any).restaurantId ? (userResponse as any).restaurantId.toString() : savedRestaurant._id.toString()
      },
      token
    });
  } catch (error: any) {
    console.error('Error registering user:', error);
    
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
      message: 'Error registering user',
      error: error.message
    });
  }
};

// Login platform user
export const login = async (
  req: TypedRequest<LoginRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
      return;
    }

    // Find user and include password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Generate token
    const token = generateToken(user._id.toString(), user.email, user.role);

    // Remove password from response
    const userResponse = user.toObject();
    delete (userResponse as any).password;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: userResponse._id.toString(),
        email: userResponse.email,
        name: userResponse.name,
        businessName: userResponse.businessName,
        role: userResponse.role,
        restaurantId: userResponse.restaurantId ? userResponse.restaurantId.toString() : undefined,
        onboardingCompleted: (userResponse as any).onboardingCompleted || false
      }
    });
  } catch (error: any) {
    console.error('Error logging in user:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in user',
      error: error.message
    });
  }
};

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const GENERIC_FORGOT_MESSAGE = 'If an account exists for this email, you will receive a reset link.';

// Forgot password: send reset link (always 200 with generic message)
export const forgotPassword = async (
  req: TypedRequest<ForgotPasswordRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Please provide an email address'
      });
      return;
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = token;
      user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
      await user.save();

      const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
      const resetLink = appUrl ? `${appUrl}/reset-password?token=${token}` : '';

      if (resetLink) {
        setImmediate(() => {
          sendPasswordResetEmail(user.email, resetLink).catch((err) =>
            console.error('[authController] forgotPassword sendPasswordResetEmail:', err)
          );
        });
      }
    }

    res.status(200).json({
      success: true,
      message: GENERIC_FORGOT_MESSAGE
    });
  } catch (error: any) {
    console.error('Error in forgotPassword:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
      error: error.message
    });
  }
};

// Reset password: validate token and set new password
export const resetPassword = async (
  req: TypedRequest<ResetPasswordRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Token and new password are required'
      });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
      return;
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    }).select('+password');

    if (!user) {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired reset link. Please request a new password reset.'
      });
      return;
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in.'
    });
  } catch (error: any) {
    console.error('Error in resetPassword:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
      error: error.message
    });
  }
};

