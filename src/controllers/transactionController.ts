import { Request, Response } from 'express';
import { prisma } from '../utils/db';
import {
  ApiResponse,
  CreateTransactionRequest,
  TypedRequest,
  GetTransactionsResponse,
  TransactionDocument,
} from '../types';
import { emitTransactionEvent } from '../services/socketService';

export const calculateCustomerBalance = async (customerId: string): Promise<number> => {
  const result = await prisma.transaction.aggregate({
    where: { customerId },
    _sum: { amount: true },
  });
  return result._sum?.amount ?? 0;
};

export const createTransaction = async (
  req: TypedRequest<CreateTransactionRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { customerId, restaurantId, type, amount, description, metadata, createdBy } = req.body;

    if (!customerId || !restaurantId || !type || amount === undefined || !description) {
      res.status(400).json({
        success: false,
        message: 'Please provide customerId, restaurantId, type, amount, and description',
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

    const validTypes = ['REGISTRATION', 'EARNED', 'REDEEMED', 'EXPIRED', 'ADJUSTED', 'REFUNDED'];
    if (!validTypes.includes(type)) {
      res.status(400).json({
        success: false,
        message: `Invalid transaction type. Must be one of: ${validTypes.join(', ')}`,
      });
      return;
    }

    if ((type === 'REGISTRATION' || type === 'EARNED' || type === 'REFUNDED') && amount < 0) {
      res.status(400).json({
        success: false,
        message: `${type} transactions must have a positive amount`,
      });
      return;
    }

    if ((type === 'REDEEMED' || type === 'EXPIRED' || type === 'ADJUSTED') && amount > 0) {
      res.status(400).json({
        success: false,
        message: `${type} transactions must have a negative amount`,
      });
      return;
    }

    const currentBalance = await calculateCustomerBalance(customerId);
    const balanceAfter = currentBalance + amount;

    const savedTransaction = await prisma.transaction.create({
      data: {
        customerId,
        restaurantId,
        type,
        amount,
        description,
        balanceAfter,
        metadata: (metadata as object) || {},
        createdBy: createdBy || undefined,
      },
    });

    const transactionWithCustomer = await prisma.transaction.findUnique({
      where: { id: savedTransaction.id },
      include: { customer: { select: { name: true, email: true } } },
    });
    if (transactionWithCustomer) {
      emitTransactionEvent(restaurantId, {
        transaction: transactionWithCustomer as any,
        customer: transactionWithCustomer.customer as any,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: {
        ...savedTransaction,
        balance: savedTransaction.balanceAfter ?? balanceAfter,
      },
    });
  } catch (error: any) {
    console.error('Error creating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating transaction',
      error: error.message,
    });
  }
};

export const getCustomerTransactions = async (
  req: Request & { query: { page?: string; limit?: string } },
  res: Response<ApiResponse<GetTransactionsResponse>>
): Promise<void> => {
  try {
    const { customerId } = req.params;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const skip = (page - 1) * limit;

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

    const [transactions, total, balance] = await Promise.all([
      prisma.transaction.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where: { customerId } }),
      calculateCustomerBalance(customerId),
    ]);

    res.status(200).json({
      success: true,
      message: 'Transactions retrieved successfully',
      data: {
        transactions: transactions as TransactionDocument[],
        total,
        page,
        limit,
        balance,
      },
    });
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions',
      error: error.message,
    });
  }
};

export const getCustomerBalance = async (
  req: Request,
  res: Response<ApiResponse<{ balance: number }>>
): Promise<void> => {
  try {
    const { customerId } = req.params;

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

    const balance = await calculateCustomerBalance(customerId);
    res.status(200).json({
      success: true,
      message: 'Balance retrieved successfully',
      data: { balance },
    });
  } catch (error: any) {
    console.error('Error fetching balance:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching balance',
      error: error.message,
    });
  }
};

export const getRestaurantTransactions = async (
  req: Request & { query: { restaurantId?: string; limit?: string }; params: { restaurantId?: string } },
  res: Response<ApiResponse<{ transactions: any[] }>>
): Promise<void> => {
  try {
    const restaurantId = req.query.restaurantId || req.params.restaurantId;
    const limit = parseInt(req.query.limit || '20', 10);

    if (!restaurantId) {
      res.status(400).json({
        success: false,
        message: 'Restaurant ID is required',
      });
      return;
    }

    const transactions = await prisma.transaction.findMany({
      where: { restaurantId },
      include: { customer: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.status(200).json({
      success: true,
      message: 'Transactions retrieved successfully',
      data: { transactions },
    });
  } catch (error: any) {
    console.error('Error fetching restaurant transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions',
      error: error.message,
    });
  }
};
