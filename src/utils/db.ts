import mongoose from 'mongoose';

let cachedConnection: typeof mongoose | null = null;

/**
 * Connect to MongoDB with connection caching for serverless environments
 */
export const connectDB = async (): Promise<typeof mongoose> => {
  // Return cached connection if available and ready
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  // If connection exists but not ready, wait for it
  if (cachedConnection && mongoose.connection.readyState === 2) {
    return new Promise((resolve, reject) => {
      mongoose.connection.once('connected', () => resolve(cachedConnection!));
      mongoose.connection.once('error', reject);
    });
  }

  // Create new connection
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cmus';
  
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  try {
    // Set connection options for serverless
    const options = {
      bufferCommands: false, // Disable mongoose buffering
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4 // Use IPv4, skip trying IPv6
    };

    cachedConnection = await mongoose.connect(MONGODB_URI, options);
    console.log('MongoDB connected successfully');
    return cachedConnection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

/**
 * Check if MongoDB is connected
 */
export const isConnected = (): boolean => {
  return mongoose.connection.readyState === 1;
};

/**
 * Wait for MongoDB connection to be ready
 */
export const waitForConnection = async (timeout: number = 10000): Promise<void> => {
  if (isConnected()) {
    return;
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('MongoDB connection timeout'));
    }, timeout);

    const checkConnection = () => {
      if (isConnected()) {
        clearTimeout(timer);
        resolve();
      } else {
        setTimeout(checkConnection, 100);
      }
    };

    mongoose.connection.once('connected', () => {
      clearTimeout(timer);
      resolve();
    });

    mongoose.connection.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    // Start checking
    checkConnection();
  });
};
