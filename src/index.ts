// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express, { Express, Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { createServer } from 'http';
import customerRoutes from './routes/customerRoutes';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import notificationRoutes from './routes/notificationRoutes';
import restaurantRoutes from './routes/restaurantRoutes';
import transactionRoutes from './routes/transactionRoutes';
import swaggerSpec from './config/swagger';
import { initializeSocketIO } from './services/socketService';

const app: Express = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);

// Middleware
const corsOrigins: string[] = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map((origin: string) => origin.trim())
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];

// Custom CORS origin function to handle explicit origins and Vercel domains
const corsOriginFunction = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  // Allow requests with no origin (like mobile apps or curl requests)
  if (!origin) {
    return callback(null, true);
  }

  // Check against explicit origins from environment variable
  if (corsOrigins.includes(origin)) {
    return callback(null, true);
  }

  // Allow Vercel domains (production and preview deployments)
  const vercelPattern = /^https:\/\/.*\.vercel\.app$/;
  if (vercelPattern.test(origin)) {
    return callback(null, true);
  }

  // Also allow the specific Vercel domain
  if (origin === 'https://customer-app-hazel.vercel.app') {
    return callback(null, true);
  }

  // Reject if not in allowed origins
  callback(new Error('Not allowed by CORS'));
};

app.use(cors({
  origin: corsOriginFunction,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'CMUS API Documentation',
}));

// Routes
app.use('/api/customers', customerRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/transactions', transactionRoutes);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     description: Check if the server is running
 *     responses:
 *       200:
 *         description: Server is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 message:
 *                   type: string
 *                   example: Server is running
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// MongoDB connection
const MONGODB_URI: string = process.env.MONGODB_URI || 'mongodb://localhost:27017/cmus';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Create HTTP server
    const httpServer = createServer(app);
    
    // Initialize Socket.io
    initializeSocketIO(httpServer, corsOrigins);
    
    // Start server
    httpServer.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Socket.io server initialized`);
    });
  })
  .catch((error: Error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

export default app;

