import { Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import Restaurant from '../models/Restaurant';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Get current user profile
 */
export const getUserProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userEmail = req.user?.email;

    if (!userId && !userEmail) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Find user by ID or email
    let user;
    if (userId) {
      user = await User.findById(userId).select('-password');
    } else if (userEmail) {
      user = await User.findOne({ email: userEmail }).select('-password');
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      data: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        businessName: user.businessName,
        bio: (user as any).bio || '',
        avatar: (user as any).avatar || '',
        role: user.role,
        restaurantId: (user as any).restaurantId ? (user as any).restaurantId.toString() : undefined,
        onboardingCompleted: (user as any).onboardingCompleted || false,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Update current user profile
 */
export const updateUserProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userEmail = req.user?.email;

    if (!userId && !userEmail) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { name, email, bio, avatar } = (req as any).body;

    // Find user by ID or email
    let user;
    if (userId) {
      user = await User.findById(userId);
    } else if (userEmail) {
      user = await User.findOne({ email: userEmail });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email already in use',
        });
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.toLowerCase().trim();
    if (bio !== undefined) updateData.bio = bio || '';
    if (avatar !== undefined) {
      // Limit avatar size to prevent database issues (base64 can be large)
      // In production, consider storing images in cloud storage instead
      if (avatar && avatar.length > 1000000) { // ~1MB limit
        return res.status(400).json({
          success: false,
          message: 'Avatar image is too large. Please use an image smaller than 1MB.',
        });
      }
      updateData.avatar = avatar || '';
    }

    user = await User.findByIdAndUpdate(
      user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        businessName: user.businessName,
        bio: (user as any).bio || '',
        avatar: (user as any).avatar || '',
        role: user.role,
        restaurantId: (user as any).restaurantId ? (user as any).restaurantId.toString() : undefined,
        onboardingCompleted: (user as any).onboardingCompleted || false,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((err: any) => err.message).join(', '),
      });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Update onboarding completion status
 */
export const updateOnboardingStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userEmail = req.user?.email;

    if (!userId && !userEmail) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const {
      onboardingCompleted,
      businessName,
      category,
      locations,
      country,
      plan,
      billingCycle
    } = req.body;

    // Find user by ID or email
    let user;
    if (userId) {
      user = await User.findById(userId);
    } else if (userEmail) {
      user = await User.findOne({ email: userEmail });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update user data
    const userUpdateData: any = {};
    if (onboardingCompleted !== undefined) {
      userUpdateData.onboardingCompleted = onboardingCompleted;
    }
    if (businessName !== undefined) {
      userUpdateData.businessName = businessName.trim();
    }

    user = await User.findByIdAndUpdate(
      user._id,
      { $set: userUpdateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update restaurant with onboarding data if restaurantId exists
    if ((user as any).restaurantId) {
      const restaurantUpdateData: any = {};
      if (businessName !== undefined) {
        restaurantUpdateData.name = businessName.trim();
      }
      if (category !== undefined) {
        restaurantUpdateData.category = category.trim();
      }
      if (locations !== undefined) {
        restaurantUpdateData.locations = locations.trim();
      }
      if (country !== undefined) {
        restaurantUpdateData.country = country.trim();
      }
      if (plan !== undefined) {
        restaurantUpdateData.plan = plan.trim();
      }
      if (billingCycle !== undefined) {
        restaurantUpdateData.billingCycle = billingCycle;
      }

      if (Object.keys(restaurantUpdateData).length > 0) {
        await Restaurant.findByIdAndUpdate(
          (user as any).restaurantId,
          { $set: restaurantUpdateData },
          { new: true, runValidators: true }
        );
      }
    }

    res.json({
      success: true,
      message: 'Onboarding status updated successfully',
      data: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        businessName: user.businessName,
        onboardingCompleted: (user as any).onboardingCompleted || false,
      },
    });
  } catch (error: any) {
    console.error('Error updating onboarding status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Get team members (for admin users)
 */
export const getTeamMembers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userEmail = req.user?.email;

    if (!userId && !userEmail) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Find user by ID or email
    let currentUser;
    if (userId) {
      currentUser = await User.findById(userId);
    } else if (userEmail) {
      currentUser = await User.findOne({ email: userEmail });
    }

    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Get restaurantId from current user
    const restaurantId = (currentUser as any).restaurantId;

    // Build query: filter by restaurantId and exclude current user
    const query: any = { _id: { $ne: currentUser._id } };
    if (restaurantId) {
      query.restaurantId = restaurantId;
    }

    // Get team members from same restaurant
    const teamMembers = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: teamMembers.map((user: any) => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: (user as any).avatar || '',
        locationAccess: (user as any).locationAccess || [],
        createdAt: user.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Generate a secure random password
 */
const generatePassword = (length: number = 12): string => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + special;
  
  let password = '';
  // Ensure at least one character from each category
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill the rest with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

/**
 * Invite a new team member
 */
export const inviteTeamMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userEmail = req.user?.email;

    if (!userId && !userEmail) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Find current user (inviter)
    let currentUser;
    if (userId) {
      currentUser = await User.findById(userId);
    } else if (userEmail) {
      currentUser = await User.findOne({ email: userEmail });
    }

    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Only admins can invite team members
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admins can invite team members' });
    }

    const { name, email, role, locationIds } = req.body;

    // Validate required fields
    if (!name || !email || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and role are required'
      });
    }

    // Validate email format
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Map frontend role 'operator' to database role 'user'
    const dbRole = role === 'operator' ? 'user' : role;

    // Validate location access based on role
    if (dbRole === 'user') {
      // Operators must have exactly one location
      if (!locationIds || !Array.isArray(locationIds) || locationIds.length !== 1) {
        return res.status(400).json({
          success: false,
          message: 'Operators must have exactly one location assigned'
        });
      }
    } else if (dbRole === 'admin') {
      // Admins can have empty array (all locations) or multiple locations
      if (locationIds && !Array.isArray(locationIds)) {
        return res.status(400).json({
          success: false,
          message: 'Location IDs must be an array'
        });
      }
    }

    // Generate secure password
    const generatedPassword = generatePassword(12);

    // Create new user
    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: generatedPassword, // Will be hashed by pre-save hook
      role: dbRole,
      restaurantId: (currentUser as any).restaurantId,
      locationAccess: locationIds || [],
      invitedBy: currentUser._id,
      onboardingCompleted: false
    });

    await newUser.save();

    // Return user data with generated password (for admin to share)
    res.status(201).json({
      success: true,
      message: 'Team member invited successfully',
      data: {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        locationAccess: (newUser as any).locationAccess || [],
        password: generatedPassword, // Include password so admin can share it
        createdAt: newUser.createdAt
      }
    });
  } catch (error: any) {
    console.error('Error inviting team member:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((err: any) => err.message).join(', ')
      });
    }
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Update team member (for admin users)
 */
