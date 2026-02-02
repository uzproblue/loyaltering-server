import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

/**
 * Initialize Socket.io server
 */
export const initializeSocketIO = (httpServer: HTTPServer, corsOrigins: string[]): SocketIOServer => {
  // Socket.io supports regex patterns in origin array
  const socketCorsOrigins: (string | RegExp)[] = [
    ...corsOrigins,
    'https://customer-app-hazel.vercel.app',
    /^https:\/\/.*\.vercel\.app$/, // Allow all Vercel preview deployments
    /^https:\/\/.*\.loyaltering\.online$/, // Allow all loyaltering.online domains
  ];

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: socketCorsOrigins,
      credentials: true,
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
  });

  // Handle connections
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    // Handle joining restaurant room
    socket.on('joinRestaurant', (restaurantId: string) => {
      if (restaurantId) {
        const room = `restaurant:${restaurantId}`;
        socket.join(room);
        console.log(`Socket ${socket.id} joined room: ${room}`);
      }
    });

    // Handle leaving restaurant room
    socket.on('leaveRestaurant', (restaurantId: string) => {
      if (restaurantId) {
        const room = `restaurant:${restaurantId}`;
        socket.leave(room);
        console.log(`Socket ${socket.id} left room: ${room}`);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });

    // Handle errors
    socket.on('error', (error: Error) => {
      console.error('Socket error:', error);
    });
  });

  return io;
};

/**
 * Get Socket.io instance
 */
export const getSocketIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initializeSocketIO first.');
  }
  return io;
};

/**
 * Emit transaction event to restaurant room
 */
export const emitTransactionEvent = (restaurantId: string, transactionData: any): void => {
  if (!io) {
    console.warn('Socket.io not initialized, cannot emit transaction event');
    return;
  }

  const room = `restaurant:${restaurantId}`;
  io.to(room).emit('newTransaction', transactionData);
  console.log(`Emitted transaction event to room: ${room}`);
};
