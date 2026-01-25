import express from 'express';
import { getUserProfile, updateUserProfile, getTeamMembers, updateOnboardingStatus, inviteTeamMember, updateTeamMember } from '../controllers/userController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Get current user profile
router.get('/profile', authenticate, getUserProfile);

// Update current user profile
router.put('/profile', authenticate, updateUserProfile);

// Update onboarding completion status
router.put('/onboarding', authenticate, updateOnboardingStatus);

// Get team members (for admin users)
router.get('/team', authenticate, getTeamMembers);

// Invite team member (for admin users)
router.post('/invite', authenticate, inviteTeamMember);

// Update team member (for admin users)
router.put('/team/update', authenticate, updateTeamMember);

export default router;

