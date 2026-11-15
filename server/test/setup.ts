// Imported first by every test file, before anything reads the environment:
// an in-memory database, quick password hashing and a platform owner to sign in as.
process.env.NODE_ENV = 'test';
process.env.BCRYPT_ROUNDS = '4';
process.env.DATABASE_URL = '';
process.env.PLATFORM_ADMIN_EMAIL = 'owner@platform.test';
process.env.PLATFORM_ADMIN_PASSWORD = 'Owner-test-1';
process.env.REGISTER_RATE_LIMIT_MAX = '1000';
process.env.LOGIN_RATE_LIMIT_MAX = '1000';
