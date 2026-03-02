// @ts-check
import { expect, test } from '@playwright/test';
import fc from 'fast-check';
import { createAuthenticatedUser, authenticatedRequest } from './helpers/auth-helper.js';
import { generateAddressData, generateOrderData, validOrderItemsArbitrary, validPaymentMethodArbitrary } from './helpers/test-data.js';

const API_BASE_URL = process.env.API_BASE_URL || 'https://storedemo.testdino.com';

test.describe('Order Operations API', () => {
  
  test('Property: Order endpoints require authentication', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 9: For any protected endpoint, when called without a JWT token, the response should return status 401.
    
    const protectedEndpoints = [
      { method: 'POST', url: `${API_BASE_URL}/api/createOrder` },
      { method: 'GET', url: `${API_BASE_URL}/api/findOrder/123` },
      { method: 'PUT', url: `${API_BASE_URL}/api/cancleOrder` }
    ];
    
    for (const endpoint of protectedEndpoints) {
      const response = await request[endpoint.method.toLowerCase()](endpoint.url, {
        data: endpoint.method !== 'GET' ? {} : undefined
      });
      expect(response.status()).toBe(401);
    }
  });

  test('Property: Order creation returns complete order', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 20: For any authenticated user with valid order data (items, addressId, paymentMethod), when POST /api/createOrder is called, the response should return status 200/201 and contain all required order fields.
    
    await fc.assert(
      fc.asyncProperty(
        validOrderItemsArbitrary,
        validPaymentMethodArbitrary,
        async (items, paymentMethod) => {
          const { token } = await createAuthenticatedUser(request);
          
          // Create address for order
          const addressData = generateAddressData();
          const addressResponse = await authenticatedRequest(
            request,
            'POST',
            `${API_BASE_URL}/api/address`,
            token,
            addressData
          );
          const address = await addressResponse.json();
          
          // Create order
          const orderData = {
            items,
            addressId: address.id,
            paymentMethod
          };
          
          const response = await authenticatedRequest(
            request,
            'POST',
            `${API_BASE_URL}/api/createOrder`,
            token,
            orderData
          );
          
          const status = response.status();
          expect([200, 201]).toContain(status);
          
          const body = await response.json();
          expect(body).toHaveProperty('orderId');
          expect(body).toHaveProperty('userId');
          expect(body).toHaveProperty('items');
          expect(body).toHaveProperty('total');
          expect(body).toHaveProperty('status');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('POST /api/createOrder creates new order', { tag: '@api' }, async ({ request }) => {
    const { token } = await createAuthenticatedUser(request);
    
    // Create address first
    const addressData = generateAddressData();
    const addressResponse = await authenticatedRequest(
      request,
      'POST',
      `${API_BASE_URL}/api/address`,
      token,
      addressData
    );
    const address = await addressResponse.json();
    
    // Create order
    const orderData = generateOrderData(null, address.id);
    const response = await authenticatedRequest(
      request,
      'POST',
      `${API_BASE_URL}/api/createOrder`,
      token,
      orderData
    );
    
    expect([200, 201]).toContain(response.status());
    const body = await response.json();
    
    expect(body).toHaveProperty('orderId');
    expect(body).toHaveProperty('userId');
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('addressId', address.id);
  });

  test('POST /api/createOrder without token returns 401', { tag: '@api' }, async ({ request }) => {
    const orderData = generateOrderData(null, 'some-address-id');
    
    const response = await request.post(`${API_BASE_URL}/api/createOrder`, {
      data: orderData
    });
    
    expect(response.status()).toBe(401);
  });

  test('POST /api/createOrder missing required fields returns 400', { tag: '@api' }, async ({ request }) => {
    const { token } = await createAuthenticatedUser(request);
    
    // Missing items
    let response = await authenticatedRequest(
      request,
      'POST',
      `${API_BASE_URL}/api/createOrder`,
      token,
      { addressId: 'addr123', paymentMethod: 'credit_card' }
    );
    expect(response.status()).toBe(400);
    
    // Missing addressId
    response = await authenticatedRequest(
      request,
      'POST',
      `${API_BASE_URL}/api/createOrder`,
      token,
      { items: [{ productId: '1', quantity: 1, price: 10 }], paymentMethod: 'credit_card' }
    );
    expect(response.status()).toBe(400);
    
    // Missing paymentMethod
    response = await authenticatedRequest(
      request,
      'POST',
      `${API_BASE_URL}/api/createOrder`,
      token,
      { items: [{ productId: '1', quantity: 1, price: 10 }], addressId: 'addr123' }
    );
    expect(response.status()).toBe(400);
  });

  test('POST /api/createOrder with invalid product IDs returns 400 or 404', { tag: '@api' }, async ({ request }) => {
    const { token } = await createAuthenticatedUser(request);
    
    // Create address
    const addressData = generateAddressData();
    const addressResponse = await authenticatedRequest(
      request,
      'POST',
      `${API_BASE_URL}/api/address`,
      token,
      addressData
    );
    const address = await addressResponse.json();
    
    // Create order with invalid product ID
    const orderData = {
      items: [{ productId: 'invalid-product-999', quantity: 1, price: 10 }],
      addressId: address.id,
      paymentMethod: 'credit_card'
    };
    
    const response = await authenticatedRequest(
      request,
      'POST',
      `${API_BASE_URL}/api/createOrder`,
      token,
      orderData
    );
    
    expect([400, 404]).toContain(response.status());
  });

  test('Property: Order retrieval returns order details', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 22: For any authenticated user with valid order ID, when GET /api/findOrder/:id is called, the response should return status 200 and contain complete order details.
    
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const { token } = await createAuthenticatedUser(request);
        
        // Create address and order
        const addressData = generateAddressData();
        const addressResponse = await authenticatedRequest(
          request,
          'POST',
          `${API_BASE_URL}/api/address`,
          token,
          addressData
        );
        const address = await addressResponse.json();
        
        const orderData = generateOrderData(null, address.id);
        const createResponse = await authenticatedRequest(
          request,
          'POST',
          `${API_BASE_URL}/api/createOrder`,
          token,
          orderData
        );
        const createdOrder = await createResponse.json();
        
        // Get order
        const getResponse = await authenticatedRequest(
          request,
          'GET',
          `${API_BASE_URL}/api/findOrder/${createdOrder.orderId}`,
          token
        );
        
        expect(getResponse.status()).toBe(200);
        const body = await getResponse.json();
        expect(body).toHaveProperty('orderId', createdOrder.orderId);
        expect(body).toHaveProperty('items');
        expect(body).toHaveProperty('total');
        expect(body).toHaveProperty('status');
      }),
      { numRuns: 100 }
    );
  });

  test('GET /api/findOrder/:id returns order details', { tag: '@api' }, async ({ request }) => {
    const { token } = await createAuthenticatedUser(request);
    
    // Create address and order
    const addressData = generateAddressData();
    const addressResponse = await authenticatedRequest(
      request,
      'POST',
      `${API_BASE_URL}/api/address`,
      token,
      addressData
    );
    const address = await addressResponse.json();
    
    const orderData = generateOrderData(null, address.id);
    const createResponse = await authenticatedRequest(
      request,
      'POST',
      `${API_BASE_URL}/api/createOrder`,
      token,
      orderData
    );
    const createdOrder = await createResponse.json();
    
    // Get order
    const response = await authenticatedRequest(
      request,
      'GET',
      `${API_BASE_URL}/api/findOrder/${createdOrder.orderId}`,
      token
    );
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('orderId', createdOrder.orderId);
  });

  test('GET /api/findOrder/:id without token returns 401', { tag: '@api' }, async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/findOrder/123`);
    expect(response.status()).toBe(401);
  });

  test('GET /api/findOrder/:id with invalid ID returns 404', { tag: '@api' }, async ({ request }) => {
    const { token } = await createAuthenticatedUser(request);
    
    const response = await authenticatedRequest(
      request,
      'GET',
      `${API_BASE_URL}/api/findOrder/invalid-order-999`,
      token
    );
    
    expect(response.status()).toBe(404);
  });

  test('Property: Order cancellation updates status', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 23: For any authenticated user with valid order ID, when PUT /api/cancleOrder is called, the response should return status 200, and subsequent GET /api/findOrder/:id should show cancelled status.
    
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const { token } = await createAuthenticatedUser(request);
        
        // Create address and order
        const addressData = generateAddressData();
        const addressResponse = await authenticatedRequest(
          request,
          'POST',
          `${API_BASE_URL}/api/address`,
          token,
          addressData
        );
        const address = await addressResponse.json();
        
        const orderData = generateOrderData(null, address.id);
        const createResponse = await authenticatedRequest(
          request,
          'POST',
          `${API_BASE_URL}/api/createOrder`,
          token,
          orderData
        );
        const createdOrder = await createResponse.json();
        
        // Cancel order
        const cancelResponse = await authenticatedRequest(
          request,
          'PUT',
          `${API_BASE_URL}/api/cancleOrder`,
          token,
          { orderId: createdOrder.orderId }
        );
        
        expect(cancelResponse.status()).toBe(200);
        
        // Verify order is cancelled
        const getResponse = await authenticatedRequest(
          request,
          'GET',
          `${API_BASE_URL}/api/findOrder/${createdOrder.orderId}`,
          token
        );
        
        const body = await getResponse.json();
        expect(body).toHaveProperty('status', 'cancelled');
      }),
      { numRuns: 100 }
    );
  });

  test('PUT /api/cancleOrder cancels order', { tag: '@api' }, async ({ request }) => {
    const { token } = await createAuthenticatedUser(request);
    
    // Create address and order
    const addressData = generateAddressData();
    const addressResponse = await authenticatedRequest(
      request,
      'POST',
      `${API_BASE_URL}/api/address`,
      token,
      addressData
    );
    const address = await addressResponse.json();
    
    const orderData = generateOrderData(null, address.id);
    const createResponse = await authenticatedRequest(
      request,
      'POST',
      `${API_BASE_URL}/api/createOrder`,
      token,
      orderData
    );
    const createdOrder = await createResponse.json();
    
    // Cancel order
    const response = await authenticatedRequest(
      request,
      'PUT',
      `${API_BASE_URL}/api/cancleOrder`,
      token,
      { orderId: createdOrder.orderId }
    );
    
    expect(response.status()).toBe(200);
    
    // Verify status
    const getResponse = await authenticatedRequest(
      request,
      'GET',
      `${API_BASE_URL}/api/findOrder/${createdOrder.orderId}`,
      token
    );
    const body = await getResponse.json();
    expect(body).toHaveProperty('status', 'cancelled');
  });

  test('PUT /api/cancleOrder without token returns 401', { tag: '@api' }, async ({ request }) => {
    const response = await request.put(`${API_BASE_URL}/api/cancleOrder`, {
      data: { orderId: '123' }
    });
    
    expect(response.status()).toBe(401);
  });

  test('PUT /api/cancleOrder with invalid order ID returns 404', { tag: '@api' }, async ({ request }) => {
    const { token } = await createAuthenticatedUser(request);
    
    const response = await authenticatedRequest(
      request,
      'PUT',
      `${API_BASE_URL}/api/cancleOrder`,
      token,
      { orderId: 'invalid-order-999' }
    );
    
    expect(response.status()).toBe(404);
  });
});
