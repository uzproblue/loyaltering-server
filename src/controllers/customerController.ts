import { Request, Response } from 'express';
import { prisma } from '../utils/db';
import { ApiResponse, CreateCustomerRequest, TypedRequest } from '../types';
import { calculateCustomerBalance } from './transactionController';
import { emitTransactionEvent } from '../services/socketService';
import { sendCustomerWelcomeEmail } from '../services/emailService';

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

async function generateMemberCode(restaurantId?: string): Promise<string> {
  for (let attempt = 0; attempt < 15; attempt++) {
    const code = String(Math.floor(10000 + Math.random() * 90000));
    const exists = await prisma.customer.findFirst({
      where: restaurantId
        ? { restaurantId, memberCode: code }
        : { memberCode: code, restaurantId: null },
    });
    if (!exists) return code;
  }
  throw new Error('Failed to generate unique member code');
}

export const createCustomer = async (
  req: TypedRequest<CreateCustomerRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { name, email, phone, dateOfBirth, restaurantId } = req.body;

    if (!email || typeof email !== 'string' || email.trim() === '') {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
      });
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
      });
      return;
    }
    if (restaurantId && typeof restaurantId !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Invalid restaurant ID format',
      });
      return;
    }

    let dob: Date | undefined;
    if (dateOfBirth) {
      dob = new Date(dateOfBirth);
      if (isNaN(dob.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid date of birth format',
        });
        return;
      }
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingCustomer = await prisma.customer.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingCustomer) {
      res.status(409).json({
        success: false,
        message: 'Customer with this email already exists',
      });
      return;
    }

    const phoneNormalized = phone ? normalizePhone(phone) : undefined;
    const rid = restaurantId && typeof restaurantId === 'string' ? restaurantId.trim() : undefined;
    const memberCode = await generateMemberCode(rid || undefined);

    const savedCustomer = await prisma.customer.create({
      data: {
        email: normalizedEmail,
        memberCode,
        ...(rid && { restaurantId: rid }),
        ...(name && name.trim() !== '' && { name: name.trim() }),
        ...(phone && phone.trim() !== '' && { phone: phone.trim(), phoneNormalized }),
        ...(dob && { dateOfBirth: dob }),
      },
    });

    const welcomeBonusPoints = parseInt(process.env.WELCOME_BONUS_POINTS || '0', 10);
    const balanceAfter = welcomeBonusPoints;

    let registrationTransaction: { id: string } | null = null;
    if (savedCustomer.restaurantId) {
      registrationTransaction = await prisma.transaction.create({
        data: {
          customerId: savedCustomer.id,
          restaurantId: savedCustomer.restaurantId,
          type: 'REGISTRATION',
          amount: welcomeBonusPoints,
          description:
            welcomeBonusPoints > 0
              ? `Welcome bonus: ${welcomeBonusPoints} points awarded on registration`
              : 'Customer registration',
          balanceAfter,
          metadata: {},
        },
      });

      const transactionWithCustomer = await prisma.transaction.findUnique({
        where: { id: registrationTransaction!.id },
        include: { customer: true },
      });
      if (transactionWithCustomer) {
        emitTransactionEvent(savedCustomer.restaurantId, {
          transaction: transactionWithCustomer as any,
          customer: transactionWithCustomer.customer as any,
        });
      }
    }

    setImmediate(async () => {
      try {
        let restaurantName: string | undefined;
        if (savedCustomer.restaurantId) {
          const restaurant = await prisma.restaurant.findUnique({
            where: { id: savedCustomer.restaurantId },
            select: { name: true },
          });
          restaurantName = restaurant?.name ?? undefined;
        }
        const customerName = savedCustomer.name || savedCustomer.email.split('@')[0] || 'Customer';
        await sendCustomerWelcomeEmail(
          savedCustomer.email,
          customerName,
          savedCustomer.memberCode!,
          restaurantName
        );
      } catch (err: any) {
        console.error('[customerController] sendCustomerWelcomeEmail:', err?.message ?? err);
      }
    });

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: savedCustomer,
    });
  } catch (error: any) {
    console.error('Error creating customer:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating customer',
      error: error.message,
    });
  }
};

export const getAllCustomers = async (
  _req: Request,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const customers = await prisma.customer.findMany();
    res.status(200).json({
      success: true,
      message: 'Customers retrieved successfully',
      count: customers.length,
      data: customers,
    });
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customers',
      error: error.message,
    });
  }
};

export const getCustomerById = async (
  req: Request & { query: { includeBalance?: string } },
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { id } = req.params;
    const includeBalance = req.query.includeBalance === 'true';

    const customer = await prisma.customer.findUnique({
      where: { id },
    });
    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
      return;
    }

    const customerData: any = { ...customer };
    if (includeBalance) {
      customerData.balance = await calculateCustomerBalance(id);
    }

    res.status(200).json({
      success: true,
      message: 'Customer retrieved successfully',
      data: customerData,
    });
  } catch (error: any) {
    console.error('Error fetching customer:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customer',
      error: error.message,
    });
  }
};

export const getCustomerBalance = async (
  req: Request,
  res: Response<ApiResponse<{ balance: number }>>
): Promise<void> => {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
    });
    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
      return;
    }

    const balance = await calculateCustomerBalance(id);
    res.status(200).json({
      success: true,
      message: 'Balance retrieved successfully',
      data: { balance },
    });
  } catch (error: any) {
    console.error('Error fetching balance:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching balance',
      error: error.message,
    });
  }
};

export const searchCustomer = async (
  req: Request & { query: { q?: string; restaurantId?: string; userId?: string } },
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const qRaw = (req.query.q ?? '').toString().trim();
    const restaurantIdRaw = (req.query.restaurantId ?? '').toString().trim();
    const userId = (req.query.userId ?? '').toString().trim();

    if (!qRaw) {
      res.status(400).json({ success: false, message: 'Query parameter q is required' });
      return;
    }

    let restaurantId = restaurantIdRaw;

    if (!restaurantId && userId) {
      const restaurant = await prisma.restaurant.findFirst({
        where: { userId },
      });
      if (!restaurant) {
        res.status(404).json({ success: false, message: 'Restaurant not found for user' });
        return;
      }
      restaurantId = restaurant.id;
    }

    if (!restaurantId) {
      res.status(400).json({
        success: false,
        message: 'restaurantId (preferred) or valid userId is required for scoped search',
      });
      return;
    }

    const q = qRaw;
    const digitsOnly = q.replace(/\D/g, '');

    let customer = null;
    if (q.includes('@')) {
      customer = await prisma.customer.findFirst({
        where: { restaurantId, email: q.toLowerCase() },
      });
    } else if (q.startsWith('#') || (digitsOnly.length > 0 && digitsOnly.length <= 6)) {
      const memberCode = digitsOnly || q.replace('#', '');
      customer = await prisma.customer.findFirst({
        where: { restaurantId, memberCode },
      });
    } else {
      customer = await prisma.customer.findFirst({
        where: {
          restaurantId,
          OR: [{ phoneNormalized: digitsOnly }, { phone: q }],
        },
      });
    }

    if (!customer) {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }

    res.status(200).json({ success: true, message: 'Customer found', data: customer });
  } catch (error: any) {
    console.error('Error searching customer:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching customer',
      error: error.message,
    });
  }
};
