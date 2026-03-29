const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Firm = require('../models/Firm.model');
const userRepository = require('../repositories/user.repository');
const wrapWriteHandler = require('../middleware/wrapWriteHandler');
const { assertFirmPlanCapacity, PlanLimitExceededError, PlanAdminLimitExceededError, assertCanDeleteUser, PrimaryAdminActionError } = require('../services/user.service');
const { incrementTenantMetric } = require('../services/tenantMetrics.service');
const { logSecurityAuditEvent, SECURITY_AUDIT_ACTIONS } = require('../services/securityAudit.service');
const { noteAdminPrivilegeChange } = require('../services/securityTelemetry.service');
const jwtService = require('../services/jwt.service');
const { generateFirmSlug } = require('../utils/firmSlug');
const { sendWelcomeEmail } = require('../services/email/sendWelcomeEmail');

const resolveUserFirmScope = (req, res) => {
  if (req.user?.role === 'SUPER_ADMIN') return {};
  if (!req.user?.firmId) {
    res.status(403).json({
      success: false,
      message: 'Forbidden: firm context required',
    });
    return null;
  }
  return { firmId: req.user.firmId };
};

const buildUniqueFirmSlug = async (firmName, session) => {
  const baseSlug = generateFirmSlug(firmName) || `firm-${Date.now()}`;
  for (let index = 0; index < 20; index += 1) {
    const candidate = index === 0 ? baseSlug : `${baseSlug}-${index}`;
    // eslint-disable-next-line no-await-in-loop
    const existing = await Firm.findOne({ firmSlug: candidate }).session(session);
    if (!existing) return candidate;
  }
  throw new Error('FIRM_SLUG_GENERATION_FAILED');
};

const buildNextFirmIdentifier = async (session) => {
  const latestFirm = await Firm.findOne({ firmId: /^FIRM\d+$/ })
    .sort({ createdAt: -1 })
    .select('firmId')
    .session(session);
  const latestNumeric = Number(String(latestFirm?.firmId || '').replace('FIRM', '')) || 0;
  return `FIRM${String(latestNumeric + 1).padStart(3, '0')}`;
};

/**
 * User Controller
 * Handles all user-related business logic
 */

/**
 * Get all users
 */
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, isActive } = req.query;
    const firmScope = resolveUserFirmScope(req, res);
    if (!firmScope) return;
    const query = { ...firmScope };
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    const users = await User.find(query)
      .select('-passwordHash -passwordSetupTokenHash -passwordHistory')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await User.countDocuments(query);
    
    res.json({
      success: true,
      data: users,
      count: users.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error fetching users',
      message: error.message,
    });
  }
};

/**
 * Get single user by ID
 */
