// @ts-check
import { expect, test } from '@playwright/test';
import fc from 'fast-check';
import { registerUser, loginAndGetToken } from './helpers/auth-helper.js';
import {
  generateUserData,
  validUserDataArbitrary,
  invalidEmailArbitrary,
  weakPasswordArbitrary,
  validEmailArbitrary,
  validPasswordArbitrary
} from './helpers/test-data.js';

const API_BASE_URL = process.env.API_BASE_URL || 'https://storedemo.testdino.com';

test.describe('Registration and Login API', () => {
  
  // ========== REGISTRATION TESTS ==========
  
  test('Valid registration creates user', { tag: '@api' }, async ({ request }) => {
    const userData = generateUserData();
    const { response, body } = await registerUser(request, userData);
    
    expect([200, 201]).toContain(response.status());
    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('email', userData.email);
    expect(body.user).toHaveProperty('name', userData.name);
  });

  test('Property: Valid registration creates user', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 1: For any valid user registration data (email, password, name, phone), when sent to /api/register, the response should return status 200 or 201 and contain user data.
    
    await fc.assert(
      fc.asyncProperty(validUserDataArbitrary, async (userData) => {
        // Make email unique for each test
        userData.email = `test_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
        
        const response = await request.post(`${API_BASE_URL}/api/register`, {
          data: userData
        });
        
        const status = response.status();
        expect([200, 201]).toContain(status);
        
        if (status === 200 || status === 201) {
          const body = await response.json();
          expect(body).toBeDefined();
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Property: Registration response never exposes password', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 2: For any registration response, the response body should not contain a password field.
    
    await fc.assert(
      fc.asyncProperty(validUserDataArbitrary, async (userData) => {
        userData.email = `test_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
        
        const response = await request.post(`${API_BASE_URL}/api/register`, {
          data: userData
        });
        
        const body = await response.json();
        const bodyStr = JSON.stringify(body).toLowerCase();
        
        // Check that password is not exposed in any form
        expect(bodyStr).not.toContain(userData.password.toLowerCase());
        expect(body).not.toHaveProperty('password');
        if (body.user) {
          expect(body.user).not.toHaveProperty('password');
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Property: Invalid email format is rejected', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 3: For any registration request with invalid email format, the response should return status 400.
    
    await fc.assert(
      fc.asyncProperty(
        invalidEmailArbitrary,
        validPasswordArbitrary,
        fc.string({ minLength: 1, maxLength: 50 }),
        async (email, password, name) => {
          const response = await request.post(`${API_BASE_URL}/api/register`, {
            data: { email, password, name }
          });
          
          expect(response.status()).toBe(400);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property: Weak passwords are rejected', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 4: For any registration or password reset request with weak password (less than minimum requirements), the response should return status 400.
    
    await fc.assert(
      fc.asyncProperty(
        validEmailArbitrary,
        weakPasswordArbitrary,
        fc.string({ minLength: 1, maxLength: 50 }),
        async (email, password, name) => {
          email = `test_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
          
          const response = await request.post(`${API_BASE_URL}/api/register`, {
            data: { email, password, name }
          });
          
          expect(response.status()).toBe(400);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Missing required fields return 400', { tag: '@api' }, async ({ request }) => {
    // Test missing email
    let response = await request.post(`${API_BASE_URL}/api/register`, {
      data: { password: 'Pass123!', name: 'Test User' }
    });
    expect(response.status()).toBe(400);
    
    // Test missing password
    response = await request.post(`${API_BASE_URL}/api/register`, {
      data: { email: 'test@example.com', name: 'Test User' }
    });
    expect(response.status()).toBe(400);
    
    // Test missing name
    response = await request.post(`${API_BASE_URL}/api/register`, {
      data: { email: 'test@example.com', password: 'Pass123!' }
    });
    expect(response.status()).toBe(400);
  });

  test('Duplicate email returns 409', { tag: '@api' }, async ({ request }) => {
    const userData = generateUserData();
    
    // Register first time
    await registerUser(request, userData);
    
    // Try to register again with same email
    const { response } = await registerUser(request, userData);
    expect(response.status()).toBe(409);
  });

  // ========== LOGIN TESTS ==========
  
  test('Property: Valid login returns JWT token', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 6: For any registered user with valid credentials, when sent to /api/login, the response should return status 200 and contain a JWT token.
    
    await fc.assert(
      fc.asyncProperty(validUserDataArbitrary, async (userData) => {
        userData.email = `test_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
        
        // Register user first
        await request.post(`${API_BASE_URL}/api/register`, {
          data: userData
        });
        
        // Login
        const loginResponse = await request.post(`${API_BASE_URL}/api/login`, {
          data: { email: userData.email, password: userData.password }
        });
        
        expect(loginResponse.status()).toBe(200);
        const body = await loginResponse.json();
        expect(body).toHaveProperty('token');
        expect(typeof body.token).toBe('string');
        expect(body.token.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  test('Property: JWT token can be decoded and contains user info', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 7: For any successful login response, the JWT token should be decodable and contain user information.
    
    await fc.assert(
      fc.asyncProperty(validUserDataArbitrary, async (userData) => {
        userData.email = `test_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
        
        // Register and login
        await request.post(`${API_BASE_URL}/api/register`, { data: userData });
        const loginResponse = await request.post(`${API_BASE_URL}/api/login`, {
          data: { email: userData.email, password: userData.password }
        });
        
        const body = await loginResponse.json();
        const token = body.token;
        
        // JWT tokens have 3 parts separated by dots
        const parts = token.split('.');
        expect(parts.length).toBe(3);
        
        // Decode payload (second part)
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        expect(payload).toBeDefined();
        // Token should contain some user identifier
        expect(payload).toHaveProperty('userId');
      }),
      { numRuns: 100 }
    );
  });

  test('Property: Invalid credentials return 401', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 8: For any login request with incorrect password or non-existent email, the response should return status 401.
    
    await fc.assert(
      fc.asyncProperty(
        validEmailArbitrary,
        validPasswordArbitrary,
        async (email, password) => {
          email = `nonexistent_${Date.now()}@example.com`;
          
          const response = await request.post(`${API_BASE_URL}/api/login`, {
            data: { email, password }
          });
          
          expect(response.status()).toBe(401);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Wrong password returns 401', { tag: '@api' }, async ({ request }) => {
    const userData = generateUserData();
    
    // Register user
    await registerUser(request, userData);
    
    // Try to login with wrong password
    const response = await request.post(`${API_BASE_URL}/api/login`, {
      data: { email: userData.email, password: 'WrongPassword123!' }
    });
    
    expect(response.status()).toBe(401);
  });

  test('Non-existent email returns 401', { tag: '@api' }, async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/login`, {
      data: { email: 'nonexistent@example.com', password: 'SomePassword123!' }
    });
    
    expect(response.status()).toBe(401);
  });

  test('Login missing email returns 400', { tag: '@api' }, async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/login`, {
      data: { password: 'SomePassword123!' }
    });
    
    expect(response.status()).toBe(400);
  });

  test('Login missing password returns 400', { tag: '@api' }, async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/login`, {
      data: { email: 'test@example.com' }
    });
    
    expect(response.status()).toBe(400);
  });
});
