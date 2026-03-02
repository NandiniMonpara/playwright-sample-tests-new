// @ts-check
import { expect, test } from '@playwright/test';
import fc from 'fast-check';
import { createAuthenticatedUser } from './helpers/auth-helper.js';

const API_BASE_URL = process.env.API_BASE_URL || 'https://storedemo.testdino.com';

test.describe('Error Handling and Validation API', () => {
  
  test('Property: Non-existent endpoints return 404', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 25: For any request to a non-existent endpoint, the response should return status 404.
    
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (randomPath) => {
          const response = await request.get(`${API_BASE_URL}/api/${randomPath}`);
          expect(response.status()).toBe(404);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('GET to non-existent endpoint returns 404', { tag: '@api' }, async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/nonexistent-endpoint`);
    expect(response.status()).toBe(404);
  });

  test('POST to non-existent endpoint returns 404', { tag: '@api' }, async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/nonexistent-endpoint`, {
      data: {}
    });
    expect(response.status()).toBe(404);
  });

  test('Property: All error responses contain meaningful messages', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 27: For any error response (status 4xx or 5xx), the response body should contain a meaningful error message.
    
    const errorScenarios = [
      { url: `${API_BASE_URL}/api/login`, data: { email: 'invalid' }, expectedStatus: 400 },
      { url: `${API_BASE_URL}/api/login`, data: { email: 'test@example.com', password: 'wrong' }, expectedStatus: 401 },
      { url: `${API_BASE_URL}/api/me`, data: null, expectedStatus: 401 },
      { url: `${API_BASE_URL}/api/nonexistent`, data: null, expectedStatus: 404 }
    ];
    
    for (const scenario of errorScenarios) {
      const response = scenario.data 
        ? await request.post(scenario.url, { data: scenario.data })
        : await request.get(scenario.url);
      
      expect(response.status()).toBe(scenario.expectedStatus);
      
      const body = await response.json();
      // Should have error or message field
      const hasErrorMessage = body.error || body.message;
      expect(hasErrorMessage).toBeTruthy();
      expect(typeof hasErrorMessage).toBe('string');
      expect(hasErrorMessage.length).toBeGreaterThan(0);
    }
  });

  test('Property: Unsupported HTTP methods return 405', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 28: For any endpoint and any unsupported HTTP method, the response should return status 405.
    
    const endpoints = [
      `${API_BASE_URL}/api/register`,
      `${API_BASE_URL}/api/login`,
      `${API_BASE_URL}/api/me`
    ];
    
    for (const endpoint of endpoints) {
      // Try PATCH method (typically not supported)
      const response = await request.fetch(endpoint, {
        method: 'PATCH',
        data: {}
      });
      
      expect(response.status()).toBe(405);
    }
  });

  test('Property: All responses include Content-Type header', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 29: For any API response, the response headers should include Content-Type set to application/json.
    
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const { token } = await createAuthenticatedUser(request);
        
        const endpoints = [
          { method: 'GET', url: `${API_BASE_URL}/api/me`, headers: { 'Authorization': `Bearer ${token}` } },
          { method: 'POST', url: `${API_BASE_URL}/api/login`, data: { email: 'test@example.com', password: 'pass' } }
        ];
        
        for (const endpoint of endpoints) {
          const response = endpoint.method === 'GET'
            ? await request.get(endpoint.url, { headers: endpoint.headers })
            : await request.post(endpoint.url, { data: endpoint.data });
          
          const contentType = response.headers()['content-type'];
          expect(contentType).toBeDefined();
          expect(contentType).toContain('application/json');
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Malformed JSON returns 400', { tag: '@api' }, async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/register`, {
      headers: { 'Content-Type': 'application/json' },
      data: 'invalid json string'
    });
    
    expect(response.status()).toBe(400);
  });

  test('Property: All successful responses conform to schema', { tag: '@api' }, async ({ request }) => {
    // Feature: store-api-testing, Property 26: For any successful API response (status 2xx), the response body should conform to the expected schema for that endpoint.
    
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const { token } = await createAuthenticatedUser(request);
        
        // Test /api/me response schema
        const response = await request.get(`${API_BASE_URL}/api/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        expect(response.status()).toBe(200);
        const body = await response.json();
        
        // Validate schema
        expect(body).toHaveProperty('id');
        expect(body).toHaveProperty('email');
        expect(body).toHaveProperty('name');
        expect(body).toHaveProperty('createdAt');
        
        // Validate types
        expect(typeof body.id).toBe('string');
        expect(typeof body.email).toBe('string');
        expect(typeof body.name).toBe('string');
        expect(typeof body.createdAt).toBe('string');
      }),
      { numRuns: 100 }
    );
  });

  test('Empty request body to endpoints requiring data returns 400', { tag: '@api' }, async ({ request }) => {
    // Test register with empty body
    let response = await request.post(`${API_BASE_URL}/api/register`, {
      data: {}
    });
    expect(response.status()).toBe(400);
    
    // Test login with empty body
    response = await request.post(`${API_BASE_URL}/api/login`, {
      data: {}
    });
    expect(response.status()).toBe(400);
  });

  test('Invalid data types return 400', { tag: '@api' }, async ({ request }) => {
    // Test with number instead of string for email
    const response = await request.post(`${API_BASE_URL}/api/register`, {
      data: {
        email: 12345,
        password: 'Password123!',
        name: 'Test User'
      }
    });
    
    expect(response.status()).toBe(400);
  });

  test('SQL injection attempts are handled safely', { tag: '@api' }, async ({ request }) => {
    const sqlInjectionPayloads = [
      "' OR '1'='1",
      "admin'--",
      "' OR 1=1--",
      "'; DROP TABLE users--"
    ];
    
    for (const payload of sqlInjectionPayloads) {
      const response = await request.post(`${API_BASE_URL}/api/login`, {
        data: {
          email: payload,
          password: payload
        }
      });
      
      // Should return 400 or 401, not 500 (server error)
      expect([400, 401]).toContain(response.status());
    }
  });

  test('XSS attempts in input fields are handled safely', { tag: '@api' }, async ({ request }) => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")'
    ];
    
    for (const payload of xssPayloads) {
      const response = await request.post(`${API_BASE_URL}/api/register`, {
        data: {
          email: `test_${Date.now()}@example.com`,
          password: 'Password123!',
          name: payload
        }
      });
      
      // Should either accept and sanitize, or reject with 400
      // Should not cause server error (500)
      expect(response.status()).not.toBe(500);
    }
  });

  test('Extremely long input strings are handled', { tag: '@api' }, async ({ request }) => {
    const longString = 'a'.repeat(10000);
    
    const response = await request.post(`${API_BASE_URL}/api/register`, {
      data: {
        email: `test@example.com`,
        password: 'Password123!',
        name: longString
      }
    });
    
    // Should return 400 for validation error, not 500
    expect([400, 413]).toContain(response.status());
  });

  test('Special characters in input are handled correctly', { tag: '@api' }, async ({ request }) => {
    const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const response = await request.post(`${API_BASE_URL}/api/register`, {
      data: {
        email: `test_${Date.now()}@example.com`,
        password: 'Password123!',
        name: `Test ${specialChars} User`
      }
    });
    
    // Should handle gracefully
    expect([200, 201, 400]).toContain(response.status());
  });

  test('Unicode characters in input are handled correctly', { tag: '@api' }, async ({ request }) => {
    const unicodeString = '测试用户 🚀 Тест';
    
    const response = await request.post(`${API_BASE_URL}/api/register`, {
      data: {
        email: `test_${Date.now()}@example.com`,
        password: 'Password123!',
        name: unicodeString
      }
    });
    
    // Should handle gracefully
    expect([200, 201, 400]).toContain(response.status());
  });
});
