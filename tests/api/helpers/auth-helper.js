// @ts-check
import { generateUserData } from './test-data.js';

const API_BASE_URL = process.env.API_BASE_URL || 'https://storedemo.testdino.com';

/**
 * Registers a new test user
 * @param {import('@playwright/test').APIRequestContext} request - Playwright request context
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} Registration response
 */
export async function registerUser(request, userData) {
  const response = await request.post(`${API_BASE_URL}/api/register`, {
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
  const response = await request.post(`${API_BASE_URL}/api/login`, {
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
 * @returns {Promise<{token: string, user: Object}>} Token and user data
 */
export async function createAuthenticatedUser(request) {
  const userData = generateUserData();
  
  // Register user
  const registerResponse = await request.post(`${API_BASE_URL}/api/register`, {
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
 * Makes an authenticated API request
 * @param {import('@playwright/test').APIRequestContext} request - Playwright request context
 * @param {string} method - HTTP method
 * @param {string} url - Endpoint URL
 * @param {string} token - JWT token
 * @param {Object} data - Request payload
 * @returns {Promise<import('@playwright/test').APIResponse>} API response
 */
export async function authenticatedRequest(request, method, url, token, data = null) {
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
