import mongoose, { Schema, Model } from 'mongoose';
import { CustomerDocument } from '../types';

const customerSchema = new Schema<CustomerDocument>({
  name: {
    type: String,
    required: false,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  phone: {
    type: String,
    required: false,
    trim: true
  },
  phoneNormalized: {
    type: String,
    trim: true,
    index: true
  },
  memberCode: {
    type: String,
    trim: true
  },
  dateOfBirth: {
    type: Date,
    required: false
  },
  restaurantId: {
    type: String,
    trim: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Per-restaurant member code lookup
customerSchema.index({ restaurantId: 1, memberCode: 1 }, { unique: true, sparse: true });

// Update the updatedAt field before saving
customerSchema.pre('save', function(next) {
  (this as any).updatedAt = Date.now();
  next();
});

const Customer: Model<CustomerDocument> = mongoose.model<CustomerDocument>('Customer', customerSchema);

export default Customer;

