import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction';
import Customer from '../models/Customer';
import { ApiResponse, CreateTransactionRequest, TypedRequest, GetTransactionsResponse, TransactionDocument } from '../types';
import { emitTransactionEvent } from '../services/socketService';

/**
 * Calculate customer balance from all transactions
 */
export const calculateCustomerBalance = async (customerId: string): Promise<number> => {
  const transactions = await Transaction.find({ customerId: new mongoose.Types.ObjectId(customerId) });
  return transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
};

/**
 * Create a new transaction
 */
export const createTransaction = async (
  req: TypedRequest<CreateTransactionRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { customerId, restaurantId, type, amount, description, metadata, createdBy } = req.body;

    // Validate required fields
    if (!customerId || !restaurantId || !type || amount === undefined || !description) {
      res.status(400).json({
        success: false,
        message: 'Please provide customerId, restaurantId, type, amount, and description'
      });
      return;
    }

    // Validate customerId format
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid customer ID format'
      });
      return;
    }

    // Verify customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
      return;
    }

    // Validate transaction type
    const validTypes = ['REGISTRATION', 'EARNED', 'REDEEMED', 'EXPIRED', 'ADJUSTED', 'REFUNDED'];
    if (!validTypes.includes(type)) {
      res.status(400).json({
        success: false,
        message: `Invalid transaction type. Must be one of: ${validTypes.join(', ')}`
      });
      return;
    }

    // Validate amount sign matches type
    if ((type === 'REGISTRATION' || type === 'EARNED' || type === 'REFUNDED') && amount < 0) {
      res.status(400).json({
        success: false,
        message: `${type} transactions must have a positive amount`
      });
      return;
    }

    if ((type === 'REDEEMED' || type === 'EXPIRED' || type === 'ADJUSTED') && amount > 0) {
      res.status(400).json({
        success: false,
        message: `${type} transactions must have a negative amount`
      });
      return;
    }

    // Calculate current balance before creating new transaction
    const currentBalance = await calculateCustomerBalance(customerId);
    
    // Create transaction with calculated balanceAfter
    const transaction = new Transaction({
      customerId: new mongoose.Types.ObjectId(customerId),
      restaurantId,
      type,
      amount,
      description,
      balanceAfter: currentBalance + amount, // Calculate balance after this transaction
      metadata: metadata || {},
      createdBy: createdBy || undefined
    });

    const savedTransaction = await transaction.save();
    
    // Populate customer data for the event
    const transactionWithCustomer = await Transaction.findById(savedTransaction._id)
      .populate('customerId', 'name email')
      .lean();
    
    // Emit real-time event to restaurant room
    if (transactionWithCustomer) {
      emitTransactionEvent(restaurantId, {
        transaction: transactionWithCustomer,
        customer: transactionWithCustomer.customerId
      });
    }
    
    const transactionResponse = savedTransaction.toObject();

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: {
        ...transactionResponse,
        balance: savedTransaction.balanceAfter
      }
    });
  } catch (error: any) {
    console.error('Error creating transaction:', error);
    
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
      message: 'Error creating transaction',
      error: error.message
    });
  }
};

/**
 * Get transaction history for a customer
 */
export const getCustomerTransactions = async (
  req: Request & { query: { page?: string; limit?: string } },
  res: Response<ApiResponse<GetTransactionsResponse>>
): Promise<void> => {
  try {
    const { customerId } = req.params;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid customer ID format'
      });
      return;
    }

    // Verify customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
      return;
    }

    // Get transactions with pagination
    const transactions = await Transaction.find({ customerId: new mongoose.Types.ObjectId(customerId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count
    const total = await Transaction.countDocuments({ customerId: new mongoose.Types.ObjectId(customerId) });

    // Calculate current balance
    const balance = await calculateCustomerBalance(customerId);

    res.status(200).json({
      success: true,
      message: 'Transactions retrieved successfully',
      data: {
        transactions,
        total,
        page,
        limit,
        balance
      }
    });
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions',
      error: error.message
    });
  }
};

/**
 * Get current balance for a customer
 */
export const getCustomerBalance = async (
  req: Request,
  res: Response<ApiResponse<{ balance: number }>>
): Promise<void> => {
  try {
    const { customerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid customer ID format'
      });
      return;
    }

    // Verify customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
      return;
    }

    // Calculate balance from all transactions
    const balance = await calculateCustomerBalance(customerId);

    res.status(200).json({
      success: true,
      message: 'Balance retrieved successfully',
      data: { balance }
    });
  } catch (error: any) {
    console.error('Error fetching balance:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching balance',
      error: error.message
    });
  }
};

/**
 * Get recent transactions for a restaurant
 */
export const getRestaurantTransactions = async (
  req: Request & { query: { restaurantId?: string; limit?: string } },
  res: Response<ApiResponse<{ transactions: any[] }>>
): Promise<void> => {
  try {
    const restaurantId = req.query.restaurantId || req.params.restaurantId;
    const limit = parseInt(req.query.limit || '20', 10);

    if (!restaurantId) {
      res.status(400).json({
        success: false,
        message: 'Restaurant ID is required'
      });
      return;
    }

    // Get recent transactions for the restaurant, populated with customer info
    const transactions = await Transaction.find({ restaurantId })
      .populate({
        path: 'customerId',
        select: 'name email',
        model: 'Customer'
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      message: 'Transactions retrieved successfully',
      data: { transactions }
    });
  } catch (error: any) {
    console.error('Error fetching restaurant transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions',
      error: error.message
    });
  }
};
