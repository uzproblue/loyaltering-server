import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Customer from '../models/Customer';
import Restaurant from '../models/Restaurant';
import Transaction from '../models/Transaction';
import { ApiResponse, CreateCustomerRequest, TypedRequest } from '../types';
import { calculateCustomerBalance } from './transactionController';
import { emitTransactionEvent } from '../services/socketService';
import { sendCustomerWelcomeEmail } from '../services/emailService';

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

async function generateMemberCode(restaurantId?: string): Promise<string> {
  // 5-digit member code: 10000–99999
  for (let attempt = 0; attempt < 15; attempt++) {
    const code = String(Math.floor(10000 + Math.random() * 90000));

    const query: any = { memberCode: code };
    if (restaurantId) query.restaurantId = restaurantId;

    const exists = await Customer.exists(query);
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

    // Only email is required
    if (!email || typeof email !== 'string' || email.trim() === '') {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
      return;
    }

    // Validate email format
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email.trim())) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
      return;
    }

    // Validate restaurantId if provided
    if (restaurantId && typeof restaurantId !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Invalid restaurant ID format'
      });
      return;
    }

    // Validate date of birth format if provided
    let dob: Date | undefined;
    if (dateOfBirth) {
      dob = new Date(dateOfBirth);
      if (isNaN(dob.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid date of birth format'
        });
        return;
      }
    }

    // Check if customer already exists
    const existingCustomer = await Customer.findOne({ email });
    if (existingCustomer) {
      res.status(409).json({
        success: false,
        message: 'Customer with this email already exists'
      });
      return;
    }

    // Create new customer
    const phoneNormalized = phone ? normalizePhone(phone) : undefined;
    const memberCode = await generateMemberCode(restaurantId || undefined);

    const customerData: any = {
      email: email.trim().toLowerCase(),
      memberCode,
      restaurantId: restaurantId || undefined
    };

    // Add optional fields only if provided
    if (name && typeof name === 'string' && name.trim() !== '') {
      customerData.name = name.trim();
    }

    if (phone && typeof phone === 'string' && phone.trim() !== '') {
      customerData.phone = phone.trim();
      customerData.phoneNormalized = phoneNormalized;
    }

    if (dob) {
      customerData.dateOfBirth = dob;
    }

    const customer = new Customer(customerData);

    const savedCustomer = await customer.save();
    
    // Create REGISTRATION transaction (welcome bonus points)
    // Default welcome bonus is 0, but transaction is created for audit trail
    const welcomeBonusPoints = parseInt(process.env.WELCOME_BONUS_POINTS || '0', 10);
    
    const registrationTransaction = new Transaction({
      customerId: savedCustomer._id,
      restaurantId: savedCustomer.restaurantId || '',
      type: 'REGISTRATION',
      amount: welcomeBonusPoints,
      description: welcomeBonusPoints > 0 
        ? `Welcome bonus: ${welcomeBonusPoints} points awarded on registration`
        : 'Customer registration',
      metadata: {}
    });

    await registrationTransaction.save();
    
    // Populate customer data and emit real-time event
    const transactionWithCustomer = await Transaction.findById(registrationTransaction._id)
      .populate('customerId', 'name email')
      .lean();
    
    if (transactionWithCustomer && savedCustomer.restaurantId) {
      emitTransactionEvent(savedCustomer.restaurantId, {
        transaction: transactionWithCustomer,
        customer: transactionWithCustomer.customerId
      });
    }

    // Send customer welcome email with member ID and QR code (fire-and-forget)
    setImmediate(async () => {
      try {
        let restaurantName: string | undefined;
        if (savedCustomer.restaurantId) {
          const restaurant = await Restaurant.findById(savedCustomer.restaurantId).select('name').lean();
          restaurantName = restaurant?.name;
        }
        // Use name if available, otherwise use email or a default
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

    const customerResponse = savedCustomer.toObject();

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: customerResponse
    });
  } catch (error: any) {
    console.error('Error creating customer:', error);
    
    if (error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map((err: any) => err.message)
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Error creating customer',
      error: error.message
    });
  }
};

export const getAllCustomers = async (
  _req: Request,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const customers = await Customer.find();
    res.status(200).json({
      success: true,
      message: 'Customers retrieved successfully',
      count: customers.length,
      data: customers
    });
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customers',
      error: error.message
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
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
      return;
    }

    const customer = await Customer.findById(id);
    
    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
      return;
    }

    const customerData: any = customer.toObject();
    
    // Optionally include balance
    if (includeBalance) {
      customerData.balance = await calculateCustomerBalance(id);
    }

    res.status(200).json({
      success: true,
      message: 'Customer retrieved successfully',
      data: customerData
    });
  } catch (error: any) {
    console.error('Error fetching customer:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customer',
      error: error.message
    });
  }
};

/**
 * Get customer balance
 */
export const getCustomerBalance = async (
  req: Request,
  res: Response<ApiResponse<{ balance: number }>>
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
      return;
    }

    // Verify customer exists
    const customer = await Customer.findById(id);
    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
      return;
    }

    // Calculate balance from all transactions
    const balance = await calculateCustomerBalance(id);

    res.status(200).json({
      success: true,
      message: 'Balance retrieved successfully',
      data: { balance }
    });
  } catch (error: any) {
    console.error('Error fetching balance:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching balance',
      error: error.message
    });
  }
};

/**
 * Search customer for an operator by q (memberCode, phone, or email)
 * Scoped to a restaurant via restaurantId (preferred).
 * Backwards-compatible fallback: if restaurantId is missing, tries userId -> restaurant lookup.
 *
 * GET /api/customers/search?q=...&restaurantId=...
 * GET /api/customers/search?q=...&userId=... (fallback)
 */
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

    // Preferred: scope by explicit restaurantId
    if (restaurantId) {
      // Most restaurantIds are Mongo ObjectIds; validate when it looks like one
      if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
        res.status(400).json({ success: false, message: 'Valid restaurantId is required for scoped search' });
        return;
      }
    } else {
      // Fallback: derive restaurantId from operator userId
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ success: false, message: 'restaurantId (preferred) or valid userId is required for scoped search' });
        return;
      }

      const restaurant = await Restaurant.findOne({ userId: new mongoose.Types.ObjectId(userId) });
      if (!restaurant) {
        res.status(404).json({ success: false, message: 'Restaurant not found for user' });
        return;
      }

      restaurantId = restaurant._id.toString();
    }

    const q = qRaw;
    const digitsOnly = q.replace(/\D/g, '');

    const baseQuery: any = { restaurantId };

    let customer: any = null;

    if (q.includes('@')) {
      customer = await Customer.findOne({ ...baseQuery, email: q.toLowerCase() });
    } else if (q.startsWith('#') || (digitsOnly && digitsOnly.length > 0 && digitsOnly.length <= 6)) {
      const memberCode = digitsOnly || q.replace('#', '');
      customer = await Customer.findOne({ ...baseQuery, memberCode });
    } else {
      // Phone lookup. Prefer normalized, fallback to exact phone match.
      customer = await Customer.findOne({
        ...baseQuery,
        $or: [
          { phoneNormalized: digitsOnly },
          { phone: q }
        ]
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
      error: error.message
    });
  }
};

