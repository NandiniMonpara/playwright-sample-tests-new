// @ts-check
import { expect, test } from '@playwright/test';
import fc from 'fast-check';
import { createAuthenticatedUser, authenticatedRequest } from './helpers/auth-helper.js';
import { generateUserData, validNameArbitrary } from './helpers/test-data.js';

test.describe('User Profile and Password Reset API', () => {
  /** @type {string[]} */
  const tokensToCleanup = [];

  /**
   * @param {import('@playwright/test').APIRequestContext} request
   * @returns {Promise<{token: string, user: {email: string, password: string, firstname: string, lastname: string}}>}
   */
  async function createUser(request) {
    /** @type {{token: string, user: {email: string, password: string, firstname: string, lastname: string}}} */
    const result = await createAuthenticatedUser(request);
    tokensToCleanup.push(result.token);
    return result;
  }

  test.afterEach(async ({ request }) => {
    for (const token of tokensToCleanup) {
      try {
        const meRes = await request.get('/api/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!meRes.ok()) continue;
        const userData = (await meRes.json())?.data?.data;
        if (!userData) continue;
        const userId = userData.id;
        // Cancel any orders using PUT /api/cancleOrder
        for (const order of userData.orders || []) {
          const orderId = typeof order === 'string' ? order : (order._id || order.id);
          if (!orderId) continue;
          await request.put('/api/cancleOrder', {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            data: { id: orderId, userId }
          }).catch(() => {});
        }
        // Delete any addresses using DELETE /api/address/:id
        for (const addr of userData.address || []) {
          const addressId = typeof addr === 'string' ? addr : (addr._id || addr.id);
          if (!addressId) continue;
          await request.delete(`/api/address/${addressId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).catch(() => {});
        }
      } catch {}
    }
    tokensToCleanup.length = 0;
  });

  // ========== PROFILE TESTS ==========
  
  test('Get profile without token - GET /me - 401 Token Missing', { tag: '@api' }, async ({ request }) => {
    const response = await request.get('/api/me');
    
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message', 'Token Missing');
  });

  test('Get profile with token - GET /me - 200 + user data', { tag: '@api' }, async ({ request }) => {
    const { token, user } = await createUser(request);
    
    const response = await authenticatedRequest(request, 'GET', '/api/me', token);
    
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
    const response = await request.get('/api/me', {
      headers: { 'Authorization': 'Bearer invalid.token.here' }
    });
    
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message', 'Token is invalid');
  });

  test('Verify addresses are populated in profile', { tag: '@api' }, async ({ request }) => {
    const { token } = await createUser(request);
    
    const response = await authenticatedRequest(request, 'GET', '/api/me', token);
    const body = await response.json();
    
    expect(body.data.data).toHaveProperty('address');
    expect(Array.isArray(body.data.data.address)).toBe(true);
  });

  test('Verify orders are populated in profile', { tag: '@api' }, async ({ request }) => {
    const { token } = await createUser(request);
    
    const response = await authenticatedRequest(request, 'GET', '/api/me', token);
    const body = await response.json();
    
    expect(body.data.data).toHaveProperty('orders');
    expect(Array.isArray(body.data.data.orders)).toBe(true);
  });

  // ========== UPDATE USER TESTS ==========
  
  test('Update user without token - PUT /updateUser - 401 Token Missing', { tag: '@api' }, async ({ request }) => {
    const response = await request.put('/api/updateUser', {
      data: { firstName: 'New Name' }
    });
    
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message', 'Token Missing');
  });

  test('Update user with token - PUT /updateUser - 200 updated', { tag: '@api' }, async ({ request }) => {
    const { token } = await createUser(request);
    
    const newFirstName = 'UpdatedFirst';
    const newLastName = 'UpdatedLast';
    const newPhone = '5551234567';
    
    const response = await authenticatedRequest(
      request,
      'PUT',
      '/api/updateUser',
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
    const { token, user } = await createUser(request);
    
    // Try to update with same values
    const response = await authenticatedRequest(
      request,
      'PUT',
      '/api/updateUser',
      token,
      { firstName: user.firstname, lastName: user.lastname }
    );
    
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message', 'No changes detected');
  });

  test('Update firstname only', { tag: '@api' }, async ({ request }) => {
    const { token } = await createUser(request);
    
    const newFirstName = 'OnlyFirstName';
    const response = await authenticatedRequest(
      request,
      'PUT',
      '/api/updateUser',
      token,
      { firstName: newFirstName }
    );
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.updatedUser).toHaveProperty('firstname', newFirstName);
  });

  test('Update lastname only', { tag: '@api' }, async ({ request }) => {
    const { token } = await createUser(request);
    
    const newLastName = 'OnlyLastName';
    const response = await authenticatedRequest(
      request,
      'PUT',
      '/api/updateUser',
      token,
      { lastName: newLastName }
    );
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.updatedUser).toHaveProperty('lastname', newLastName);
  });

  test('Update phoneNumber only', { tag: '@api' }, async ({ request }) => {
    const { token } = await createUser(request);
    
    const newPhone = '5559876543';
    const response = await authenticatedRequest(
      request,
      'PUT',
      '/api/updateUser',
      token,
      { phoneNumber: newPhone }
    );
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.updatedUser).toHaveProperty('phoneNumber', newPhone);
  });

  // ========== PASSWORD RESET TESTS ==========
  
  test('Valid password reset - PUT /reset-password - 200 success', { tag: '@api' }, async ({ request }) => {
    /** @type {any} */
    const userData = generateUserData();
    
    // Register user
    await request.post('/api/register', { data: userData });
    
    // Reset password
    const newPassword = 'NewPassword123!';
    const response = await request.put('/api/reset-password', {
      data: { email: userData.email, password: newPassword }
    });
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('message', 'Password reset successfully');
    
    // Verify can login with new password
    const loginResponse = await request.post('/api/login', {
      data: { email: userData.email, password: newPassword }
    });
    expect(loginResponse.status()).toBe(200);
    // Track token for afterEach cleanup (user now has the new password)
    const loginBody = await loginResponse.json();
    if (loginBody.user?.token) tokensToCleanup.push(loginBody.user.token);
  });

  test('Password reset for non-existent email - 401 not registered', { tag: '@api' }, async ({ request }) => {
    const response = await request.put('/api/reset-password', {
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
    const response = await request.put('/api/reset-password', {
      data: { password: 'NewPassword123!' }
    });
    
    // Backend will return 401 or 500
    expect([401, 500]).toContain(response.status());
  });

  test('Password reset with missing password', { tag: '@api' }, async ({ request }) => {
    const response = await request.put('/api/reset-password', {
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
          const { token } = await createUser(request);
          
          // Update profile
          const updateResponse = await authenticatedRequest(
            request,
            'PUT',
            '/api/updateUser',
            token,
            { firstName: newFirstName, lastName: newLastName }
          );
          
          if (updateResponse.status() === 200) {
            const updateBody = await updateResponse.json();
            // Backend trims whitespace
            expect(updateBody.updatedUser).toHaveProperty('firstname', newFirstName.trim());
            expect(updateBody.updatedUser).toHaveProperty('lastname', newLastName.trim());
            
            // Verify with GET /api/me
            const getResponse = await authenticatedRequest(request, 'GET', '/api/me', token);
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
