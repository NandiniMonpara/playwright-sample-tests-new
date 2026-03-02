// @ts-check
import { expect, test } from '@playwright/test';
import fc from 'fast-check';
import { createAuthenticatedUser, authenticatedRequest } from './helpers/auth-helper.js';
import { generateUserData, validNameArbitrary, validPhoneArbitrary, weakPasswordArbitrary, validPasswordArbitrary } from './helpers/test-data.js';

const API_BASE_URL = process.env.API_BASE_URL || 'https://storedemo.testdino.com';

test.describe('User Profile and Password Reset API', () => {
  
  // ========== PROFILE TESTS ==========
  
  test('Property: Protected endpoints require authentication', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 9: For any protected endpoint, when called without a JWT token, the response should return status 401.
    
    const protectedEndpoints = [
      { method: 'GET', url: `${API_BASE_URL}/api/me` },
      { method: 'PUT', url: `${API_BASE_URL}/api/updateUser` }
    ];
    
    for (const endpoint of protectedEndpoints) {
      const response = await request[endpoint.method.toLowerCase()](endpoint.url);
      expect(response.status()).toBe(401);
    }
  });

  test('Property: Invalid JWT tokens are rejected', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 10: For any protected endpoint and any invalid or malformed JWT token, the response should return status 401.
    
    const invalidTokens = [
      'invalid.token.here',
      'Bearer invalid',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
      '',
      'malformed'
    ];
    
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...invalidTokens), async (token) => {
        const response = await request.get(`${API_BASE_URL}/api/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        expect(response.status()).toBe(401);
      }),
      { numRuns: invalidTokens.length }
    );
  });

  test('Property: Profile retrieval returns complete user data', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 11: For any authenticated user with valid JWT token, when GET /api/me is called, the response should return status 200 and contain complete user profile data.
    
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const { token, user } = await createAuthenticatedUser(request);
        
        const response = await authenticatedRequest(request, 'GET', `${API_BASE_URL}/api/me`, token);
        
        expect(response.status()).toBe(200);
        const body = await response.json();
        
        expect(body).toHaveProperty('id');
        expect(body).toHaveProperty('email', user.email);
        expect(body).toHaveProperty('name', user.name);
        expect(body).toHaveProperty('createdAt');
      }),
      { numRuns: 100 }
    );
  });

  test('GET /api/me returns user profile', { tag: '@api' }, async ({ request }) => {
    const { token, user } = await createAuthenticatedUser(request);
    
    const response = await authenticatedRequest(request, 'GET', `${API_BASE_URL}/api/me`, token);
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    
    expect(body).toHaveProperty('email', user.email);
    expect(body).toHaveProperty('name', user.name);
    expect(body).not.toHaveProperty('password');
  });

  test('GET /api/me without token returns 401', { tag: '@api' }, async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/me`);
    expect(response.status()).toBe(401);
  });

  test('Property: Profile update round trip', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 12: For any authenticated user and any valid profile update data (name, phone), when PUT /api/updateUser is called, the response should return status 200 and contain the updated values, and subsequent GET /api/me should reflect those changes.
    
    await fc.assert(
      fc.asyncProperty(
        validNameArbitrary,
        validPhoneArbitrary,
        async (newName, newPhone) => {
          const { token } = await createAuthenticatedUser(request);
          
          // Update profile
          const updateResponse = await authenticatedRequest(
            request,
            'PUT',
            `${API_BASE_URL}/api/updateUser`,
            token,
            { name: newName, phone: newPhone }
          );
          
          expect(updateResponse.status()).toBe(200);
          const updateBody = await updateResponse.json();
          expect(updateBody).toHaveProperty('name', newName);
          expect(updateBody).toHaveProperty('phone', newPhone);
          
          // Verify with GET /api/me
          const getResponse = await authenticatedRequest(request, 'GET', `${API_BASE_URL}/api/me`, token);
          const getBody = await getResponse.json();
          expect(getBody).toHaveProperty('name', newName);
          expect(getBody).toHaveProperty('phone', newPhone);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('PUT /api/updateUser updates name', { tag: '@api' }, async ({ request }) => {
    const { token } = await createAuthenticatedUser(request);
    
    const newName = 'Updated Name';
    const response = await authenticatedRequest(
      request,
      'PUT',
      `${API_BASE_URL}/api/updateUser`,
      token,
      { name: newName }
    );
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('name', newName);
  });

  test('PUT /api/updateUser updates phone', { tag: '@api' }, async ({ request }) => {
    const { token } = await createAuthenticatedUser(request);
    
    const newPhone = '5551234567';
    const response = await authenticatedRequest(
      request,
      'PUT',
      `${API_BASE_URL}/api/updateUser`,
      token,
      { phone: newPhone }
    );
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('phone', newPhone);
  });

  test('PUT /api/updateUser without token returns 401', { tag: '@api' }, async ({ request }) => {
    const response = await request.put(`${API_BASE_URL}/api/updateUser`, {
      data: { name: 'New Name' }
    });
    
    expect(response.status()).toBe(401);
  });

  // ========== PASSWORD RESET TESTS ==========
  
  test('Property: Password reset round trip', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 14: For any registered user, when password is reset via /api/reset-password with valid email and new password, the response should return status 200, and subsequent login with the new password should succeed.
    
    await fc.assert(
      fc.asyncProperty(validPasswordArbitrary, async (newPassword) => {
        // Ensure password meets minimum requirements
        if (newPassword.length < 6) {
          newPassword = newPassword + 'Extra123';
        }
        
        const userData = generateUserData();
        
        // Register user
        await request.post(`${API_BASE_URL}/api/register`, { data: userData });
        
        // Reset password
        const resetResponse = await request.post(`${API_BASE_URL}/api/reset-password`, {
          data: { email: userData.email, newPassword }
        });
        
        expect(resetResponse.status()).toBe(200);
        
        // Try to login with new password
        const loginResponse = await request.post(`${API_BASE_URL}/api/login`, {
          data: { email: userData.email, password: newPassword }
        });
        
        expect(loginResponse.status()).toBe(200);
        const loginBody = await loginResponse.json();
        expect(loginBody).toHaveProperty('token');
      }),
      { numRuns: 100 }
    );
  });

  test('POST /api/reset-password resets password', { tag: '@api' }, async ({ request }) => {
    const userData = generateUserData();
    
    // Register user
    await request.post(`${API_BASE_URL}/api/register`, { data: userData });
    
    // Reset password
    const newPassword = 'NewPassword123!';
    const response = await request.post(`${API_BASE_URL}/api/reset-password`, {
      data: { email: userData.email, newPassword }
    });
    
    expect(response.status()).toBe(200);
    
    // Verify can login with new password
    const loginResponse = await request.post(`${API_BASE_URL}/api/login`, {
      data: { email: userData.email, password: newPassword }
    });
    
    expect(loginResponse.status()).toBe(200);
  });

  test('Property: Password reset for non-existent user returns 404', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 15: For any non-existent email, when sent to /api/reset-password, the response should return status 404.
    
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        validPasswordArbitrary,
        async (email, password) => {
          email = `nonexistent_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
          
          const response = await request.post(`${API_BASE_URL}/api/reset-password`, {
            data: { email, newPassword: password }
          });
          
          expect(response.status()).toBe(404);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('POST /api/reset-password with weak password returns 400', { tag: '@api' }, async ({ request }) => {
    const userData = generateUserData();
    
    // Register user
    await request.post(`${API_BASE_URL}/api/register`, { data: userData });
    
    // Try to reset with weak password
    const response = await request.post(`${API_BASE_URL}/api/reset-password`, {
      data: { email: userData.email, newPassword: '123' }
    });
    
    expect(response.status()).toBe(400);
  });

  test('POST /api/reset-password missing email returns 400', { tag: '@api' }, async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/reset-password`, {
      data: { newPassword: 'NewPassword123!' }
    });
    
    expect(response.status()).toBe(400);
  });

  test('POST /api/reset-password missing newPassword returns 400', { tag: '@api' }, async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/reset-password`, {
      data: { email: 'test@example.com' }
    });
    
    expect(response.status()).toBe(400);
  });
});
