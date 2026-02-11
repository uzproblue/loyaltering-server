import express, { Router } from 'express';
import * as walletController from '../controllers/walletController';

const router: Router = express.Router();

/**
 * @swagger
 * /api/wallet/google-pass:
 *   post:
 *     summary: Get Add to Google Wallet save URL
 *     tags: [Wallet]
 *     description: Returns a signed save URL for adding the customer's loyalty pass to Google Wallet. Requires customerId and restaurantId.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerId
 *               - restaurantId
 *             properties:
 *               customerId:
 *                 type: string
 *                 description: Customer ID (from signup response)
 *               restaurantId:
 *                 type: string
 *                 description: Restaurant ID the customer belongs to
 *     responses:
 *       200:
 *         description: Save URL returned successfully
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     saveUrl:
 *                       type: string
 *                       description: URL to redirect the user to add the pass to Google Wallet
 *       400:
 *         description: Missing or invalid customerId/restaurantId
 *       403:
 *         description: Customer does not belong to the restaurant
 *       404:
 *         description: Customer not found
 *       503:
 *         description: Google Wallet not configured on server
 *       500:
 *         description: Server error
 */
router.post('/google-pass', walletController.createGooglePass);

export default router;
