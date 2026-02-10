import { Request, Response, NextFunction } from 'express';
import { connectDB, isConnected } from '../utils/db';

/**
 * Middleware to ensure PostgreSQL (Neon) connection is ready before handling requests
 */
export const ensureDBConnection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!(await isConnected())) {
      await connectDB();
    }
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(503).json({
      success: false,
      message: 'Database connection unavailable',
      error: 'Service temporarily unavailable',
    });
  }
};
