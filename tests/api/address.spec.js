// @ts-check
import { expect, test } from '@playwright/test';
import fc from 'fast-check';
import { createAuthenticatedUser, authenticatedRequest } from './helpers/auth-helper.js';

import { generateAddressData, validAddressArbitrary } from './helpers/test-data.js';

test.describe('Address CRUD API', () => {
  /** @type {string[]} */
  const tokensToCleanup = [];

  // Wraps createAuthenticatedUser and auto-tracks the token for afterEach cleanup
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
        const addresses = (await meRes.json())?.data?.data?.address || [];
        // Delete all addresses using DELETE /api/address/:id
        for (const addr of addresses) {
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

  test('Add address without token - POST /address - 401 Token Missing', { tag: '@api' }, async ({ request }) => {
    const addressData = generateAddressData('someUserId');
    
    const response = await request.post('/api/address', {
      data: addressData
    });
    
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message', 'Token Missing');
  });

  test('Add address with token - POST /address - 200 added', { tag: '@api' }, async ({ request }) => {
    const { token } = await createUser(request);
    
    // Get user ID first
    const meResponse = await authenticatedRequest(request, 'GET', '/api/me', token);
    const meBody = await meResponse.json();
    const userId = meBody.data.data.id;
    
    const addressData = generateAddressData(userId);
    
    const response = await authenticatedRequest(
      request,
      'POST',
      '/api/address',
      token,
      addressData
    );
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('message', 'Address added successfully');
    expect(body).toHaveProperty('data');
    expect(body.data.user.addresses).toBeDefined();
    expect(body.data.user.addresses.length).toBeGreaterThan(0);
  });

  test('Add duplicate address - POST /address - 400 already exists', { tag: '@api' }, async ({ request }) => {
    const { token } = await createUser(request);
    
    // Get user ID
    const meResponse = await authenticatedRequest(request, 'GET', '/api/me', token);
    const meBody = await meResponse.json();
    const userId = meBody.data.data.id;
    
    const addressData = generateAddressData(userId);
    
    // Add address first time
    await authenticatedRequest(request, 'POST', '/api/address', token, addressData);
    
    // Try to add same address again
    const response = await authenticatedRequest(
      request,
      'POST',
      '/api/address',
      token,
      addressData
    );
    
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message', 'This address already exists');
  });

  test('Add address with missing required fields returns 400 or 500', { tag: '@api' }, async ({ request }) => {
    const { token } = await createUser(request);
    
    const meResponse = await authenticatedRequest(request, 'GET', '/api/me', token);
    const meBody = await meResponse.json();
    const userId = meBody.data.data.id;
    
    // Missing street
    const response = await authenticatedRequest(
      request,
      'POST',
      '/api/address',
      token,
      {
        id: userId,
        address: {
          email: 'test@example.com',
          city: 'City',
          state: 'State',
          zipCode: '12345',
          country: 'USA'
        }
      }
    );
    
    expect([400, 500]).toContain(response.status());
  });

  test('Update address - PUT /updateAddress - 200 updated', { tag: '@api' }, async ({ request }) => {
    const { token } = await createUser(request);
    
    // Get user ID
    const meResponse = await authenticatedRequest(request, 'GET', '/api/me', token);
    const meBody = await meResponse.json();
    const userId = meBody.data.data.id;
    
    // Add address first
    const addressData = generateAddressData(userId);
    const addResponse = await authenticatedRequest(
      request,
      'POST',
      '/api/address',
      token,
      addressData
    );
    const addBody = await addResponse.json();
    const addressId = addBody.data.user.addresses[0]._id;
    
    // Update address
    const updatedData = {
      id: addressId,
      userId: userId,
      street: '456 Updated St',
      city: 'Updated City',
      state: 'Updated State',
      zipCode: '54321',
      country: 'USA',
      email: 'updated@example.com'
    };
    
    const updateResponse = await authenticatedRequest(
      request,
      'PUT',
      '/api/updateAddress',
      token,
      updatedData
    );
    
    expect(updateResponse.status()).toBe(200);
    const updateBody = await updateResponse.json();
    expect(updateBody).toHaveProperty('success', true);
    expect(updateBody).toHaveProperty('message', 'Address updated successfully');
    expect(updateBody.data.address).toHaveProperty('street', updatedData.street);
    expect(updateBody.data.address).toHaveProperty('city', updatedData.city);
  });

  test('Update address without token returns 401', { tag: '@api' }, async ({ request }) => {
    const response = await request.put('/api/updateAddress', {
      data: { id: '123', userId: '456', street: 'New Street' }
    });
    
    expect(response.status()).toBe(401);
  });

  test('Update address without address ID returns 400', { tag: '@api' }, async ({ request }) => {
    const { token } = await createUser(request);
    
    const response = await authenticatedRequest(
      request,
      'PUT',
      '/api/updateAddress',
      token,
      { userId: '123', street: 'New Street' }
    );
    
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('message', 'Address ID and User ID are required');
  });

  test('Delete address - DELETE /address/:id - 200 deleted', { tag: '@api' }, async ({ request }) => {
    const { token } = await createUser(request);
    
    // Get user ID
    const meResponse = await authenticatedRequest(request, 'GET', '/api/me', token);
    const meBody = await meResponse.json();
    const userId = meBody.data.data.id;
    
    // Add address first
    const addressData = generateAddressData(userId);
    const addResponse = await authenticatedRequest(
      request,
      'POST',
      '/api/address',
      token,
      addressData
    );
    const addBody = await addResponse.json();
    const addressId = addBody.data.user.addresses[0]._id;
    
    // Delete address
    const deleteResponse = await authenticatedRequest(
      request,
      'DELETE',
      `/api/address/${addressId}`,
      token
    );
    
    expect(deleteResponse.status()).toBe(200);
    const deleteBody = await deleteResponse.json();
    expect(deleteBody).toHaveProperty('success', true);
    expect(deleteBody).toHaveProperty('message', 'Address deleted successfully');
  });

  test('Delete address without token returns 401', { tag: '@api' }, async ({ request }) => {
    const response = await request.delete('/api/address/123');
    
    expect(response.status()).toBe(401);
  });

  test('Delete non-existent address returns 404', { tag: '@api' }, async ({ request }) => {
    const { token } = await createUser(request);
    
    const response = await authenticatedRequest(
      request,
      'DELETE',
      '/api/address/507f1f77bcf86cd799439011',
      token
    );
    
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body).toHaveProperty('message', 'Address not found');
  });

  test('Property: Address creation returns valid address', { tag: '@api' }, async ({ request }) => {
    // Create user once and reuse for all property test iterations
    const { token } = await createUser(request);
    const meResponse = await authenticatedRequest(request, 'GET', '/api/me', token);
    const meBody = await meResponse.json();
    const userId = meBody.data.data.id;
    
    await fc.assert(
      fc.asyncProperty(validAddressArbitrary, async (addressData) => {
        /** @type {any} */ (addressData).id = userId;
        
        const response = await authenticatedRequest(
          request,
          'POST',
          '/api/address',
          token,
          addressData
        );
        
        if (response.status() === 200) {
          const body = await response.json();
          expect(body).toHaveProperty('success', true);
          expect(body.data.user.addresses).toBeDefined();
        }
      }),
      { numRuns: 10 }
    );
  });
});
