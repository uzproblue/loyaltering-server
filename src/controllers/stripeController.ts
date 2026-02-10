import { Response } from 'express';
import Stripe from 'stripe';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  stripe,
  createCheckoutSession,
  handleCheckoutSessionCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from '../services/stripeService';
import { prisma } from '../utils/db';

export async function createCheckoutSessionHandler(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!stripe) {
      res.status(503).json({
        success: false,
        message: 'Stripe is not configured',
      });
      return;
    }

    const userId = req.user?.userId;
    const userEmail = req.user?.email;
    if (!userId && !userEmail) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: userId ? { id: userId } : { email: userEmail },
      select: { restaurantId: true, email: true },
    });
    if (!user?.restaurantId) {
      res.status(400).json({
        success: false,
        message: 'User has no restaurant; complete registration first',
      });
      return;
    }

    const { plan, billingCycle } = req.body as { plan?: string; billingCycle?: 'Monthly' | 'Yearly' };
    if (!plan || !billingCycle) {
      res.status(400).json({
        success: false,
        message: 'plan and billingCycle are required',
      });
      return;
    }

    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.STRIPE_SUCCESS_URL?.replace(/\?.*$/, '').replace(/\/[^/]*$/, '') ||
      'http://localhost:3001';
    const successUrl = process.env.STRIPE_SUCCESS_URL || `${frontendUrl}/onboarding?payment=success`;
    const cancelUrl = process.env.STRIPE_CANCEL_URL || `${frontendUrl}/onboarding?payment=cancel`;

    const result = await createCheckoutSession({
      restaurantId: user.restaurantId,
      customerEmail: user.email,
      plan: plan.trim().toLowerCase(),
      billingCycle: billingCycle === 'Yearly' ? 'Yearly' : 'Monthly',
      successUrl,
      cancelUrl,
    });

    res.json({ success: true, url: result.url });
  } catch (err: any) {
    console.error('Stripe createCheckoutSession error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to create checkout session',
    });
  }
}

export async function handleWebhook(req: Response['req'], res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret || !stripe) {
    res.status(400).send('Webhook secret or signature missing');
    return;
  }

  let event: Stripe.Event;
  const body = req.body;
  if (Buffer.isBuffer(body)) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }
  } else {
    res.status(400).send('Webhook body must be raw buffer');
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription') {
          await handleCheckoutSessionCompleted(session);
        }
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      default:
        // Unhandled event type
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}
