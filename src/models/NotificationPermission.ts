import mongoose, { Schema, Model } from 'mongoose';
import { NotificationPermissionDocument } from '../types';

const notificationPermissionSchema = new Schema<NotificationPermissionDocument>({
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
  permissionGranted: {
    type: Boolean,
    required: [true, 'Permission status is required'],
    default: false
  },
  pushSubscription: {
    endpoint: {
      type: String,
      trim: true
    },
    keys: {
      p256dh: {
        type: String,
        trim: true
      },
      auth: {
        type: String,
        trim: true
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
notificationPermissionSchema.pre('save', function(next) {
  (this as any).updatedAt = Date.now();
  next();
});

// Compound index for efficient lookups
notificationPermissionSchema.index({ customerId: 1, restaurantId: 1 }, { unique: true });

const NotificationPermission: Model<NotificationPermissionDocument> = mongoose.model<NotificationPermissionDocument>(
  'NotificationPermission',
  notificationPermissionSchema
);

export default NotificationPermission;
