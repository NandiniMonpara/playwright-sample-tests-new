// @ts-check
import { expect, test } from '@playwright/test';
import AllPages from '../pages/AllPages.js';
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

test.describe('Application E2E Tests', () => {

  /* =============================================
     Nested Describe
  ============================================= */
  test.describe('Product Reviews', () => {

    test('User can submit a product review @firefox', async () => {

      await test.step('Login and open product', async () => {
        await login();
        await allPages.homePage.clickOnShopNowButton();
        await allPages.allProductsPage.clickNthProduct(1);
      });

      await test.step('Submit review', async () => {
        await allPages.productDetailsPage.clickOnReviewsTab();
        await allPages.productDetailsPage.clickOnWriteAReviewBtn();
        await allPages.productDetailsPage.fillReviewForm();
        await allPages.productDetailsPage.assertSubmittedReview({
          name: 'John Doe',
          title: 'Great Product',
          opinion: 'This product exceeded my expectations. Highly recommend!',
        });
      });
    });

    test('User can edit and delete a product review @firefox', async () => {

      await test.step('Submit review first', async () => {
        await login();
        await allPages.homePage.clickOnShopNowButton();
        await allPages.allProductsPage.clickNthProduct(1);

        await allPages.productDetailsPage.clickOnReviewsTab();
        await allPages.productDetailsPage.clickOnWriteAReviewBtn();
        await allPages.productDetailsPage.fillReviewForm();
      });

      await test.step('Edit review', async () => {
        await allPages.productDetailsPage.clickOnEditReviewBtn();
        await allPages.productDetailsPage.updateReviewForm();
        await allPages.productDetailsPage.assertUpdatedReview({
          title: 'Updated Review Title',
          opinion: 'This is an updated review opinion.',
        });
      });

      await test.step('Delete review', async () => {
        await allPages.productDetailsPage.clickOnDeleteReviewBtn();
      });
    });

  });

  test.describe('Product Filtering', () => {

    /* ------------ Test ------------ */
    test('User can filter products by price range @webkit', async () => {
      await login();
      await allPages.homePage.clickOnShopNowButton();
      await allPages.homePage.clickOnFilterButton();
      await allPages.homePage.AdjustPriceRangeSlider('10000', '20000');
      await allPages.homePage.clickOnFilterButton();
    });

  });

  test.describe('Wishlist to Checkout', () => {

    /* ------------ Test ------------ */
    test('User can wishlist product and checkout @webkit', async () => {
      await login();

      await test.step('Wishlist flow', async () => {
        await allPages.homePage.clickOnShopNowButton();
        await allPages.inventoryPage.addToWishlist();
        await allPages.inventoryPage.clickOnWishlistIconHeader();
        await allPages.inventoryPage.clickOnWishlistAddToCard();
      });

      await test.step('Checkout flow', async () => {
        await allPages.cartPage.clickOnCartIcon();
        await allPages.cartPage.clickOnCheckoutButton();
        await allPages.checkoutPage.selectCashOnDelivery();
        await allPages.checkoutPage.clickOnPlaceOrder();
        await allPages.checkoutPage.verifyOrderPlacedSuccessfully();
      });
    });

  });

  test.describe('Order Journey', () => {

    /* ------------ Test ------------ */
    test('User can place and cancel order @webkit', async () => {
      const productName = 'GoPro HERO10 Black';

      await login();
      await allPages.inventoryPage.searchProduct(productName);
      await allPages.inventoryPage.clickOnAddToCartIcon();

      await allPages.cartPage.clickOnCheckoutButton();
      await allPages.checkoutPage.selectCashOnDelivery();
      await allPages.checkoutPage.clickOnPlaceOrder();

      await allPages.orderPage.clickOnMyOrdersTab();
      await allPages.orderPage.clickCancelOrderButton(2);
      await allPages.orderPage.confirmCancellation();
    });

  });

  test.describe('Registration to Order', () => {

    /* ------------ Test ------------ */
    test('New user can register and place order @chromium', async () => {

      const email = `test+${Date.now()}@test.com`;

      await test.step('Register user', async () => {
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
        await allPages.homePage.clickOnShopNowButton();
        await allPages.allProductsPage.clickNthProduct(1);
        await allPages.productDetailsPage.clickAddToCartButton();
        await allPages.cartPage.clickOnCartIcon();
        await allPages.cartPage.clickOnCheckoutButton();
        await allPages.checkoutPage.selectCashOnDelivery();
        await allPages.checkoutPage.clickOnPlaceOrder();
      });

    });

  });

});
