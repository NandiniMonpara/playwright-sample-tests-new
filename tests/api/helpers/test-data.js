// @ts-check
import fc from 'fast-check';

/**
 * Generates random string for unique identifiers
 * @param {number} length - String length
 * @returns {string} Random string
 */
export function randomString(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generates unique user data for registration
 * @returns {Object} User data with email, password, firstname, lastname
 */
export function generateUserData() {
  const uniqueId = randomString(8);
  return {
    email: `testuser_${uniqueId}@example.com`,
    password: `Pass${uniqueId}123!`,
    firstname: `Test${uniqueId}`,
    lastname: `User${uniqueId}`
  };
}

/**
 * Generates valid address data (backend format)
 * @param {string} userId - User ID for the address
 * @returns {Object} Address data with id and nested address object
 */
export function generateAddressData(userId = '') {
  const uniqueId = randomString(6);
  return {
    id: userId,
    address: {
      firstname: `Test${uniqueId}`,
      email: `test${uniqueId}@example.com`,
      street: `${Math.floor(Math.random() * 9999) + 1} Main St ${uniqueId}`,
      city: `City${uniqueId}`,
      state: `State${uniqueId}`,
      zipCode: `${Math.floor(Math.random() * 90000) + 10000}`,
      country: 'USA'
    }
  };
}

/**
 * Generates valid order data (backend format)
 * @param {string} email - User email
 * @returns {Object} Order data
 */
export function generateOrderData(email = 'test@example.com') {
  return {
    product: [
      {
        id: '1',
        name: 'Test Product',
        price: 29.99,
        quantity: 2
      }
    ],
    quantity: 2,
    address: {
      street: '123 Test St',
      city: 'Test City',
      state: 'Test State',
      zipCode: '12345',
      country: 'USA'
    },
    paymentMethod: 'credit_card',
    totalAmount: 59.98,
    email: email
  };
}

// Fast-check arbitraries for property-based testing

/**
 * Arbitrary for valid email addresses
 */
export const validEmailArbitrary = fc.emailAddress();

/**
 * Arbitrary for valid passwords (min 6 chars)
 */
export const validPasswordArbitrary = fc.string({ minLength: 6, maxLength: 20 });

/**
 * Arbitrary for weak passwords (less than 6 chars)
 */
export const weakPasswordArbitrary = fc.string({ minLength: 0, maxLength: 5 });

/**
 * Arbitrary for invalid email formats
 */
export const invalidEmailArbitrary = fc.oneof(
  fc.string().filter(s => !s.includes('@')),
  fc.constant(''),
  fc.constant('notanemail'),
  fc.constant('@example.com'),
  fc.constant('user@')
);

/**
 * Arbitrary for valid user names
 */
export const validNameArbitrary = fc.string({ minLength: 1, maxLength: 100 });

/**
 * Arbitrary for valid phone numbers
 */
export const validPhoneArbitrary = fc.string({ minLength: 10, maxLength: 15 })
  .map(s => s.replace(/[^0-9]/g, '').slice(0, 15));

/**
 * Arbitrary for valid user registration data
 */
export const validUserDataArbitrary = fc.record({
  email: validEmailArbitrary,
  password: validPasswordArbitrary,
  firstname: validNameArbitrary,
  lastname: validNameArbitrary
});

/**
 * Arbitrary for valid address data (backend format)
 */
export const validAddressArbitrary = fc.record({
  address: fc.record({
    firstname: fc.string({ minLength: 1, maxLength: 50 }),
    email: validEmailArbitrary,
    street: fc.string({ minLength: 1, maxLength: 200 }),
    city: fc.string({ minLength: 1, maxLength: 100 }),
    state: fc.string({ minLength: 1, maxLength: 100 }),
    zipCode: fc.string({ minLength: 5, maxLength: 10 }),
    country: fc.string({ minLength: 2, maxLength: 100 })
  })
});

/**
 * Arbitrary for valid order items
 */
export const validOrderItemsArbitrary = fc.array(
  fc.record({
    productId: fc.string({ minLength: 1, maxLength: 50 }),
    quantity: fc.integer({ min: 1, max: 100 }),
    price: fc.double({ min: 0.01, max: 10000, noNaN: true })
  }),
  { minLength: 1, maxLength: 10 }
);

/**
 * Arbitrary for valid payment methods
 */
export const validPaymentMethodArbitrary = fc.oneof(
  fc.constant('credit_card'),
  fc.constant('debit_card'),
  fc.constant('paypal'),
  fc.constant('cash_on_delivery')
);
