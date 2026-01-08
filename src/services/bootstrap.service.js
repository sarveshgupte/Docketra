/**
 * Bootstrap Service for Docketra
 * 
 * Automatically ensures required system entities exist on startup:
 * 1. System Admin (X000001) - for first-run usability
 * 2. Default Client (C000001) - for case creation
 * 
 * Features:
 * - Runs automatically on server startup (after MongoDB connection)
 * - Idempotent - safe to run multiple times
 * - Does NOT overwrite existing entities
 * - Preserves audit trail
 * - No manual MongoDB setup required
 */

const User = require('../models/User.model');
const Client = require('../models/Client.model');

/**
 * Seed System Admin (X000001)
 * 
 * Creates the system admin user if none exists.
 * Checks for existing user with xID = "X000001" OR role = "Admin"
 * 
 * System Admin properties:
 * - xID: X000001
 * - name: System Admin
 * - email: admin@system.local
 * - role: Admin
 * - status: ACTIVE
 * - password: null (not set yet)
 * - passwordSet: false
 * - mustChangePassword: true
 * - passwordExpiresAt: far future (2099)
 * - isActive: true
 * - createdByXid: SYSTEM
 */
const seedSystemAdmin = async () => {
  try {
    // Check if admin already exists (by xID or by role)
    const existingAdmin = await User.findOne({
      $or: [
        { xID: 'X000001' },
        { role: 'Admin' }
      ]
    });

    if (existingAdmin) {
      console.log('✓ System Admin already exists (xID: ' + existingAdmin.xID + ')');
      return;
    }

    // Create System Admin
    const systemAdmin = new User({
      xID: 'X000001',
      name: 'System Admin',
      email: 'admin@system.local',
      role: 'Admin',
      status: 'ACTIVE',
      passwordHash: null,
      passwordSet: false,
      mustChangePassword: true,
      passwordExpiresAt: new Date('2099-12-31T23:59:59.999Z'), // Far future date
      isActive: true,
      allowedCategories: [],
      passwordHistory: [],
    });

    await systemAdmin.save();
    console.log('✓ System Admin created successfully (xID: X000001)');
  } catch (error) {
    console.error('✗ Error seeding System Admin:', error.message);
    throw error;
  }
};

/**
 * Seed Default Client (C000001)
 * 
 * Creates the default client if it doesn't exist.
 * Validates that default organization exists first.
 * 
 * Default Client properties:
 * - clientId: C000001
 * - businessName: Default Client
 * - isActive: true
 * - isSystemClient: true
 * - createdBy: SYSTEM
 */
const seedDefaultClient = async () => {
  try {
    // Check if default client already exists
    const existingClient = await Client.findOne({ clientId: 'C000001' });

    if (existingClient) {
      console.log('✓ Default Client already exists (clientId: C000001)');
      return;
    }

    // Create Default Client
    const defaultClient = new Client({
      clientId: 'C000001',
      businessName: 'Default Client',
      businessAddress: 'System Default Address',
      businessPhone: '0000000000',
      businessEmail: 'default@system.local',
      isSystemClient: true,
      isActive: true,
      createdBy: 'system@system.local',
    });

    await defaultClient.save();
    console.log('✓ Default Client created successfully (clientId: C000001)');
  } catch (error) {
    console.error('✗ Error seeding Default Client:', error.message);
    throw error;
  }
};

/**
 * Run all bootstrap operations
 * 
 * This function is called on server startup after MongoDB connection.
 * It ensures all required system entities exist.
 * 
 * Order matters:
 * 1. System Admin first (for administrative access)
 * 2. Default Client second (for case creation)
 */
const runBootstrap = async () => {
  try {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  Running Bootstrap Checks...               ║');
    console.log('╚════════════════════════════════════════════╝\n');

    // Seed System Admin
    await seedSystemAdmin();

    // Seed Default Client
    await seedDefaultClient();

    console.log('\n✓ Bootstrap completed successfully\n');
  } catch (error) {
    console.error('\n✗ Bootstrap failed:', error.message);
    // Don't exit process - let server continue but log the error
    // This allows investigation without blocking startup
    console.error('⚠️  Warning: System may not be fully functional without bootstrap data');
  }
};

module.exports = {
  runBootstrap,
  seedSystemAdmin,
  seedDefaultClient,
};
