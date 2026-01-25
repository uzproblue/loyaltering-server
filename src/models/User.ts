import mongoose, { Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserDocument } from '../types';

const userSchema = new Schema<UserDocument>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in queries by default
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  businessName: {
    type: String,
    trim: true
  },
  bio: {
    type: String,
    trim: true,
    default: ''
  },
  avatar: {
    type: String,
    trim: true,
    default: ''
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  restaurantId: {
    type: Schema.Types.ObjectId,
    ref: 'Restaurant',
    index: true
  },
  onboardingCompleted: {
    type: Boolean,
    default: false
  },
  locationAccess: {
    type: [String],
    default: []
  },
  invitedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
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

// Update the updatedAt field before saving
userSchema.pre('save', function(next: mongoose.CallbackWithoutResult) {
  (this as any).updatedAt = Date.now();
  next();
});

// Hash password before saving
userSchema.pre('save', async function(next: mongoose.CallbackWithoutResult) {
  // Only hash the password if it has been modified (or is new)
  if (!(this as any).isModified('password')) {
    return next();
  }

  try {
    // Hash password with cost of 10
    const salt = await bcrypt.genSalt(10);
    (this as any).password = await bcrypt.hash((this as any).password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, (this as any).password);
};

const User: Model<UserDocument> = mongoose.model<UserDocument>('User', userSchema);

export default User;

