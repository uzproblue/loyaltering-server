// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express, { Express, Request, Response } from 'express';
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
import { connectDB } from './utils/db';
import { ensureDBConnection } from './middleware/dbCheck';

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

  // Allow the server's own domain (for API docs)
  if (origin.includes('loyaltering-server.vercel.app')) {
    return callback(null, true);
  }

  // Allow localhost for development
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return callback(null, true);
  }

  // Log rejected origin for debugging
  console.log('CORS rejected origin:', origin);
  
  // Reject if not in allowed origins
  callback(new Error('Not allowed by CORS'));
};

// CORS configuration with better error handling
app.use(cors({
  origin: corsOriginFunction,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Email'],
  exposedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('*', cors({
  origin: corsOriginFunction,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Email']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger Documentation
// Serve Swagger JSON spec with dynamic server URL
app.get('/api-docs.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  
  // Get the base URL from the request or environment
  let baseUrl: string;
  
  if (process.env.RENDER_EXTERNAL_URL) {
    // Render provides the full URL
    baseUrl = process.env.RENDER_EXTERNAL_URL;
  } else if (process.env.VERCEL_URL) {
    // Vercel provides the URL without protocol
    baseUrl = `https://${process.env.VERCEL_URL}`;
  } else {
    // Development: use request protocol and host
    const protocol = req.protocol || (req.secure ? 'https' : 'http');
    const host = req.get('host') || `localhost:${process.env.PORT || 3000}`;
    baseUrl = `${protocol}://${host}`;
  }
  
  // Clone and update the swagger spec with the current server URL
  const dynamicSpec = {
    ...swaggerSpec,
    servers: [
      {
        url: baseUrl,
        description: process.env.RENDER_EXTERNAL_URL ? 'Production server' : process.env.VERCEL_URL ? 'Vercel deployment' : 'Development server',
      },
    ],
  };
  
  res.send(dynamicSpec);
});

// Setup Swagger UI with CDN assets (better for serverless/Vercel)
const swaggerOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'CMUS API Documentation',
  customJs: [
    'https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js',
    'https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js',
  ],
  customCssUrl: 'https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    url: '/api-docs.json',
  },
};

// Get Swagger handlers
const swaggerServe = swaggerUi.serve;
const swaggerSetup = swaggerUi.setup(swaggerSpec, swaggerOptions);

// Apply Swagger middleware
// @ts-expect-error - swagger-ui-express has conflicting type definitions with express
app.use('/api-docs', swaggerServe as any, swaggerSetup);

// Health check (no DB required)
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Ensure DB connection for all API routes
app.use('/api', ensureDBConnection);

// Routes
app.use('/api/customers', customerRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/transactions', transactionRoutes);

// Initialize MongoDB connection (non-blocking for serverless)
connectDB().catch((error: Error) => {
  console.error('Failed to connect to MongoDB:', error);
  // Don't exit in serverless - let requests handle the error
});

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.io
initializeSocketIO(httpServer, corsOrigins);

// Start server (only if not in serverless environment)
if (process.env.VERCEL !== '1') {
  httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Socket.io server initialized`);
  });
}

export default app;

