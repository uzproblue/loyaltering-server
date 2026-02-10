import { Response } from 'express';
import { prisma } from '../utils/db';
import { hashPassword } from '../utils/auth';
import type { UserDocument } from '../types';
import { AuthenticatedRequest } from '../middleware/auth';
import { sendTeamMemberInviteEmail } from '../services/emailService';
import { resolveImageUrl } from '../services/r2Service';

async function findUserByIdOrEmail(userId: string | undefined, userEmail: string | undefined) {
  if (userId) return prisma.user.findUnique({ where: { id: userId } });
  if (userEmail) return prisma.user.findFirst({ where: { email: userEmail } });
  return null;
}

function omitPassword<T extends { password?: string }>(user: T): Omit<T, 'password'> {
  const { password: _, ...rest } = user;
  return rest;
}

export const getUserProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userEmail = req.user?.email;
    if (!userId && !userEmail) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await findUserByIdOrEmail(userId, userEmail);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const avatarUrl = await resolveImageUrl(user.avatar || '');

    return res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        businessName: user.businessName ?? undefined,
        bio: user.bio || '',
        avatar: avatarUrl,
        role: user.role,
        restaurantId: user.restaurantId ?? undefined,
        onboardingCompleted: user.onboardingCompleted,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateUserProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userEmail = req.user?.email;
    if (!userId && !userEmail) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const body = (req as any).body;
    const { name, email, bio, avatar } = body;

    const user = await findUserByIdOrEmail(userId, userEmail);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (email && email !== user.email) {
      const existing = await prisma.user.findFirst({
        where: { email: email.toLowerCase().trim(), id: { not: user.id } },
      });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Email already in use' });
      }
    }

    const updateData: { name?: string; email?: string; bio?: string; avatar?: string } = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.toLowerCase().trim();
    if (bio !== undefined) updateData.bio = bio || '';
    if (avatar !== undefined) {
      const value = typeof avatar === 'string' ? avatar.trim() : '';
      if (value.startsWith('data:') && value.length > 2000) {
        return res.status(400).json({
          success: false,
          message: 'Please upload avatar via POST /api/upload/image?type=avatar and use the returned key or url',
        });
      }
      updateData.avatar = value;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    const avatarUrl = await resolveImageUrl(updated.avatar || '');

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        businessName: updated.businessName ?? undefined,
        bio: updated.bio || '',
        avatar: avatarUrl,
        role: updated.role,
        restaurantId: updated.restaurantId ?? undefined,
        onboardingCompleted: updated.onboardingCompleted,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

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
      billingCycle,
    } = req.body;

    const user = await findUserByIdOrEmail(userId, userEmail);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userUpdateData: { onboardingCompleted?: boolean; businessName?: string } = {};
    if (onboardingCompleted !== undefined) userUpdateData.onboardingCompleted = onboardingCompleted;
    if (businessName !== undefined) userUpdateData.businessName = businessName.trim();

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: userUpdateData,
    });

    if (user.restaurantId) {
      const restaurantUpdateData: Record<string, unknown> = {};
      if (businessName !== undefined) restaurantUpdateData.name = businessName.trim();
      if (category !== undefined) restaurantUpdateData.category = category.trim();
      if (locations !== undefined) restaurantUpdateData.locations = locations.trim();
      if (country !== undefined) restaurantUpdateData.country = country.trim();
      if (plan !== undefined) restaurantUpdateData.plan = plan.trim();
      if (billingCycle !== undefined) restaurantUpdateData.billingCycle = billingCycle;
      if (Object.keys(restaurantUpdateData).length > 0) {
        await prisma.restaurant.update({
          where: { id: user.restaurantId },
          data: restaurantUpdateData as any,
        });
      }
    }

    return res.json({
      success: true,
      message: 'Onboarding status updated successfully',
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        businessName: updated.businessName ?? undefined,
        onboardingCompleted: updated.onboardingCompleted,
      },
    });
  } catch (error: any) {
    console.error('Error updating onboarding status:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getTeamMembers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userEmail = req.user?.email;
    if (!userId && !userEmail) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const currentUser = await findUserByIdOrEmail(userId, userEmail);
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const restaurantId = currentUser.restaurantId;
    const teamMembers = await prisma.user.findMany({
      where: {
        id: { not: currentUser.id },
        ...(restaurantId ? { restaurantId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    const membersWithAvatars = await Promise.all(
      teamMembers.map(async (u: UserDocument) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        avatar: await resolveImageUrl(u.avatar || ''),
        locationAccess: u.locationAccess || [],
        createdAt: u.createdAt,
      }))
    );

    return res.json({ success: true, data: membersWithAvatars });
  } catch (error) {
    console.error('Error fetching team members:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const generatePassword = (length: number = 12): string => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + special;
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

export const inviteTeamMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userEmail = req.user?.email;
    if (!userId && !userEmail) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const currentUser = await findUserByIdOrEmail(userId, userEmail);
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admins can invite team members' });
    }

    const { name, email, role, locationIds } = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({ success: false, message: 'Name, email, and role are required' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'User with this email already exists' });
    }

    const dbRole = role === 'operator' ? 'user' : role;
    if (dbRole === 'user') {
      if (!locationIds || !Array.isArray(locationIds) || locationIds.length !== 1) {
        return res.status(400).json({
          success: false,
          message: 'Operators must have exactly one location assigned',
        });
      }
    } else if (dbRole === 'admin' && locationIds !== undefined && !Array.isArray(locationIds)) {
      return res.status(400).json({ success: false, message: 'Location IDs must be an array' });
    }

    const generatedPassword = generatePassword(12);
    const hashed = await hashPassword(generatedPassword);

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashed,
        role: dbRole,
        restaurantId: currentUser.restaurantId ?? undefined,
        locationAccess: locationIds || [],
        invitedBy: currentUser.id,
        onboardingCompleted: false,
      },
    });

    sendTeamMemberInviteEmail(newUser.email, newUser.name, generatedPassword).catch((err) =>
      console.error('[userController] inviteTeamMember sendTeamMemberInviteEmail:', err)
    );

    return res.status(201).json({
      success: true,
      message: 'Team member invited successfully',
      data: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        locationAccess: newUser.locationAccess || [],
        password: generatedPassword,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error inviting team member:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'User with this email already exists' });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateTeamMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userEmail = req.user?.email;
    if (!userId && !userEmail) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const currentUser = await findUserByIdOrEmail(userId, userEmail);
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admins can update team members' });
    }

    const { memberId, name, email, role, locationIds, password } = req.body;
    if (!memberId) {
      return res.status(400).json({ success: false, message: 'Member ID is required' });
    }

    const teamMember = await prisma.user.findUnique({ where: { id: memberId } });
    if (!teamMember) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }

    const currentRestaurantId = currentUser.restaurantId;
    const memberRestaurantId = teamMember.restaurantId;
    if (currentRestaurantId && memberRestaurantId && currentRestaurantId !== memberRestaurantId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update team members from your own restaurant',
      });
    }

    if (email && email !== teamMember.email) {
      const existing = await prisma.user.findFirst({
        where: { email: email.toLowerCase().trim(), id: { not: memberId } },
      });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Email already in use' });
      }
    }

    const dbRole = role === 'operator' ? 'user' : role;
    if (dbRole === 'user') {
      if (!locationIds || !Array.isArray(locationIds) || locationIds.length !== 1) {
        return res.status(400).json({
          success: false,
          message: 'Operators must have exactly one location assigned',
        });
      }
    } else if (dbRole === 'admin' && locationIds !== undefined && !Array.isArray(locationIds)) {
      return res.status(400).json({ success: false, message: 'Location IDs must be an array' });
    }

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.toLowerCase().trim();
    if (role) updateData.role = dbRole;
    if (locationIds !== undefined) updateData.locationAccess = locationIds;
    if (password) updateData.password = await hashPassword(password);

    const updatedMember = await prisma.user.update({
      where: { id: memberId },
      data: updateData as any,
    });

    return res.json({
      success: true,
      message: 'Team member updated successfully',
      data: {
        id: updatedMember.id,
        name: updatedMember.name,
        email: updatedMember.email,
        role: updatedMember.role,
        locationAccess: updatedMember.locationAccess || [],
        createdAt: updatedMember.createdAt,
        updatedAt: updatedMember.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Error updating team member:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
