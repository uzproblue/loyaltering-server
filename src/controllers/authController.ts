import { Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../utils/db';
import { hashPassword, comparePassword } from '../utils/auth';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/emailService';
import { ApiResponse, RegisterRequest, LoginRequest, ForgotPasswordRequest, ResetPasswordRequest, TypedRequest } from '../types';

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

export const register = async (
  req: TypedRequest<RegisterRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { fullName, email, businessName, password } = req.body;

    if (!fullName || !email || !password) {
      res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password',
      });
      return;
    }

    if (!businessName || businessName.trim() === '') {
      res.status(400).json({
        success: false,
        message: 'Business name is required',
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
      return;
    }

    const hashed = await hashPassword(password);
    const savedUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashed,
        name: fullName.trim(),
        businessName: businessName.trim(),
        role: 'admin',
      },
    });

    const savedRestaurant = await prisma.restaurant.create({
      data: {
        name: businessName.trim(),
        email: normalizedEmail,
        userId: savedUser.id,
      },
    });

    await prisma.user.update({
      where: { id: savedUser.id },
      data: { restaurantId: savedRestaurant.id },
    });

    setImmediate(() => {
      sendWelcomeEmail(savedUser.email, savedUser.name).catch((err) =>
        console.error('[authController] register sendWelcomeEmail:', err)
      );
    });

    const token = generateToken(savedUser.id, savedUser.email, savedUser.role);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: savedUser.id,
        email: savedUser.email,
        name: savedUser.name,
        businessName: savedUser.businessName ?? undefined,
        role: savedUser.role,
        restaurantId: savedRestaurant.id,
      },
      token,
    });
  } catch (error: any) {
    console.error('Error registering user:', error);
    if (error.code === 'P2002') {
      res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message,
    });
  }
};

export const login = async (
  req: TypedRequest<LoginRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }

    const token = generateToken(user.id, user.email, user.role);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        businessName: user.businessName ?? undefined,
        role: user.role,
        restaurantId: user.restaurantId ?? undefined,
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  } catch (error: any) {
    console.error('Error logging in user:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in user',
      error: error.message,
    });
  }
};

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;
const GENERIC_FORGOT_MESSAGE = 'If an account exists for this email, you will receive a reset link.';

export const forgotPassword = async (
  req: TypedRequest<ForgotPasswordRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Please provide an email address',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: token,
          resetPasswordExpires: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
        },
      });

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
      message: GENERIC_FORGOT_MESSAGE,
    });
  } catch (error: any) {
    console.error('Error in forgotPassword:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
      error: error.message,
    });
  }
};

export const resetPassword = async (
  req: TypedRequest<ResetPasswordRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Token and new password are required',
      });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user) {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired reset link. Please request a new password reset.',
      });
      return;
    }

    const hashed = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in.',
    });
  } catch (error: any) {
    console.error('Error in resetPassword:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
      error: error.message,
    });
  }
};
