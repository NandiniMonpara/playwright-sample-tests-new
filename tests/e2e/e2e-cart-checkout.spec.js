// @ts-check
import { test, expect } from '@playwright/test';
import AllPages from '../../pages/AllPages.js';
import dotenv from 'dotenv';

dotenv.config({ override: true });

let allPages;

test.beforeEach(async ({ page }) => {
  allPages = new AllPages(page);
  await page.goto('/');
});

async function login(
  username = process.env.USERNAME,
  password = process.env.PASSWORD
) {
  await allPages.loginPage.clickOnUserProfileIcon();
  await allPages.loginPage.validateSignInPage();
  await allPages.loginPage.login(username, password);
}

test.describe('Cart Management', () => {
  test('should delete selected product from cart @ios', async () => {
    const productName = 'GoPro HERO10 Black';

    await login();
    await allPages.inventoryPage.clickOnShopNowButton();
    await allPages.inventoryPage.clickOnAllProductsLink();
    await allPages.inventoryPage.searchProduct(productName);
    await allPages.inventoryPage.clickOnAddToCartIcon();

    await allPages.cartPage.clickOnCartIcon();
    await allPages.cartPage.verifyCartItemVisible(productName);
    await allPages.cartPage.clickOnDeleteProductIcon();
    await allPages.cartPage.verifyEmptyCartMessage();
  });
});

test.describe('Registration to Order', () => {
  test('should place and cancel order as new user @chromium', async () => {
    const email = `test+${Date.now()}@test.com`;

    await test.step('Register user', async () => {
      await allPages.loginPage.clickOnUserProfileIcon();
      await allPages.loginPage.clickOnSignupLink();
      await allPages.signupPage.signup(
        'Test',
        'User',
        email,
        process.env.PASSWORD
      );
    });

    await test.step('Login and place order', async () => {
      await allPages.loginPage.login(email, process.env.PASSWORD);
      await expect(allPages.homePage.getHomeNav()).toBeVisible();

      await allPages.homePage.clickAllProductsNav();
      await allPages.allProductsPage.clickNthProduct(1);
      await allPages.productDetailsPage.clickAddToCartButton();
      await allPages.cartPage.clickOnCheckoutButton();
      await allPages.checkoutPage.selectCashOnDelivery();
      await allPages.checkoutPage.clickOnPlaceOrder();
    });

    await test.step('Cancel order', async () => {
      await allPages.orderPage.clickOnMyOrdersTab();
      await allPages.orderPage.clickCancelOrderButton();
      await allPages.orderPage.confirmCancellation();
    });
  });
});

test.describe('User Profile', () => {
  test('should update personal information @firefox', async () => {
    await login();
    await allPages.userPage.clickOnUserProfileIcon();
    await allPages.userPage.updatePersonalInfo();
    await allPages.userPage.verifyPersonalInfoUpdated();
  });
});
