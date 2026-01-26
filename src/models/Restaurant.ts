import mongoose, { Schema, Model } from 'mongoose';
import { RestaurantDocument } from '../types';

const restaurantSchema = new Schema<RestaurantDocument>({
  name: {
    type: String,
    required: [true, 'Restaurant name is required'],
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    trim: true
  },
  locations: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true
  },
  plan: {
    type: String,
    trim: true
  },
  billingCycle: {
    type: String,
    enum: ['Monthly', 'Yearly'],
    trim: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  signupPageConfig: {
    headerImage: {
      type: String,
      trim: true
    },
    welcomeTitle: {
      type: String,
      trim: true,
      default: 'Join our rewards program'
    },
    description: {
      type: String,
      trim: true,
      default: 'Earn points for every purchase and unlock exclusive rewards. It\'s free and easy to join!'
    },
    formFields: {
      fullName: {
        type: Boolean,
        default: true
      },
      birthday: {
        type: Boolean,
        default: true
      },
      email: {
        type: Boolean,
        default: true
      },
      phone: {
        type: Boolean,
        default: false
      }
    }
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
restaurantSchema.pre('save', function(next) {
  (this as any).updatedAt = Date.now();
  next();
});

const Restaurant: Model<RestaurantDocument> = mongoose.model<RestaurantDocument>('Restaurant', restaurantSchema);

export default Restaurant;
