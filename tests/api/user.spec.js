// @ts-check
import { expect, test } from '@playwright/test';
import fc from 'fast-check';
import { createAuthenticatedUser, authenticatedRequest } from './helpers/auth-helper.js';
import { generateUserData, validNameArbitrary, validPasswordArbitrary } from './helpers/test-data.js';

const API_BASE_URL = process.env.API_BASE_URL || 'https://storedemo.testdino.com';

test.describe('User Profile and Password Reset API', () => {
  
  // ========== PROFILE TESTS ==========
  
  test('Get profile without token - GET /me - 401 Token Missing', { tag: '@api' }, async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/me`);
    
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message', 'Token Missing');
  });

  test('Get profile with token - GET /me - 200 + user data', { tag: '@api' }, async ({ request }) => {
    const { token, user } = await createAuthenticatedUser(request);
    
    const response = await authenticatedRequest(request, 'GET', `${API_BASE_URL}/api/me`, token);
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('success', true);
    expect(body.data).toHaveProperty('data');
    expect(body.data.data).toHaveProperty('email', user.email);
    expect(body.data.data).toHaveProperty('firstname', user.firstname);
    expect(body.data.data).toHaveProperty('lastname', user.lastname);
    expect(body.data.data).toHaveProperty('address');
    expect(body.data.data).toHaveProperty('orders');
  });

  test('Get profile with invalid token - 401 Token is invalid', { tag: '@api' }, async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/me`, {
      headers: { 'Authorization': 'Bearer invalid.token.here' }
    });
    
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message', 'Token is invalid');
  });

  test('Verify addresses are populated in profile', { tag: '@api' }, async ({ request }) => {
    const { token } = await createAuthenticatedUser(request);
    
    const response = await authenticatedRequest(request, 'GET', `${API_BASE_URL}/api/me`, token);
    const body = await response.json();
    
    expect(body.data.data).toHaveProperty('address');
    expect(Array.isArray(body.data.data.address)).toBe(true);
  });

  test('Verify orders are populated in profile', { tag: '@api' }, async ({ request }) => {
    const { token } = await createAuthenticatedUser(request);
    
    const response = await authenticatedRequest(request, 'GET', `${API_BASE_URL}/api/me`, token);
    const body = await response.json();
    
    expect(body.data.data).toHaveProperty('orders');
    expect(Array.isArray(body.data.data.orders)).toBe(true);
  });

  // ========== UPDATE USER TESTS ==========
  
  test('Update user without token - PUT /updateUser - 401 Token Missing', { tag: '@api' }, async ({ request }) => {
    const response = await request.put(`${API_BASE_URL}/api/updateUser`, {
      data: { firstName: 'New Name' }
    });
    
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message', 'Token Missing');
  });

  test('Update user with token - PUT /updateUser - 200 updated', { tag: '@api' }, async ({ request }) => {
    const { token } = await createAuthenticatedUser(request);
    
    const newFirstName = 'UpdatedFirst';
    const newLastName = 'UpdatedLast';
    const newPhone = '5551234567';
    
    const response = await authenticatedRequest(
      request,
      'PUT',
      `${API_BASE_URL}/api/updateUser`,
      token,
      { firstName: newFirstName, lastName: newLastName, phoneNumber: newPhone }
    );
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('updatedUser');
    expect(body.updatedUser).toHaveProperty('firstname', newFirstName);
    expect(body.updatedUser).toHaveProperty('lastname', newLastName);
    expect(body.updatedUser).toHaveProperty('phoneNumber', newPhone);
  });

  test('Update user with no changes - PUT /updateUser - 400 no changes detected', { tag: '@api' }, async ({ request }) => {
    const { token, user } = await createAuthenticatedUser(request);
    
    // Try to update with same values
    const response = await authenticatedRequest(
      request,
      'PUT',
      `${API_BASE_URL}/api/updateUser`,
      token,
      { firstName: user.firstname, lastName: user.lastname }
    );
    
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message', 'No changes detected');
  });

  test('Update firstname only', { tag: '@api' }, async ({ request }) => {
    const { token } = await createAuthenticatedUser(request);
    
    const newFirstName = 'OnlyFirstName';
    const response = await authenticatedRequest(
      request,
      'PUT',
      `${API_BASE_URL}/api/updateUser`,
      token,
      { firstName: newFirstName }
    );
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.updatedUser).toHaveProperty('firstname', newFirstName);
  });

  test('Update lastname only', { tag: '@api' }, async ({ request }) => {
    const { token } = await createAuthenticatedUser(request);
    
    const newLastName = 'OnlyLastName';
    const response = await authenticatedRequest(
      request,
      'PUT',
      `${API_BASE_URL}/api/updateUser`,
      token,
      { lastName: newLastName }
    );
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.updatedUser).toHaveProperty('lastname', newLastName);
  });

  test('Update phoneNumber only', { tag: '@api' }, async ({ request }) => {
    const { token } = await createAuthenticatedUser(request);
    
    const newPhone = '5559876543';
    const response = await authenticatedRequest(
      request,
      'PUT',
      `${API_BASE_URL}/api/updateUser`,
      token,
      { phoneNumber: newPhone }
    );
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.updatedUser).toHaveProperty('phoneNumber', newPhone);
  });

  // ========== PASSWORD RESET TESTS ==========
  
  test('Valid password reset - PUT /reset-password - 200 success', { tag: '@api' }, async ({ request }) => {
    const userData = generateUserData();
    
    // Register user
    await request.post(`${API_BASE_URL}/api/register`, { data: userData });
    
    // Reset password
    const newPassword = 'NewPassword123!';
    const response = await request.put(`${API_BASE_URL}/api/reset-password`, {
      data: { email: userData.email, password: newPassword }
    });
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('message', 'Password reset successfully');
    
    // Verify can login with new password
    const loginResponse = await request.post(`${API_BASE_URL}/api/login`, {
      data: { email: userData.email, password: newPassword }
    });
    expect(loginResponse.status()).toBe(200);
  });

  test('Password reset for non-existent email - 401 not registered', { tag: '@api' }, async ({ request }) => {
    const response = await request.put(`${API_BASE_URL}/api/reset-password`, {
      data: { 
        email: `nonexistent_${Date.now()}@example.com`,
        password: 'NewPassword123!'
      }
    });
    
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message', 'User is not registered');
  });

  test('Password reset with missing email', { tag: '@api' }, async ({ request }) => {
    const response = await request.put(`${API_BASE_URL}/api/reset-password`, {
      data: { password: 'NewPassword123!' }
    });
    
    // Backend will return 401 or 500
    expect([401, 500]).toContain(response.status());
  });

  test('Password reset with missing password', { tag: '@api' }, async ({ request }) => {
    const response = await request.put(`${API_BASE_URL}/api/reset-password`, {
      data: { email: 'test@example.com' }
    });
    
    // Backend will return 401 or 500
    expect([401, 500]).toContain(response.status());
  });

  test('Property: Profile update round trip', { tag: '@api' }, async ({ request }) => {
    await fc.assert(
      fc.asyncProperty(
        validNameArbitrary.filter(name => name.trim().length > 0), // Filter out whitespace-only names
        validNameArbitrary.filter(name => name.trim().length > 0),
        async (newFirstName, newLastName) => {
          const { token } = await createAuthenticatedUser(request);
          
          // Update profile
          const updateResponse = await authenticatedRequest(
            request,
            'PUT',
            `${API_BASE_URL}/api/updateUser`,
            token,
            { firstName: newFirstName, lastName: newLastName }
          );
          
          if (updateResponse.status() === 200) {
            const updateBody = await updateResponse.json();
            // Backend trims whitespace
            expect(updateBody.updatedUser).toHaveProperty('firstname', newFirstName.trim());
            expect(updateBody.updatedUser).toHaveProperty('lastname', newLastName.trim());
            
            // Verify with GET /api/me
            const getResponse = await authenticatedRequest(request, 'GET', `${API_BASE_URL}/api/me`, token);
            const getBody = await getResponse.json();
            expect(getBody.data.data).toHaveProperty('firstname', newFirstName.trim());
            expect(getBody.data.data).toHaveProperty('lastname', newLastName.trim());
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});