const getUserById = async (req, res) => {
  try {
    const firmScope = resolveUserFirmScope(req, res);
    if (!firmScope) return;
    const user = await userRepository.findUserById(req.params.id, firmScope.firmId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }
    
    res.json({
      success: true,
      data: user.toSafeObject(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error fetching user',
      message: error.message,
    });
  }
};

/**
 * Create new user
 */
const createUser = async (req, res) => {
  const requestId = req.requestId || randomUUID();
  req.requestId = requestId;
  const responseMeta = { requestId, firmId: req.user?.firmId || null };
  const safeUser = (userDoc) => {
    if (!userDoc) return null;
    if (typeof userDoc.toSafeObject === 'function') {
      return userDoc.toSafeObject();
    }
    return {
      _id: userDoc._id,
      name: userDoc.name,
      email: userDoc.email,
      role: userDoc.role,
      firmId: userDoc.firmId,
      defaultClientId: userDoc.defaultClientId,
    };
  };

  try {
    const { name, email, role } = req.body;

    // Check if user already exists
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({
      firmId: req.user?.firmId,
      email: normalizedEmail,
      status: { $ne: 'deleted' },
    });
    if (existingUser) {
      if (role && existingUser.role !== role) {
        return res.status(409).json({
          success: false,
          error: 'User with this email already exists with a different role',
          existingRole: existingUser.role,
          ...responseMeta,
        });
      }

      return res.status(200).json({
        success: true,
        data: safeUser(existingUser),
        message: 'User already exists',
        idempotent: true,
        ...responseMeta,
      });
    }

    await assertFirmPlanCapacity({ firmId: req.user?.firmId, role: role || 'Employee' });
    
    const user = new User({
      name,
      email: normalizedEmail,
      role,
      createdBy: req.body.createdBy, // In real app, this comes from auth
    });
    
    await user.save();
    await incrementTenantMetric(req.user?.firmId, 'users').catch(() => null);
    
    res.status(201).json({
      success: true,
      data: safeUser(user),
      message: 'User created successfully',
      ...responseMeta,
    });
  } catch (error) {
    if (error instanceof PlanLimitExceededError || error instanceof PlanAdminLimitExceededError) {
      return res.status(403).json({
        success: false,
        error: error.code,
        message: error.message,
        ...responseMeta,
      });
    }
    res.status(400).json({
      success: false,
      error: 'Error creating user',
      message: error.message,
      ...responseMeta,
    });
  }
};

/**
 * Update user
 */
const updateUser = async (req, res) => {
  try {
    const { name, role, isActive } = req.body;
    const firmScope = resolveUserFirmScope(req, res);
    if (!firmScope) return;
    const user = await userRepository.findUserById(req.params.id, firmScope.firmId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }
    
    const previousRole = user.role;
    if (name) user.name = name;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    user.updatedBy = req.body.updatedBy; // In real app, this comes from auth
    
    await user.save();
    if (role && role !== previousRole) {
      await logSecurityAuditEvent({
        req,
        action: SECURITY_AUDIT_ACTIONS.ROLE_CHANGED,
        resource: `users/${user._id.toString()}`,
        userId: req.user?._id || null,
        firmId: req.user?.firmId || null,
        xID: req.user?.xID || null,
        performedBy: req.user?.xID || req.user?._id?.toString?.() || 'SYSTEM',
        metadata: {
          targetUserId: user._id.toString(),
          oldRole: previousRole,
          newRole: role,
        },
        description: `User role changed from ${previousRole} to ${role}`,
      }).catch(() => null);
      await noteAdminPrivilegeChange({
        req,
        userId: req.user?._id?.toString?.() || null,
        firmId: req.user?.firmId || null,
        targetUserId: user._id.toString(),
        oldRole: previousRole,
        newRole: role,
      });
    }
    
    res.json({
      success: true,
      data: user.toSafeObject(),
      message: 'User updated successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Error updating user',
      message: error.message,
    });
  }
};

/**
 * Delete user (soft delete by setting isActive to false)
 */
const deleteUser = async (req, res) => {
  try {
    const firmScope = resolveUserFirmScope(req, res);
    if (!firmScope) return;
    const user = await userRepository.findUserById(req.params.id, firmScope.firmId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }
    
    // PROTECTION: Prevent deactivation of primary admin and system users
    try {
      assertCanDeleteUser(user);
    } catch (guardError) {
      if (guardError instanceof PrimaryAdminActionError) {
        return res.status(403).json({
          success: false,
          error: guardError.message,
        });
      }
      throw guardError;
    }
    
    user.isActive = false;
    user.updatedBy = req.body.updatedBy; // In real app, this comes from auth
    await user.save();
    await logSecurityAuditEvent({
      req,
      action: SECURITY_AUDIT_ACTIONS.ADMIN_ACTION,
      resource: `users/${user._id.toString()}`,
      userId: req.user?._id || null,
      firmId: req.user?.firmId || null,
      xID: req.user?.xID || null,
      performedBy: req.user?.xID || req.user?._id?.toString?.() || 'SYSTEM',
      metadata: {
        targetUserId: user._id.toString(),
        operation: 'deactivate_user',
      },
      description: 'Admin deactivated a user account',
    }).catch(() => null);
    
    res.json({
      success: true,
      message: 'User deactivated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error deactivating user',
      message: error.message,
    });
  }
};


const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const user = await User.findById(userId)
      .select('name email primary_email isOnboarded')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({
      success: true,
      data: {
        name: user.name || '',
        email: user.email || user.primary_email || '',
        isOnboarded: Boolean(user.isOnboarded),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Unable to load profile' });
  }
};

const completeProfile = async (req, res) => {
  const { name, firmName, phone } = req.body || {};
  const userId = req.user?._id;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (!firmName || !phone) {
    return res.status(400).json({ success: false, message: 'firmName and phone are required' });
  }
  const normalizedPhone = String(phone).replace(/\D/g, '');
  if (!/^\d{10}$/.test(normalizedPhone)) {
    return res.status(400).json({ success: false, message: 'phone must be exactly 10 digits' });
  }

  const session = await mongoose.startSession();
  let updatedUser = null;
  let createdFirm = null;
  let onboardingCompletedNow = false;

  try {
    await session.withTransaction(async () => {
      const user = await User.findById(userId).session(session);
      if (!user) throw new Error('USER_NOT_FOUND');

      if (user.isOnboarded === true) {
        throw new Error('USER_ALREADY_ONBOARDED');
      }

      const firmSlug = await buildUniqueFirmSlug(firmName, session);
      const firmId = await buildNextFirmIdentifier(session);

      [createdFirm] = await Firm.create([{
        firmId,
        name: String(firmName).trim(),
        firmSlug,
        createdBy: user._id,
        storageProvider: 'docketra',
        source: 'SELF_SERVE',
        status: 'active',
        storage: { mode: 'docketra_managed', provider: null },
        bootstrapStatus: 'PENDING',
      }], { session });

      if (name && String(name).trim()) {
        user.name = String(name).trim();
      }
      user.phoneNumber = normalizedPhone;
      user.firmId = createdFirm._id;
      user.isOnboarded = true;
      await user.save({ session });
      updatedUser = user;
      onboardingCompletedNow = true;
    });
  } catch (error) {
    const statusCode = error.message === 'USER_NOT_FOUND'
      ? 404
      : (error.message === 'USER_ALREADY_ONBOARDED' ? 409 : 400);
    return res.status(statusCode).json({ success: false, message: error.message });
  } finally {
    await session.endSession();
  }

  const accessToken = jwtService.generateAccessToken({
    userId: updatedUser._id.toString(),
    xid: updatedUser.xid,
    role: updatedUser.role || 'Employee',
    firmId: updatedUser.firmId ? updatedUser.firmId.toString() : null,
    defaultClientId: updatedUser.defaultClientId ? updatedUser.defaultClientId.toString() : null,
  });

  if (onboardingCompletedNow) {
    try {
      await sendWelcomeEmail({
        email: updatedUser.primary_email || updatedUser.email,
        name: updatedUser.name,
        xid: updatedUser.xid || updatedUser.xID,
        firmId: createdFirm?._id?.toString?.() || updatedUser.firmId?.toString?.(),
      });
    } catch (emailError) {
      console.error('[ONBOARDING] Failed to send welcome email', {
        userId: updatedUser._id?.toString?.(),
        firmId: createdFirm?._id?.toString?.() || updatedUser.firmId?.toString?.(),
        error: emailError.message,
      });
    }
  }

  return res.json({
    success: true,
    firmSlug: createdFirm?.firmSlug || null,
    isOnboarded: true,
    data: {
      accessToken,
      isOnboarded: true,
      firmId: updatedUser.firmId ? updatedUser.firmId.toString() : null,
      firmSlug: createdFirm?.firmSlug || null,
    },
  });
};

module.exports = {
  getCurrentUser,
  getUsers,
  getUserById,
  createUser: wrapWriteHandler(createUser),
  updateUser: wrapWriteHandler(updateUser),
  deleteUser: wrapWriteHandler(deleteUser),
  completeProfile: wrapWriteHandler(completeProfile),
};
