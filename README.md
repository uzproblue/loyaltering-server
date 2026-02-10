# Server

Node.js server with PostgreSQL (Neon) database and user creation endpoints.

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database (e.g. [Neon](https://neon.tech) – use `DATABASE_URL` from the Neon dashboard)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the server directory and configure your environment variables:
```
PORT=3000
DATABASE_URL=postgresql://user:password@host/db?sslmode=require
JWT_SECRET=your-secret-key-here-change-in-production
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

For **Neon**: create a project in the [Neon dashboard](https://neon.tech), then copy the connection string. For serverless (e.g. Vercel, Render), use Neon’s **pooled** connection string to avoid exhausting connections.

3. Run migrations (with `DATABASE_URL` pointing at your Neon database):
```bash
npx prisma migrate deploy
```

Generate a JWT secret:
```bash
openssl rand -base64 32
```

### Twilio / Email (SendGrid)

Transactional email (welcome email on registration, password reset) uses **SendGrid** (Twilio’s email API). Configure these in `.env`:

| Variable | Description |
|----------|-------------|
| `SENDGRID_API_KEY` | SendGrid API key (create in SendGrid dashboard). Required for sending email. |
| `FROM_EMAIL` | Verified sender email in SendGrid (e.g. `noreply@yourdomain.com`). |
| `APP_URL` | Base URL of the platform app (e.g. `https://yourapp.com`). Used for password-reset links. |
| `APP_NAME` | Optional. App name used in email copy (default: `Loyaltering`). |

The sender (`FROM_EMAIL`) must be verified in SendGrid (single sender or domain authentication). If `SENDGRID_API_KEY` is not set, welcome and password-reset emails are skipped and a warning is logged.

**Extensibility:** Future Twilio features (SMS, Verify for 2FA, etc.) can be added via new server services and env vars (e.g. `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`) without changing the existing email flow.

## Running the Server

### Development mode (with auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm run build
npm start
```

The server will start on port 3000 (or the port specified in your `.env` file).

## API Documentation (Swagger)

Once the server is running, you can access the interactive Swagger API documentation at:

**http://localhost:3000/api-docs**

The Swagger UI provides:
- Complete API endpoint documentation
- Request/response schemas
- Try-it-out functionality to test endpoints directly
- Example requests and responses

## API Endpoints

### Health Check
- **GET** `/health` - Check if server is running

### User Endpoints

#### Create Customer
- **POST** `/api/customers`
- **Body:**
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "User created successfully",
    "data": {
      "id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
  ```

#### Get All Customers
- **GET** `/api/customers`
- **Response:**
  ```json
  {
    "success": true,
    "count": 1,
    "data": [...]
  }
  ```

#### Get Customer by ID
- **GET** `/api/customers/:id`
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
  ```

## Project Structure

```
server/
├── prisma/
│   ├── schema.prisma       # Prisma schema (PostgreSQL)
│   └── migrations/         # Database migrations
├── src/
│   ├── config/
│   │   └── swagger.ts      # Swagger configuration
│   ├── controllers/        # Request handlers
│   ├── middleware/         # Auth, DB check, etc.
│   ├── routes/             # API routes
│   ├── services/           # Notification, R2, etc.
│   ├── types/
│   │   └── index.ts        # TypeScript type definitions
│   ├── utils/
│   │   ├── db.ts           # Prisma client (PostgreSQL)
│   │   └── auth.ts         # Password hashing helpers
│   └── index.ts            # Main server file
├── dist/                   # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Notes

- **Database:** PostgreSQL via Prisma; use Neon’s `DATABASE_URL`. For serverless, use Neon’s pooled connection string or Prisma’s serverless driver adapter if needed.
- **Customer model:** Used for customer-facing features (name, email, phone, dateOfBirth).
- **Platform User model:** Used for platform authentication with password hashing (bcrypt) and role-based access.
- Platform user passwords are hashed using bcryptjs before storage.
- JWT tokens are used for platform user authentication (expires in 7 days).
- Platform users have roles: 'admin' or 'user' (default: 'user').
- The server uses CORS middleware to allow cross-origin requests from the platform app.
- All user responses exclude password fields for security.
- **Email:** Registration sends a welcome email (SendGrid); forgot-password sends a reset link. Reset tokens expire in 1 hour.
