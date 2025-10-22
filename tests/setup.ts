/**
 * Global test setup and configuration
 * Runs before all tests
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.test' });

// Set test timeout
jest.setTimeout(30000);

// Global test utilities
global.testConfig = {
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  testTimeout: 30000,
  retryAttempts: 3
};

// Mock console methods in tests to reduce noise
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn()
};

// Setup global test data
global.testData = {
  validUser: {
    email: 'test.user@clorizon.com',
    password: 'SecurePass123!',
    role: 'standard_user'
  },
  adminUser: {
    email: 'admin@clorizon.com',
    password: 'AdminPass123!',
    role: 'admin'
  }
};

console.log('✓ Test environment initialized');
