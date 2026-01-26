import express, { Router } from 'express';
import * as restaurantController from '../controllers/restaurantController';
import { authenticate } from '../middleware/auth';

const router: Router = express.Router();

/**
 * @swagger
 * /api/restaurants:
 *   post:
 *     summary: Create a new restaurant
 *     tags: [Restaurants]
 *     description: Create a new restaurant with name and optional details
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateRestaurantRequest'
 *           examples:
 *             example1:
 *               value:
 *                 name: "Pizza Palace"
 *                 address: "123 Main St, City, State 12345"
 *                 phone: "+1 (555) 123-4567"
 *                 email: "info@pizzapalace.com"
 *                 description: "Best pizza in town"
 *                 userId: "507f1f77bcf86cd799439011"
 *     responses:
 *       201:
 *         description: Restaurant created successfully
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
 *                   example: Restaurant created successfully
 *                 data:
 *                   $ref: '#/components/schemas/RestaurantResponse'
 *       400:
 *         description: Validation error or missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Restaurant name is required
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', restaurantController.createRestaurant);

/**
 * @swagger
 * /api/restaurants:
 *   get:
 *     summary: Get all restaurants
 *     tags: [Restaurants]
 *     description: Retrieve a list of all restaurants
 *     responses:
 *       200:
 *         description: List of restaurants retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: number
 *                   example: 2
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RestaurantResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', restaurantController.getAllRestaurants);

/**
 * @swagger
 * /api/restaurants/locations:
 *   get:
 *     summary: Get all locations for the current user's restaurant
 *     tags: [Restaurants]
 *     description: Retrieve all location Restaurant documents associated with the current user's restaurant
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Locations retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/locations', authenticate, restaurantController.getRestaurantLocations);

/**
 * @swagger
 * /api/restaurants/{id}:
 *   get:
 *     summary: Get restaurant by ID
 *     tags: [Restaurants]
 *     description: Retrieve a specific restaurant by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Restaurant ID
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Restaurant retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/RestaurantResponse'
 *       400:
 *         description: Invalid restaurant ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Invalid restaurant ID
 *       404:
 *         description: Restaurant not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Restaurant not found
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', restaurantController.getRestaurantById);

/**
 * @swagger
 * /api/restaurants/{id}:
 *   put:
 *     summary: Update restaurant by ID
 *     tags: [Restaurants]
 *     description: Update a specific restaurant by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Restaurant ID
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               address:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               locations:
 *                 type: string
 *               country:
 *                 type: string
 *               plan:
 *                 type: string
 *               billingCycle:
 *                 type: string
 *                 enum: [Monthly, Yearly]
 *     responses:
 *       200:
 *         description: Restaurant updated successfully
 *       400:
 *         description: Invalid restaurant ID format or validation error
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Server error
 */
router.put('/:id', restaurantController.updateRestaurant);

/**
 * @swagger
 * /api/restaurants/locations:
 *   post:
 *     summary: Create a new location and operator
 *     tags: [Restaurants]
 *     description: Create a new location (Restaurant document) and an operator user for that location
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - storeName
 *               - address
 *               - category
 *               - operatorName
 *               - operatorEmail
 *             properties:
 *               storeName:
 *                 type: string
 *                 example: "Downtown Flagship Store"
 *               address:
 *                 type: string
 *                 example: "123 Main St, City, State 12345"
 *               category:
 *                 type: string
 *                 example: "Retail"
 *               operatorName:
 *                 type: string
 *                 example: "John Doe"
 *               operatorEmail:
 *                 type: string
 *                 example: "john@example.com"
 *               autoInvite:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Location and operator created successfully
 *       400:
 *         description: Validation error or missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only admins can create locations
 *       409:
 *         description: User with this email already exists
 *       500:
 *         description: Server error
 */
router.post('/locations', authenticate, restaurantController.createLocation);

export default router;
