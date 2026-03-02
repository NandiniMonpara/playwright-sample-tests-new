// @ts-check
import { expect, test } from '@playwright/test';
import fc from 'fast-check';
import { createAuthenticatedUser, authenticatedRequest } from './helpers/auth-helper.js';
import { generateAddressData, validAddressArbitrary } from './helpers/test-data.js';

const API_BASE_URL = process.env.API_BASE_URL || 'https://storedemo.testdino.com';

test.describe('Address CRUD API', () => {
  
  test('Property: Address endpoints require authentication', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 9: For any protected endpoint, when called without a JWT token, the response should return status 401.
    
    const protectedEndpoints = [
      { method: 'POST', url: `${API_BASE_URL}/api/address` },
      { method: 'PUT', url: `${API_BASE_URL}/api/updateAddress` },
      { method: 'DELETE', url: `${API_BASE_URL}/api/address/123` }
    ];
    
    for (const endpoint of protectedEndpoints) {
      const response = await request[endpoint.method.toLowerCase()](endpoint.url, {
        data: endpoint.method !== 'DELETE' ? {} : undefined
      });
      expect(response.status()).toBe(401);
    }
  });

  test('Property: Address creation returns valid address', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 16: For any authenticated user and valid address data, when POST /api/address is called, the response should return status 200/201 and contain all required address fields.
    
    await fc.assert(
      fc.asyncProperty(validAddressArbitrary, async (addressData) => {
        const { token } = await createAuthenticatedUser(request);
        
        const response = await authenticatedRequest(
          request,
          'POST',
          `${API_BASE_URL}/api/address`,
          token,
          addressData
        );
        
        const status = response.status();
        expect([200, 201]).toContain(status);
        
        const body = await response.json();
        expect(body).toHaveProperty('id');
        expect(body).toHaveProperty('street');
        expect(body).toHaveProperty('city');
        expect(body).toHaveProperty('state');
        expect(body).toHaveProperty('zipCode');
        expect(body).toHaveProperty('country');
      }),
      { numRuns: 100 }
    );
  });

  test('POST /api/address creates new address', { tag: '@api' }, async ({ request }) => {
    const { token } = await createAuthenticatedUser(request);
    const addressData = generateAddressData();
    
    const response = await authenticatedRequest(
      request,
      'POST',
      `${API_BASE_URL}/api/address`,
      token,
      addressData
    );
    
    expect([200, 201]).toContain(response.status());
    const body = await response.json();
    
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('street', addressData.street);
    expect(body).toHaveProperty('city', addressData.city);
    expect(body).toHaveProperty('state', addressData.state);
    expect(body).toHaveProperty('zipCode', addressData.zipCode);
    expect(body).toHaveProperty('country', addressData.country);
  });

  test('POST /api/address without token returns 401', { tag: '@api' }, async ({ request }) => {
    const addressData = generateAddressData();
    
    const response = await request.post(`${API_BASE_URL}/api/address`, {
      data: addressData
    });
    
    expect(response.status()).toBe(401);
  });

  test('POST /api/address missing required fields returns 400', { tag: '@api' }, async ({ request }) => {
    const { token } = await createAuthenticatedUser(request);
    
    // Missing street
    let response = await authenticatedRequest(
      request,
      'POST',
      `${API_BASE_URL}/api/address`,
      token,
      { city: 'City', state: 'State', zipCode: '12345', country: 'USA' }
    );
    expect(response.status()).toBe(400);
    
    // Missing city
    response = await authenticatedRequest(
      request,
      'POST',
      `${API_BASE_URL}/api/address`,
      token,
      { street: '123 Main St', state: 'State', zipCode: '12345', country: 'USA' }
    );
    expect(response.status()).toBe(400);
  });

  test('Property: Address update modifies existing address', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 17: For any authenticated user with existing address and valid update data, when PUT /api/updateAddress is called, the response should return status 200 and reflect the updated values.
    
    await fc.assert(
      fc.asyncProperty(
        validAddressArbitrary,
        validAddressArbitrary,
        async (initialAddress, updateAddress) => {
          const { token } = await createAuthenticatedUser(request);
          
          // Create address
          const createResponse = await authenticatedRequest(
            request,
            'POST',
            `${API_BASE_URL}/api/address`,
            token,
            initialAddress
          );
          const createdAddress = await createResponse.json();
          
          // Update address
          const updateResponse = await authenticatedRequest(
            request,
            'PUT',
            `${API_BASE_URL}/api/updateAddress`,
            token,
            { ...updateAddress, id: createdAddress.id }
          );
          
          expect(updateResponse.status()).toBe(200);
          const updatedBody = await updateResponse.json();
          expect(updatedBody).toHaveProperty('street', updateAddress.street);
          expect(updatedBody).toHaveProperty('city', updateAddress.city);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('PUT /api/updateAddress updates address', { tag: '@api' }, async ({ request }) => {
    const { token } = await createAuthenticatedUser(request);
    
    // Create address first
    const addressData = generateAddressData();
    const createResponse = await authenticatedRequest(
      request,
      'POST',
      `${API_BASE_URL}/api/address`,
      token,
      addressData
    );
    const createdAddress = await createResponse.json();
    
    // Update address
    const updatedData = {
      id: createdAddress.id,
      street: '456 Updated St',
      city: 'Updated City',
      state: 'Updated State',
      zipCode: '54321',
      country: 'USA'
    };
    
    const updateResponse = await authenticatedRequest(
      request,
      'PUT',
      `${API_BASE_URL}/api/updateAddress`,
      token,
      updatedData
    );
    
    expect(updateResponse.status()).toBe(200);
    const body = await updateResponse.json();
    expect(body).toHaveProperty('street', updatedData.street);
    expect(body).toHaveProperty('city', updatedData.city);
  });

  test('PUT /api/updateAddress without token returns 401', { tag: '@api' }, async ({ request }) => {
    const response = await request.put(`${API_BASE_URL}/api/updateAddress`, {
      data: { id: '123', street: 'New Street' }
    });
    
    expect(response.status()).toBe(401);
  });

  test('Property: Address deletion removes address', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 18: For any authenticated user with existing address, when DELETE /api/address/:id is called, the response should return status 200, and subsequent attempts to access that address should return 404.
    
    await fc.assert(
      fc.asyncProperty(validAddressArbitrary, async (addressData) => {
        const { token } = await createAuthenticatedUser(request);
        
        // Create address
        const createResponse = await authenticatedRequest(
          request,
          'POST',
          `${API_BASE_URL}/api/address`,
          token,
          addressData
        );
        const createdAddress = await createResponse.json();
        
        // Delete address
        const deleteResponse = await authenticatedRequest(
          request,
          'DELETE',
          `${API_BASE_URL}/api/address/${createdAddress.id}`,
          token
        );
        
        expect(deleteResponse.status()).toBe(200);
        
        // Verify address is deleted (subsequent GET should return 404)
        const getResponse = await authenticatedRequest(
          request,
          'GET',
          `${API_BASE_URL}/api/address/${createdAddress.id}`,
          token
        );
        
        expect(getResponse.status()).toBe(404);
      }),
      { numRuns: 100 }
    );
  });

  test('DELETE /api/address/:id deletes address', { tag: '@api' }, async ({ request }) => {
    const { token } = await createAuthenticatedUser(request);
    
    // Create address first
    const addressData = generateAddressData();
    const createResponse = await authenticatedRequest(
      request,
      'POST',
      `${API_BASE_URL}/api/address`,
      token,
      addressData
    );
    const createdAddress = await createResponse.json();
    
    // Delete address
    const deleteResponse = await authenticatedRequest(
      request,
      'DELETE',
      `${API_BASE_URL}/api/address/${createdAddress.id}`,
      token
    );
    
    expect(deleteResponse.status()).toBe(200);
  });

  test('DELETE /api/address/:id without token returns 401', { tag: '@api' }, async ({ request }) => {
    const response = await request.delete(`${API_BASE_URL}/api/address/123`);
    expect(response.status()).toBe(401);
  });

  test('Property: Invalid address IDs return 404', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 19: For any endpoint that accepts a resource ID (address, order) and any invalid or non-existent ID, the response should return status 404.
    
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (invalidId) => {
          const { token } = await createAuthenticatedUser(request);
          
          const response = await authenticatedRequest(
            request,
            'GET',
            `${API_BASE_URL}/api/address/${invalidId}`,
            token
          );
          
          expect(response.status()).toBe(404);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('GET /api/address/:id with invalid ID returns 404', { tag: '@api' }, async ({ request }) => {
    const { token } = await createAuthenticatedUser(request);
    
    const response = await authenticatedRequest(
      request,
      'GET',
      `${API_BASE_URL}/api/address/invalid-id-999`,
      token
    );
    
    expect(response.status()).toBe(404);
  });

  test('DELETE /api/address/:id with invalid ID returns 404', { tag: '@api' }, async ({ request }) => {
    const { token } = await createAuthenticatedUser(request);
    
    const response = await authenticatedRequest(
      request,
      'DELETE',
      `${API_BASE_URL}/api/address/invalid-id-999`,
      token
    );
    
    expect(response.status()).toBe(404);
  });
});
