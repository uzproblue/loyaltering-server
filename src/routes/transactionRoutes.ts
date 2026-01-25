import express, { Router } from 'express';
import * as transactionController from '../controllers/transactionController';

const router: Router = express.Router();

/**
 * @swagger
 * /api/transactions:
 *   post:
 *     summary: Create a new transaction
 *     tags: [Transactions]
 *     description: Create a new transaction record for a customer (points earned, redeemed, etc.)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerId
 *               - restaurantId
 *               - type
 *               - amount
 *               - description
 *             properties:
 *               customerId:
 *                 type: string
 *                 description: Customer ID
 *                 example: 507f1f77bcf86cd799439011
 *               restaurantId:
 *                 type: string
 *                 description: Restaurant ID
 *                 example: 507f1f77bcf86cd799439012
 *               type:
 *                 type: string
 *                 enum: [REGISTRATION, EARNED, REDEEMED, EXPIRED, ADJUSTED, REFUNDED]
 *                 description: Transaction type
 *                 example: EARNED
 *               amount:
 *                 type: number
 *                 description: Transaction amount (positive for earned, negative for redeemed)
 *                 example: 100
 *               description:
 *                 type: string
 *                 description: Human-readable description
 *                 example: Points earned from purchase
 *               metadata:
 *                 type: object
 *                 description: Additional context (optional)
 *                 example: { purchaseAmount: 50, operatorId: "123" }
 *               createdBy:
 *                 type: string
 *                 description: Operator/user who created the transaction (optional)
 *                 example: operator@example.com
 *     responses:
 *       201:
 *         description: Transaction created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Transaction created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     customerId:
 *                       type: string
 *                     restaurantId:
 *                       type: string
 *                     type:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     description:
 *                       type: string
 *                     balanceAfter:
 *                       type: number
 *                     balance:
 *                       type: number
 *       400:
 *         description: Validation error or missing required fields
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Server error
 */
router.post('/', transactionController.createTransaction);

/**
 * @swagger
 * /api/transactions/customer/{customerId}:
 *   get:
 *     summary: Get transaction history for a customer
 *     tags: [Transactions]
 *     description: Retrieve transaction history for a specific customer with pagination
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID
 *         example: 507f1f77bcf86cd799439011
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of transactions per page
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Transactions retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                     total:
 *                       type: number
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     balance:
 *                       type: number
 *       400:
 *         description: Invalid customer ID format
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Server error
 */
router.get('/customer/:customerId', transactionController.getCustomerTransactions);

/**
 * @swagger
 * /api/transactions/customer/{customerId}/balance:
 *   get:
 *     summary: Get current balance for a customer
 *     tags: [Transactions]
 *     description: Calculate and return the current point balance for a customer
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Balance retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     balance:
 *                       type: number
 *                       example: 1250
 *       400:
 *         description: Invalid customer ID format
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Server error
 */
router.get('/customer/:customerId/balance', transactionController.getCustomerBalance);

/**
 * @swagger
 * /api/transactions/restaurant/{restaurantId}:
 *   get:
 *     summary: Get recent transactions for a restaurant
 *     tags: [Transactions]
 *     description: Retrieve recent transactions for a specific restaurant
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Restaurant ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of transactions to retrieve
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 *       400:
 *         description: Restaurant ID is required
 *       500:
 *         description: Server error
 */
router.get('/restaurant/:restaurantId', transactionController.getRestaurantTransactions);

export default router;
