import { z } from 'zod';

// Auth validation schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(2, 'Full name must be at least 2 characters').optional(),
});

// Cart validation schemas
export const addToCartSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(99, 'Quantity cannot exceed 99'),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(99, 'Quantity cannot exceed 99'),
});

// Checkout validation schemas
export const checkoutSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid('Invalid product ID'),
    quantity: z.number().int().min(1, 'Quantity must be at least 1').max(99, 'Quantity cannot exceed 99'),
  })).min(1, 'At least one item is required'),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

// Review validation schemas
export const createReviewSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  content: z.string().min(1, 'Content is required').max(2000, 'Content must be less than 2000 characters'),
});

export const updateReviewSchema = createReviewSchema.partial();

// Wishlist validation schemas
export const addToWishlistSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
});

// Order validation schemas
export const createOrderSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  customer_email: z.string().email('Invalid email address'),
  amount_total: z.number().positive('Amount must be positive'),
  payment_reference: z.string().min(1, 'Payment reference is required'),
  lemonsqueezy_order_id: z.string().optional(),
  status: z.enum(['pending', 'completed', 'cancelled', 'refunded']).default('pending'),
  products: z.array(z.string().uuid()).min(1, 'At least one product is required'),
});

// Download validation schemas
export const downloadSchema = z.object({
  token: z.string().min(1, 'Download token is required'),
});

// Admin validation schemas
export const adminLoginSchema = loginSchema;

// Utility function to validate data
export function validateData(schema, data) {
  try {
    return { success: true, data: schema.parse(data) };
  } catch (error) {
    return {
      success: false,
      error: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    };
  }
}

// Middleware function for API routes
export function validateRequest(schema) {
  return async (request) => {
    try {
      const body = await request.json();
      const validation = validateData(schema, body);

      if (!validation.success) {
        return Response.json(
          { error: 'Validation failed', details: validation.error },
          { status: 400 }
        );
      }

      return validation.data;
    } catch (error) {
      return Response.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }
  };
}