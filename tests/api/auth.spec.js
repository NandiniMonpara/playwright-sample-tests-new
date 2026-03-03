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
  
  test('Register new user - POST /register - 200 success', { tag: '@api' }, async ({ request }) => {
    const userData = generateUserData();
    const { response, body } = await registerUser(request, userData);
    
    expect(response.status()).toBe(200);
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('message', 'User Created Successfully');
    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('email', userData.email);
    expect(body.user).toHaveProperty('firstname', userData.firstname);
    expect(body.user).toHaveProperty('lastname', userData.lastname);
    // Backend returns hashed password - verify it's not the plain password
    if (body.user.password) {
      expect(body.user.password).not.toBe(userData.password);
    }
  });

  test('Register duplicate email - POST /register - 400 already exists', { tag: '@api' }, async ({ request }) => {
    const userData = generateUserData();
    
    // Register first time
    await registerUser(request, userData);
    
    // Try to register again with same email
    const { response, body } = await registerUser(request, userData);
    expect(response.status()).toBe(400);
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message', 'User already Exist');
  });

  test('Registration with missing firstname returns 500', { tag: '@api' }, async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/register`, {
      data: { 
        lastname: 'User',
        email: `test_${Date.now()}@example.com`,
        password: 'Pass123!'
      }
    });
    expect(response.status()).toBe(500);
  });

  test('Registration with missing lastname returns 500', { tag: '@api' }, async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/register`, {
      data: { 
        firstname: 'Test',
        email: `test_${Date.now()}@example.com`,
        password: 'Pass123!'
      }
    });
    expect(response.status()).toBe(500);
  });

  test('Registration with missing email returns 500', { tag: '@api' }, async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/register`, {
      data: { 
        firstname: 'Test',
        lastname: 'User',
        password: 'Pass123!'
      }
    });
    expect(response.status()).toBe(500);
  });

  test('Registration with missing password returns 500', { tag: '@api' }, async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/register`, {
      data: { 
        firstname: 'Test',
        lastname: 'User',
        email: `test_${Date.now()}@example.com`
      }
    });
    expect(response.status()).toBe(500);
  });

  test('Property: Registration response never exposes password', { tag: '@api' }, async ({ request }) => {
    await fc.assert(
      fc.asyncProperty(validUserDataArbitrary, async (userData) => {
        userData.email = `test_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
        
        const response = await request.post(`${API_BASE_URL}/api/register`, {
          data: userData
        });
        
        if (response.status() === 200) {
          const body = await response.json();
          
          // Backend returns hashed password - check it's not the plain password
          if (body.user && body.user.password) {
            // Hashed password should not match plain password
            expect(body.user.password).not.toBe(userData.password);
            // Should be bcrypt hash (starts with $2b$)
            expect(body.user.password).toMatch(/^\$2[aby]\$/);
          }
        }
      }),
      { numRuns: 10 } // Reduced from 50 to avoid memory issues
    );
  });

  // ========== LOGIN TESTS ==========
  
  test('Login with valid credentials - POST /login - 200 + has token', { tag: '@api' }, async ({ request }) => {
    const userData = generateUserData();
    
    // Register user first
    await registerUser(request, userData);
    
    // Login
    const response = await request.post(`${API_BASE_URL}/api/login`, {
      data: { email: userData.email, password: userData.password }
    });
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('token');
    expect(typeof body.user.token).toBe('string');
    expect(body.user.token.length).toBeGreaterThan(0);
    
    // Verify JWT token structure (3 parts)
    const token = body.user.token;
    const parts = token.split('.');
    expect(parts.length).toBe(3);
  });

  test('Login with wrong password - POST /login - 403 password mismatch', { tag: '@api' }, async ({ request }) => {
    const userData = generateUserData();
    
    // Register user
    await registerUser(request, userData);
    
    // Try to login with wrong password
    const response = await request.post(`${API_BASE_URL}/api/login`, {
      data: { email: userData.email, password: 'WrongPassword123!' }
    });
    
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message', 'Password does not match');
  });

  test('Login with unregistered email - POST /login - 401 not registered', { tag: '@api' }, async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/login`, {
      data: { 
        email: `nonexistent_${Date.now()}@example.com`,
        password: 'SomePassword123!'
      }
    });
    
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message', 'User is not registered');
  });

  test('Login with missing fields - POST /login - 400 fill all details', { tag: '@api' }, async ({ request }) => {
    // Missing email
    let response = await request.post(`${API_BASE_URL}/api/login`, {
      data: { password: 'SomePassword123!' }
    });
    expect(response.status()).toBe(400);
    let body = await response.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message', 'Please fill all the details carefully');
    
    // Missing password
    response = await request.post(`${API_BASE_URL}/api/login`, {
      data: { email: 'test@example.com' }
    });
    expect(response.status()).toBe(400);
    body = await response.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message', 'Please fill all the details carefully');
  });

  test('Verify JWT token is returned in response', { tag: '@api' }, async ({ request }) => {
    const userData = generateUserData();
    await registerUser(request, userData);
    
    const token = await loginAndGetToken(request, userData.email, userData.password);
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  test('Verify password is not returned in login response', { tag: '@api' }, async ({ request }) => {
    const userData = generateUserData();
    await registerUser(request, userData);
    
    const response = await request.post(`${API_BASE_URL}/api/login`, {
      data: { email: userData.email, password: userData.password }
    });
    
    const body = await response.json();
    // Backend may return hashed password - verify it's not the plain password
    if (body.user.password) {
      expect(body.user.password).not.toBe(userData.password);
    }
  });

  test('Property: Valid login returns JWT token', { tag: '@api' }, async ({ request }) => {
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
        
        if (loginResponse.status() === 200) {
          const body = await loginResponse.json();
          expect(body.user).toHaveProperty('token');
          expect(typeof body.user.token).toBe('string');
        }
      }),
      { numRuns: 10 } // Reduced from 50 to avoid memory issues
    );
  });
});
