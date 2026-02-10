import Stripe from 'stripe';
import { prisma } from '../utils/db';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.warn('STRIPE_SECRET_KEY is not set; Stripe features will be disabled');
}

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2026-01-28.clover' })
  : null;

const PRICE_KEYS: Record<string, Record<string, string>> = {
  basic: {
    Monthly: 'STRIPE_PRICE_BASIC_MONTHLY',
    Yearly: 'STRIPE_PRICE_BASIC_YEARLY',
  },
  professional: {
    Monthly: 'STRIPE_PRICE_PROFESSIONAL_MONTHLY',
    Yearly: 'STRIPE_PRICE_PROFESSIONAL_YEARLY',
  },
  enterprise: {
    Monthly: 'STRIPE_PRICE_ENTERPRISE_MONTHLY',
    Yearly: 'STRIPE_PRICE_ENTERPRISE_YEARLY',
  },
};

export function getPriceId(
  plan: string,
  billingCycle: 'Monthly' | 'Yearly'
): string | null {
  const key = PRICE_KEYS[plan.toLowerCase()]?.[billingCycle];
  if (!key) return null;
  return process.env[key] || null;
}

export interface CreateCheckoutSessionParams {
  restaurantId: string;
  customerEmail: string;
  plan: string;
  billingCycle: 'Monthly' | 'Yearly';
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<{ url: string }> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const { restaurantId, customerEmail, plan, billingCycle, successUrl, cancelUrl } = params;
  const priceId = getPriceId(plan, billingCycle);
  if (!priceId) {
    throw new Error(`Invalid plan or billing cycle: ${plan} / ${billingCycle}`);
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });
  if (!restaurant) {
    throw new Error('Restaurant not found');
  }

  let stripeCustomerId: string | null = restaurant.stripeCustomerId;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: customerEmail,
      metadata: { restaurantId },
    });
    stripeCustomerId = customer.id;
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { stripeCustomerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { restaurantId },
    subscription_data: {
      metadata: { restaurantId },
    },
  });

  if (!session.url) {
    throw new Error('Failed to create checkout session URL');
  }

  return { url: session.url };
}

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const restaurantId = session.metadata?.restaurantId;
  if (!restaurantId) return;

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id;

  if (subscriptionId && customerId) {
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: 'active',
      },
    });
  }
}

export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  await prisma.restaurant.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: { subscriptionStatus: subscription.status },
  });
}

export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  await prisma.restaurant.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      subscriptionStatus: 'canceled',
      stripeSubscriptionId: null,
    },
  });
}
