// @ts-check
import { generateUserData } from './test-data.js';

/**
 * Registers a new test user
 * @param {import('@playwright/test').APIRequestContext} request - Playwright request context
 * @param {Object} userData - User registration data
 * @returns {Promise<{response: any, body: any}>} Registration response
 */
export async function registerUser(request, userData) {
  const response = await request.post('/api/register', {
    data: userData
  });
  return { response, body: await response.json() };
}

/**
 * Logs in a user and returns JWT token
 * @param {import('@playwright/test').APIRequestContext} request - Playwright request context
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<string>} JWT token
 */
export async function loginAndGetToken(request, email, password) {
  const response = await request.post('/api/login', {
    data: { email, password }
  });
  
  if (response.status() !== 200) {
    throw new Error(`Login failed with status ${response.status()}`);
  }
  
  const body = await response.json();
  
  // Token is in body.user.token
  if (body.user && body.user.token) {
    return body.user.token;
  }
  
  throw new Error('Token not found in login response');
}

/**
 * Creates a test user and returns authenticated token
 * @param {import('@playwright/test').APIRequestContext} request - Playwright request context
 * @returns {Promise<{token: string, user: {email: string, password: string, firstname: string, lastname: string}}>} Token and user data
 */
export async function createAuthenticatedUser(request) {
  /** @type {{email: string, password: string, firstname: string, lastname: string}} */
  const userData = /** @type {any} */ (generateUserData());
  
  // Register user
  const registerResponse = await request.post('/api/register', {
    data: userData
  });
  
  if (registerResponse.status() !== 200) {
    const body = await registerResponse.json();
    throw new Error(`Registration failed: ${body.message || registerResponse.status()}`);
  }
  
  // Login to get token
  const token = await loginAndGetToken(request, userData.email, userData.password);
  
  return {
    token,
    user: {
      email: userData.email,
      password: userData.password,
      firstname: userData.firstname,
      lastname: userData.lastname
    }
  };
}

/**
 * Cleans up all orders (cancel) and addresses (delete) for a test user
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} token - JWT token of the user
 */
export async function cleanupUserData(request, token) {
  try {
    const meResponse = await request.get('/api/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!meResponse.ok()) return;

    const userData = (await meResponse.json())?.data?.data;
    if (!userData) return;

    const userId = userData.id;

    // Cancel all orders using PUT /api/cancleOrder
    for (const order of userData.orders || []) {
      const orderId = typeof order === 'string' ? order : (order._id || order.id);
      if (!orderId) continue;
      await request.put('/api/cancleOrder', {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { id: orderId, userId }
      }).catch(() => {});
    }

    // Delete all addresses using DELETE /api/address/:id
    for (const addr of userData.address || []) {
      const addressId = typeof addr === 'string' ? addr : (addr._id || addr.id);
      if (!addressId) continue;
      await request.delete(`/api/address/${addressId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => {});
    }
  } catch {
    // Cleanup failure should never break tests
  }
}

/**
 * Makes an authenticated API request
 * @param {import('@playwright/test').APIRequestContext} request - Playwright request context
 * @param {string} method - HTTP method
 * @param {string} url - Endpoint URL
 * @param {string} token - JWT token
 * @param {Object|null} data - Request payload
 * @returns {Promise<import('@playwright/test').APIResponse>} API response
 */
export async function authenticatedRequest(request, method, url, token, data = null) {
  /** @type {any} */
  const options = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (data) {
    options.data = data;
  }
  
  switch (method.toUpperCase()) {
    case 'GET':
      return await request.get(url, options);
    case 'POST':
      return await request.post(url, options);
    case 'PUT':
      return await request.put(url, options);
    case 'DELETE':
      return await request.delete(url, options);
    default:
      throw new Error(`Unsupported HTTP method: ${method}`);
  }
}
