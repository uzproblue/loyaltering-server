import express from 'express';
import { authenticate } from '../middleware/auth';
import { createCheckoutSessionHandler } from '../controllers/stripeController';

const router = express.Router();

/**
 * POST /api/stripe/create-checkout-session
 * Body: { plan: string, billingCycle: 'Monthly' | 'Yearly' }
 * Returns: { success: true, url: string } (Stripe Checkout URL)
 */
router.post('/create-checkout-session', authenticate, createCheckoutSessionHandler);

export default router;
