import { Request, Response } from 'express';
import { Document } from 'mongoose';
import mongoose from 'mongoose';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: string[];
  count?: number;
  token?: string;
  user?: any;
}

export interface TypedRequest<T = any> extends Request {
  body: T;
  params: any;
}

export interface TypedResponse<T = any> extends Response {
  json: (body: ApiResponse<T>) => this;
}

export interface CustomerDocument extends Document {
  name: string;
  email: string;
  phone: string;
  phoneNormalized?: string;
  memberCode?: string;
  dateOfBirth: Date;
  restaurantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDocument extends Document {
  email: string;
  password: string;
  name: string;
  businessName?: string;
  bio?: string;
  avatar?: string;
  role: 'admin' | 'user';
  restaurantId?: mongoose.Types.ObjectId;
  onboardingCompleted?: boolean;
  locationAccess?: string[];
  invitedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  businessName?: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateCustomerRequest {
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  restaurantId?: string;
}

export interface NotificationPermissionDocument extends Document {
  customerId: mongoose.Types.ObjectId;
  restaurantId: string;
  permissionGranted: boolean;
  pushSubscription?: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotificationPermissionRequest {
  customerId: string;
  restaurantId: string;
  permissionGranted: boolean;
  pushSubscription?: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
}

export interface SendNotificationRequest {
  restaurantId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  customerIds?: string[]; // Optional: send to specific customers only. If not provided, sends to all customers who granted permission
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: 'admin' | 'user';
}

export interface RestaurantDocument extends Document {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  category?: string;
  locations?: string;
  country?: string;
  plan?: string;
  billingCycle?: 'Monthly' | 'Yearly';
  userId?: mongoose.Types.ObjectId;
  signupPageConfig?: {
    headerImage?: string;
    welcomeTitle?: string;
    description?: string;
    formFields?: {
      fullName: boolean;
      birthday: boolean;
      email: boolean;
      phone: boolean;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRestaurantRequest {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  category?: string;
  locations?: string;
  country?: string;
  plan?: string;
  billingCycle?: 'Monthly' | 'Yearly';
  userId?: string;
}

export interface UpdateRestaurantRequest {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  category?: string;
  locations?: string;
  country?: string;
  plan?: string;
  billingCycle?: 'Monthly' | 'Yearly';
  signupPageConfig?: {
    headerImage?: string;
    welcomeTitle?: string;
    description?: string;
    formFields?: {
      fullName?: boolean;
      birthday?: boolean;
      email?: boolean;
      phone?: boolean;
    };
  };
}

export type TransactionType = 'REGISTRATION' | 'EARNED' | 'REDEEMED' | 'EXPIRED' | 'ADJUSTED' | 'REFUNDED';

export interface TransactionDocument extends Document {
  customerId: mongoose.Types.ObjectId;
  restaurantId: string;
  type: TransactionType;
  amount: number;
  description: string;
  balanceAfter: number;
  metadata?: Record<string, any>;
  createdBy?: string;
  createdAt: Date;
}

export interface CreateTransactionRequest {
  customerId: string;
  restaurantId: string;
  type: TransactionType;
  amount: number;
  description: string;
  metadata?: Record<string, any>;
  createdBy?: string;
}

export interface GetTransactionsResponse {
  transactions: TransactionDocument[];
  total: number;
  page?: number;
  limit?: number;
  balance: number;
}

