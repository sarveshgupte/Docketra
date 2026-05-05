process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-placeholder-jwt-secret-test-placeholder-jwt-secret-aaaa';
process.env.JWT_PASSWORD_SETUP_SECRET = process.env.JWT_PASSWORD_SETUP_SECRET || 'test-placeholder-password-setup-secret-test-placeholder-setup';
process.env.SUPERADMIN_PASSWORD_HASH = process.env.SUPERADMIN_PASSWORD_HASH || '$2b$10$wioLOkqqceK.iu9MZavNOua7yV2AzOpqlR4fuMWHf2.YeYpV4mEFC';
process.env.SUPERADMIN_XID = process.env.SUPERADMIN_XID || 'X000001';
process.env.SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@example.com';
process.env.SUPERADMIN_OBJECT_ID = process.env.SUPERADMIN_OBJECT_ID || '000000000000000000000001';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/docketra';
process.env.ENCRYPTION_PROVIDER = process.env.ENCRYPTION_PROVIDER || 'disabled';

require('../src/config/validateEnv').validateEnv();
