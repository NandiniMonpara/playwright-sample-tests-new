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
 * @returns {Object} User data with email, password, name, phone
 */
export function generateUserData() {
  const uniqueId = randomString(8);
  return {
    email: `testuser_${uniqueId}@example.com`,
    password: `Pass${uniqueId}123!`,
    name: `Test User ${uniqueId}`,
    phone: `555${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`
  };
}

/**
 * Generates valid address data
 * @returns {Object} Address data with street, city, state, zipCode, country
 */
export function generateAddressData() {
  const uniqueId = randomString(6);
  return {
    street: `${Math.floor(Math.random() * 9999) + 1} Main St ${uniqueId}`,
    city: `City${uniqueId}`,
    state: `State${uniqueId}`,
    zipCode: `${Math.floor(Math.random() * 90000) + 10000}`,
    country: 'USA',
    isDefault: false
  };
}

/**
 * Generates valid order data
 * @param {Array} items - Order items
 * @param {string} addressId - Shipping address ID
 * @returns {Object} Order data
 */
export function generateOrderData(items, addressId) {
  return {
    items: items || [
      {
        productId: '1',
        quantity: 2,
        price: 29.99
      }
    ],
    addressId: addressId,
    paymentMethod: 'credit_card'
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
  name: validNameArbitrary,
  phone: validPhoneArbitrary
});

/**
 * Arbitrary for valid address data
 */
export const validAddressArbitrary = fc.record({
  street: fc.string({ minLength: 1, maxLength: 200 }),
  city: fc.string({ minLength: 1, maxLength: 100 }),
  state: fc.string({ minLength: 1, maxLength: 100 }),
  zipCode: fc.string({ minLength: 5, maxLength: 10 }),
  country: fc.string({ minLength: 2, maxLength: 100 }),
  isDefault: fc.boolean()
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
