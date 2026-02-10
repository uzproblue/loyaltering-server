import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CMUS Server API',
      version: '1.0.0',
      description: 'API documentation for CMUS Server with PostgreSQL (Neon) and user management endpoints',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: process.env.RENDER_EXTERNAL_URL || process.env.VERCEL_URL || `http://localhost:${process.env.PORT || 3000}`,
        description: process.env.RENDER_EXTERNAL_URL ? 'Production server' : process.env.VERCEL_URL ? 'Vercel deployment' : 'Development server',
      },
    ],
    components: {
      schemas: {
        Customer: {
          type: 'object',
          required: ['name', 'email', 'phone', 'dateOfBirth'],
          properties: {
            _id: {
              type: 'string',
              description: 'Customer ID',
              example: '507f1f77bcf86cd799439011',
            },
            name: {
              type: 'string',
              description: 'Customer full name',
              example: 'John Doe',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Customer email address',
              example: 'john@example.com',
            },
            phone: {
              type: 'string',
              description: 'Customer phone number',
              example: '+1 (555) 123-4567',
            },
            dateOfBirth: {
              type: 'string',
              format: 'date',
              description: 'Customer date of birth',
              example: '1990-01-15',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Customer creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Customer last update timestamp',
            },
          },
        },
        CustomerResponse: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Customer ID',
              example: '507f1f77bcf86cd799439011',
            },
            name: {
              type: 'string',
              description: 'Customer full name',
              example: 'John Doe',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Customer email address',
              example: 'john@example.com',
            },
            phone: {
              type: 'string',
              description: 'Customer phone number',
              example: '+1 (555) 123-4567',
            },
            dateOfBirth: {
              type: 'string',
              format: 'date',
              description: 'Customer date of birth',
              example: '1990-01-15',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Customer creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Customer last update timestamp',
            },
          },
        },
        CreateCustomerRequest: {
          type: 'object',
          required: ['name', 'email', 'phone', 'dateOfBirth'],
          properties: {
            name: {
              type: 'string',
              description: 'Customer full name',
              example: 'John Doe',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Customer email address',
              example: 'john@example.com',
            },
            phone: {
              type: 'string',
              description: 'Customer phone number',
              example: '+1 (555) 123-4567',
            },
            dateOfBirth: {
              type: 'string',
              format: 'date',
              description: 'Customer date of birth (YYYY-MM-DD)',
              example: '1990-01-15',
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Operation successful',
            },
            data: {
              type: 'object',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'Error message',
            },
            error: {
              type: 'string',
              example: 'Detailed error information',
            },
          },
        },
        Restaurant: {
          type: 'object',
          required: ['name'],
          properties: {
            _id: {
              type: 'string',
              description: 'Restaurant ID',
              example: '507f1f77bcf86cd799439011',
            },
            name: {
              type: 'string',
              description: 'Restaurant name',
              example: 'Pizza Palace',
            },
            address: {
              type: 'string',
              description: 'Restaurant address',
              example: '123 Main St, City, State 12345',
            },
            phone: {
              type: 'string',
              description: 'Restaurant phone number',
              example: '+1 (555) 123-4567',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Restaurant email address',
              example: 'info@pizzapalace.com',
            },
            description: {
              type: 'string',
              description: 'Restaurant description',
              example: 'Best pizza in town',
            },
            userId: {
              type: 'string',
              description: 'User ID of the restaurant owner',
              example: '507f1f77bcf86cd799439011',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Restaurant creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Restaurant last update timestamp',
            },
          },
        },
        RestaurantResponse: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Restaurant ID',
              example: '507f1f77bcf86cd799439011',
            },
            name: {
              type: 'string',
              description: 'Restaurant name',
              example: 'Pizza Palace',
            },
            address: {
              type: 'string',
              description: 'Restaurant address',
              example: '123 Main St, City, State 12345',
            },
            phone: {
              type: 'string',
              description: 'Restaurant phone number',
              example: '+1 (555) 123-4567',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Restaurant email address',
              example: 'info@pizzapalace.com',
            },
            description: {
              type: 'string',
              description: 'Restaurant description',
              example: 'Best pizza in town',
            },
            userId: {
              type: 'string',
              description: 'User ID of the restaurant owner',
              example: '507f1f77bcf86cd799439011',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Restaurant creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Restaurant last update timestamp',
            },
          },
        },
        CreateRestaurantRequest: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
              description: 'Restaurant name',
              example: 'Pizza Palace',
            },
            address: {
              type: 'string',
              description: 'Restaurant address',
              example: '123 Main St, City, State 12345',
            },
            phone: {
              type: 'string',
              description: 'Restaurant phone number',
              example: '+1 (555) 123-4567',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Restaurant email address',
              example: 'info@pizzapalace.com',
            },
            description: {
              type: 'string',
              description: 'Restaurant description',
              example: 'Best pizza in town',
            },
            userId: {
              type: 'string',
              description: 'User ID of the restaurant owner',
              example: '507f1f77bcf86cd799439011',
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/index.ts'], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;

