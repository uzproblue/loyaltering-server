import { Request, Response, NextFunction } from 'express';
import { isConnected, waitForConnection, connectDB } from '../utils/db';

/**
 * Middleware to ensure MongoDB connection is ready before handling requests
 */
export const ensureDBConnection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Try to connect if not connected
    if (!isConnected()) {
      try {
        await connectDB();
      } catch (connectError) {
        // If connection fails, wait a bit and try again
        console.warn('Initial connection failed, waiting for connection...', connectError);
      }
      
      // Wait for connection to be ready
      await waitForConnection(10000); // Wait up to 10 seconds
    }
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(503).json({
      success: false,
      message: 'Database connection unavailable',
      error: 'Service temporarily unavailable'
    });
  }
};
