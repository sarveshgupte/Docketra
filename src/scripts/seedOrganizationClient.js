const log = require('../utils/log');
/**
 * Seed Organization Client Script
 * 
 * Purpose: Creates the default system organization client (C000001)
 * This is a MANDATORY client that must always exist in the system.
 * 
 * Usage:
 *   1. Ensure MongoDB is running and MONGODB_URI is set in .env file
 *   2. Run: node src/scripts/seedOrganizationClient.js
 *   3. The script will check if organization client exists before creating
 * 
 * Organization Client Details:
 *   - clientId: C000001 (immutable, reserved)
 *   - businessName: Organization
 *   - isSystemClient: true (cannot be deleted or edited directly)
 *   - Used for internal/organization work
 * 
 * This client is created with system flag and cannot be tampered with.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Client = require('../models/Client.model');

const seedOrganizationClient = async () => {
  try {
    // Connect to MongoDB
    log.info('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    log.info('✓ MongoDB Connected');

    // Check if organization client already exists
    const existingOrgClient = await Client.findOne({ clientId: 'C000001' });
    
    if (existingOrgClient) {
      log.info('ℹ Organization client (C000001) already exists.');
      log.info('  Business Name:', existingOrgClient.businessName);
      log.info('  System Client:', existingOrgClient.isSystemClient);
      log.info('  Created:', existingOrgClient.createdAt);
    } else {
      // Create the organization client
      const organizationClient = new Client({
        clientId: 'C000001',
        businessName: 'Organization',
        businessAddress: null,
        primaryContactNumber: '0000000000',
        businessEmail: 'organization@system.local',
        isSystemClient: true,
        isActive: true,
        status: 'ACTIVE',
        createdByXid: 'SYSTEM', // CANONICAL - system-generated identifier
        createdBy: 'system@system.local', // DEPRECATED - backward compatibility only
      });

      await organizationClient.save();
      log.info('✓ Organization client created successfully!');
      log.info('  Client ID:', organizationClient.clientId);
      log.info('  Business Name:', organizationClient.businessName);
      log.info('  System Client:', organizationClient.isSystemClient);
      log.info('  Created By:', organizationClient.createdBy);
    }

    log.info('\n✓ Seed completed successfully');

  } catch (error) {
    log.error('✗ Error seeding organization client:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    log.info('✓ Database connection closed');
    process.exit(0);
  }
};

// Run the seed script
seedOrganizationClient();
