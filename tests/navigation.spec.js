// @ts-check
import { expect, test } from '@playwright/test';
import AllPages from '../pages/AllPages.js';
import dotenv from 'dotenv';

dotenv.config({ override: true });

let allPages;

/* -------------------- Hooks -------------------- */
test.beforeEach(async ({ page }) => {
  allPages = new AllPages(page);
  await page.goto('/');
});

/* -------------------- Helpers -------------------- */
async function login(
  username = process.env.USERNAME,
  password = process.env.PASSWORD
) {
  await allPages.loginPage.clickOnUserProfileIcon();
  await allPages.loginPage.validateSignInPage();
  await allPages.loginPage.login(username, password);
}

async function logout() {
  await allPages.loginPage.clickOnUserProfileIcon();
  await allPages.loginPage.clickOnLogoutButton();
}

/* =================================================
   LEVEL 1 — ROOT SUITE
================================================= */
test.describe('Navigation', () => {

  /* =============================================
     LEVEL 2 — FEATURE
  ============================================= */
  test.describe('Navbar Navigation', () => {

    /* =========================================
       LEVEL 3 — SCENARIO
    ========================================= */
    test.describe('Verify Navbar Links', () => {

      test('Verify that all the navbar links work correctly @firefox', async () => {

        await test.step('Login as existing user', async () => {
          await login();
        });

        await test.step('Verify navigation links', async () => {
          await allPages.homePage.clickBackToHomeButton();

          await allPages.homePage.clickAllProductsNav();
          await allPages.allProductsPage.assertAllProductsTitle();

          await allPages.homePage.clickOnContactUsLink();
          await allPages.contactUsPage.assertContactUsTitle();

          await allPages.homePage.clickAboutUsNav();
          await allPages.homePage.assertAboutUsTitle();
        });
      });

    });

  });

  /* =============================================
     LEVEL 2 — FEATURE
  ============================================= */
  test.describe('Contact Us Page', () => {

    /* =========================================
       LEVEL 3 — SCENARIO
    ========================================= */
    test.describe('Submit Contact Us Form', () => {

      test('Verify that user can submit Contact Us form successfully @firefox', async () => {
        await login();

        await allPages.homePage.clickOnContactUsLink();
        await allPages.contactUsPage.assertContactUsTitle();

        await allPages.contactUsPage.fillContactUsForm();
        await allPages.contactUsPage.verifySuccessContactUsFormSubmission();
      });

    });

  });

});
