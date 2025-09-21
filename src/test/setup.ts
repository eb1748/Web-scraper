// Test setup file for Jest
// Global test configuration and mocks

// Set test timeout
jest.setTimeout(10000);

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.OPENWEATHER_API_KEY = 'test-key';
process.env.PORT = '3000';