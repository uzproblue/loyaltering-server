import { Request, Response } from 'express';
import type { User, Customer, Restaurant, Transaction, NotificationPermission } from '@prisma/client';

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

// Re-export Prisma model types for use across the app (ids are string)
export type CustomerDocument = Customer;
export type UserDocument = User;
export type RestaurantDocument = Restaurant;
export type TransactionDocument = Transaction;
export type NotificationPermissionDocument = NotificationPermission;

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

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface CreateCustomerRequest {
  name?: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  restaurantId?: string;
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
  customerIds?: string[];
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: 'admin' | 'user';
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
