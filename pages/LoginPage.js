import BasePage from './BasePage.js';
import { expect } from '@playwright/test';

class LoginPage extends BasePage{

  /**
   * @param {import('@playwright/test').Page} page
   */
    constructor(page) {
        super(page);
        this.page = page;
    }

    locators = {
        loginPageTitle: `//h2[text()=' Sign In']`,
        userName: `[placeholder="Your email address"]`,
        password: `[placeholder="Your password"]`,
        loginButton: `//button[text()='Sign in']`,
        invalidLoginError: '[data-test="error"]',
        userIcon: `//*[name()='svg'][.//*[name()='path' and contains(@d,'M25.1578 1')]]`,
        logoutButton: `//p[text()='Log Out']`,
        signupLink: `Sign up`,
        successSignInMessage: `Logged in successfully`,
    }

    async navigateToLoginPage() {
        await this.navigateTo('/');
    }

    getLoginPageTitle() {
        return this.page.locator(this.locators.loginPageTitle);
    }

    getUserNameInput() {
        return this.page.locator(this.locators.userName);
    }

    getPasswordInput() {
        return this.page.locator(this.locators.password);
    }

    getLoginButton() {
        return this.page.locator(this.locators.loginButton);
    }

    async clickUserIcon() {
        await this.page.locator(this.locators.userIcon).click();
    }

    async clickOnUserProfileIcon() {
        // Try desktop icon first, fallback to mobile if needed
        const userIcon = this.page.locator('[data-testid="header-user-icon"]').or(this.page.locator(this.locators.userIcon));
        try {
            await userIcon.waitFor({ state: 'visible', timeout: 5000 });
            await userIcon.click();
        } catch (e) {
            // If element is not visible (common on mobile), try alternative selectors
            // Check for mobile menu button or hamburger menu
            const mobileMenu = this.page.locator('[data-testid="mobile-menu-button"]').or(this.page.locator('button[aria-label*="menu" i]'));
            if (await mobileMenu.isVisible().catch(() => false)) {
                await mobileMenu.click();
                // After opening mobile menu, try to find user icon again
                await userIcon.waitFor({ state: 'visible', timeout: 3000 });
                await userIcon.click();
            } else {
                // Last resort: force click if element exists in DOM
                await userIcon.click({ force: true });
            }
        }
    }

    async assertLoginPage() {
        await expect(this.getLoginPageTitle()).toBeVisible();
        await expect(this.getUserNameInput()).toBeVisible();
        await expect(this.getPasswordInput()).toBeVisible();
        await expect(this.getLoginButton()).toBeVisible();
    }

    async login(username, password) {
        if (!username || !password) {
            throw new Error('Username and password are required for login');
        }
        await this.page.fill(this.locators.userName, username);
        await this.page.fill(this.locators.password, password);
        await this.page.click(this.locators.loginButton);
        await this.page.waitForTimeout(2000);
    }

    async clickOnLogoutButton() {
        await this.page.locator(this.locators.logoutButton).click();
    }
    async validateSignInPage() {
        await expect(this.getLoginPageTitle()).toBeVisible();
    }

    async clickOnSignupLink() {
        await this.page.getByText(this.locators.signupLink).click();
    }

    async verifySuccessSignIn() {
        await expect(this.page.getByText(this.locators.successSignInMessage)).toBeVisible({ timeout: 10000 });
    }
}

export default LoginPage;