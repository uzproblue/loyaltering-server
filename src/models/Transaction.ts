import mongoose, { Schema, Model } from 'mongoose';
import { TransactionDocument } from '../types';

const transactionSchema = new Schema<TransactionDocument>({
  customerId: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer ID is required'],
    index: true
  },
  restaurantId: {
    type: String,
    required: [true, 'Restaurant ID is required'],
    trim: true,
    index: true
  },
  type: {
    type: String,
    enum: ['REGISTRATION', 'EARNED', 'REDEEMED', 'EXPIRED', 'ADJUSTED', 'REFUNDED'],
    required: [true, 'Transaction type is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  balanceAfter: {
    type: Number,
    required: false // Will be calculated in pre-save hook
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  createdBy: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient history queries
transactionSchema.index({ customerId: 1, createdAt: -1 });

// Index for restaurant-scoped queries
transactionSchema.index({ restaurantId: 1, createdAt: -1 });

// Pre-save hook to calculate balanceAfter
transactionSchema.pre('save', async function(next) {
  // Only calculate if this is a new document and balanceAfter is not already set
  if (this.isNew && this.balanceAfter === undefined) {
    try {
      // Use this.constructor to get the model instance
      const TransactionModel = this.constructor as Model<TransactionDocument>;
      
      // Get all previous transactions for this customer, ordered by createdAt
      const previousTransactions = await TransactionModel
        .find({ customerId: this.customerId })
        .sort({ createdAt: 1 })
        .select('amount')
        .lean();
      
      // Calculate balance by summing all previous transactions
      const previousBalance = previousTransactions.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);
      
      // Calculate new balance after this transaction
      this.balanceAfter = previousBalance + this.amount;
    } catch (error) {
      return next(error as Error);
    }
  }
  next();
});

const Transaction: Model<TransactionDocument> = mongoose.model<TransactionDocument>('Transaction', transactionSchema);

export default Transaction;
