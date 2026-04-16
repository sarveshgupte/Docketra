const log = require('../utils/log');
/**
 * Seed Admin Script for Docketra
 * 
 * Purpose: Creates the first Admin user for the Docketra case management system
 * 
 * Usage:
 *   1. Ensure MongoDB is running and MONGODB_URI is set in .env file
 *   2. Run: node src/scripts/seedAdmin.js
 *   3. The script will check if admin exists before creating to prevent duplicates
 * 
 * Default Admin Credentials:
 *   xID: X000001
 *   Password: ChangeMe@123
 * 
 * ⚠️ WARNING: The default admin password is for first login only and must be 
 *             changed immediately after successful login.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User.model');

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'ChangeMe@123';
const PASSWORD_EXPIRY_DAYS = 60;
const ADMIN_XID = 'X000001';

const seedAdmin = async () => {
  try {
    // Check if seeding is enabled
    if (process.env.SEED_ADMIN !== 'true') {
      log.info('ℹ Admin seeding is disabled.');
      log.info('  To enable admin seeding, set SEED_ADMIN=true in your environment.');
      log.info('  This prevents accidental password resets on deploy.');
      return;
    }

    // Connect to MongoDB
    log.info('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    log.info('✓ MongoDB Connected');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ xID: ADMIN_XID });
    
    if (existingAdmin) {
      log.info('ℹ Admin user already exists. Updating password hash if needed...');
      log.info(`  xID: ${existingAdmin.xID}`);
      log.info(`  Name: ${existingAdmin.name}`);
      log.info(`  Role: ${existingAdmin.role}`);
      log.info(`  Active: ${existingAdmin.isActive}`);
      
      // Update password hash to ensure it's valid
      const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
      existingAdmin.passwordHash = passwordHash;
      existingAdmin.passwordSet = true;  // Allow login with default password
      existingAdmin.forcePasswordReset = true;  // Trigger reset flow on first login
      existingAdmin.mustChangePassword = true;
      existingAdmin.passwordLastChangedAt = new Date();
      existingAdmin.passwordExpiresAt = new Date(Date.now() + PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      existingAdmin.status = 'active'; // Admin is immediately active with default password
      
      await existingAdmin.save();
      log.info('✓ Admin password hash updated successfully!');
    } else {
      // Hash the default password
      const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
      
      // Create the first Admin user with xID-based authentication
      const adminUser = new User({
        xID: ADMIN_XID,
        name: 'System Administrator',
        email: 'admin@docketra.local',
        role: 'Admin',
        allowedCategories: [],
        isActive: true,
        passwordHash,
        passwordSet: true,  // Allow login with default password
        forcePasswordReset: true,  // Trigger reset flow on first login
        mustChangePassword: true,
        passwordLastChangedAt: new Date(),
        passwordExpiresAt: new Date(Date.now() + PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        status: 'active', // Admin is immediately active with default password
        passwordHistory: [],
      });

      await adminUser.save();
      log.info('✓ Admin user created successfully!');
      log.info(`  xID: ${adminUser.xID}`);
      log.info(`  Name: ${adminUser.name}`);
      log.info(`  Role: ${adminUser.role}`);
      log.info(`  Active: ${adminUser.isActive}`);
    }
    
    log.info('\n📋 Default Admin Credentials:');
    log.info(`   xID: ${ADMIN_XID}`);
    log.info(`   Password: ${DEFAULT_PASSWORD}`);
    log.info('\n⚠️  WARNING: Change the default password immediately after first login!');

  } catch (error) {
    log.error('✗ Error seeding admin user:', error.message);
    log.error(error);
    process.exit(1);
  } finally {
    // Close the database connection if connected
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      log.info('\n✓ Database connection closed');
    }
    process.exit(0);
  }
};

// Run the seed script
seedAdmin();
