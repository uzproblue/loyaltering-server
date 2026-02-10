import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const prismaClientSingleton = (): PrismaClient => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

export const prisma = globalThis.__prisma ?? prismaClientSingleton();
if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

let connectionPromise: Promise<PrismaClient> | null = null;

/**
 * Connect to PostgreSQL (Neon) with connection caching for serverless
 */
export const connectDB = async (): Promise<PrismaClient> => {
  if (connectionPromise) {
    return connectionPromise;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  connectionPromise = prisma.$connect().then(() => {
    console.log('PostgreSQL (Neon) connected successfully');
    return prisma;
  });
  return connectionPromise;
};

/**
 * Check if database is reachable
 */
export const isConnected = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

/**
 * Wait for database connection to be ready
 */
export const waitForConnection = async (timeout: number = 10000): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await prisma.$connect();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('PostgreSQL connection timeout');
};