export const updateTeamMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userEmail = req.user?.email;

    if (!userId && !userEmail) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Find current user (updater)
    let currentUser;
    if (userId) {
      currentUser = await User.findById(userId);
    } else if (userEmail) {
      currentUser = await User.findOne({ email: userEmail });
    }

    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Only admins can update team members
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admins can update team members' });
    }

    const { memberId, name, email, role, locationIds, password } = req.body;

    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: 'Member ID is required'
      });
    }

    // Find the team member to update
    const teamMember = await User.findById(memberId);

    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
      });
    }

    // Ensure the team member is from the same restaurant
    const currentRestaurantId = (currentUser as any).restaurantId?.toString();
    const memberRestaurantId = (teamMember as any).restaurantId?.toString();

    if (currentRestaurantId && memberRestaurantId && currentRestaurantId !== memberRestaurantId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update team members from your own restaurant'
      });
    }

    // Validate email if being changed
    if (email && email !== teamMember.email) {
      const existingUser = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: memberId } });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email already in use'
        });
      }
    }

    // Map frontend role 'operator' to database role 'user'
    const dbRole = role === 'operator' ? 'user' : role;

    // Validate location access based on role
    if (dbRole === 'user') {
      // Operators must have exactly one location
      if (!locationIds || !Array.isArray(locationIds) || locationIds.length !== 1) {
        return res.status(400).json({
          success: false,
          message: 'Operators must have exactly one location assigned'
        });
      }
    } else if (dbRole === 'admin') {
      // Admins can have empty array (all locations) or multiple locations
      if (locationIds && !Array.isArray(locationIds)) {
        return res.status(400).json({
          success: false,
          message: 'Location IDs must be an array'
        });
      }
    }

    // Build update data
    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.toLowerCase().trim();
    if (role) updateData.role = dbRole;
    if (locationIds !== undefined) {
      updateData.locationAccess = locationIds;
    }
    if (password) {
      // Hash password manually since findByIdAndUpdate bypasses pre-save hooks
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    // Update the team member
    const updatedMember = await User.findByIdAndUpdate(
      memberId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedMember) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
      });
    }

    res.json({
      success: true,
      message: 'Team member updated successfully',
      data: {
        id: updatedMember._id.toString(),
        name: updatedMember.name,
        email: updatedMember.email,
        role: updatedMember.role,
        locationAccess: (updatedMember as any).locationAccess || [],
        createdAt: updatedMember.createdAt,
        updatedAt: updatedMember.updatedAt,
      }
    });
  } catch (error: any) {
    console.error('Error updating team member:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((err: any) => err.message).join(', ')
      });
    }
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email already in use'
      });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

