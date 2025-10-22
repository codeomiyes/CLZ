/**
 * E2E Tests: Complete Workspace User Journey
 * Test Case IDs: WC-001, WC-002
 */

import { test, expect } from '@playwright/test';

test.describe('Workspace Core - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to application
    await page.goto('http://localhost:3000');
  });

  test('WC-001: User Authentication Flow', async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3000/login');

    // Enter credentials
    await page.fill('input[name="email"]', 'test.user@clorizon.com');
    await page.fill('input[name="password"]', 'SecurePass123!');

    // Click sign in
    await page.click('button[type="submit"]');

    // Verify redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);

    // Verify user session
    const sessionToken = await page.evaluate('localStorage.getItem("authToken")');
    expect(sessionToken).toBeTruthy();

    // Verify dashboard loads within 2 seconds
    const startTime = Date.now();
    await page.waitForSelector('[data-testid="dashboard-content"]');
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(2000);

    // Verify user profile data
    const userName = await page.textContent('[data-testid="user-name"]');
    expect(userName).toBeTruthy();
  });

  test('WC-002: Workspace Creation and Module Loading', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'test.user@clorizon.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard/);

    // Click create workspace
    await page.click('[data-testid="create-workspace-btn"]');

    // Fill workspace details
    await page.fill('input[name="workspaceName"]', 'QA Test Workspace');
    await page.fill('textarea[name="description"]', 'Automated test workspace');

    // Select modules
    await page.check('input[value="ai-assistant"]');
    await page.check('input[value="collaboration-engine"]');

    // Create workspace
    await page.click('button[data-testid="create-btn"]');

    // Verify workspace created
    await expect(page.locator('[data-testid="workspace-title"]')).toContainText('QA Test Workspace');

    // Verify modules loaded
    await expect(page.locator('[data-testid="module-ai-assistant"]')).toBeVisible();
    await expect(page.locator('[data-testid="module-collaboration"]')).toBeVisible();

    // Verify workspace in list
    await page.goto('http://localhost:3000/dashboard');
    await expect(page.locator('text=QA Test Workspace')).toBeVisible();
  });

  test('E2E-003: Complete User Journey - Login to Collaboration', async ({ page }) => {
    // 1. Login
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'test.user@clorizon.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');

    // 2. Create workspace
    await page.click('[data-testid="create-workspace-btn"]');
    await page.fill('input[name="workspaceName"]', 'Collaboration Test');
    await page.check('input[value="collaboration-engine"]');
    await page.click('button[data-testid="create-btn"]');

    // 3. Create document
    await page.click('[data-testid="new-document-btn"]');
    await page.fill('input[name="documentName"]', 'Test Document');
    await page.click('button[data-testid="create-doc-btn"]');

    // 4. Edit document
    const editor = page.locator('[data-testid="document-editor"]');
    await editor.fill('Hello World from E2E test');

    // 5. Verify auto-save
    await page.waitForSelector('[data-testid="save-indicator"]:has-text("Saved")');

    // 6. Share document
    await page.click('[data-testid="share-btn"]');
    await page.fill('input[name="shareEmail"]', 'colleague@clorizon.com');
    await page.click('button[data-testid="send-invite-btn"]');

    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Invitation sent');
  });

  test('E2E-004: AI Assistant Integration', async ({ page }) => {
    // Login and navigate to workspace
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'test.user@clorizon.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');

    // Open AI assistant
    await page.click('[data-testid="ai-assistant-btn"]');

    // Send query
    await page.fill('[data-testid="ai-input"]', 'Summarize my recent activity');
    await page.click('[data-testid="ai-send-btn"]');

    // Verify response
    await page.waitForSelector('[data-testid="ai-response"]', { timeout: 5000 });
    const response = await page.textContent('[data-testid="ai-response"]');
    expect(response).toBeTruthy();
    expect(response!.length).toBeGreaterThan(10);

    // Verify response time indicator
    const responseTime = await page.textContent('[data-testid="response-time"]');
    expect(responseTime).toMatch(/\d+ms/);
  });
});

test.describe('Performance Tests', () => {
  test('PERF-E2E-001: Page load performance', async ({ page }) => {
    const metrics: any[] = [];

    // Measure multiple page loads
    for (let i = 0; i < 3; i++) {
      const startTime = Date.now();
      await page.goto('http://localhost:3000/dashboard');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      metrics.push(loadTime);
    }

    const avgLoadTime = metrics.reduce((a, b) => a + b, 0) / metrics.length;
    expect(avgLoadTime).toBeLessThan(3000); // Average < 3 seconds
  });
});

test.describe('Accessibility Tests', () => {
  test('A11Y-E2E-001: Keyboard navigation', async ({ page }) => {
    await page.goto('http://localhost:3000/login');

    // Tab through form
    await page.keyboard.press('Tab'); // Focus email
    await page.keyboard.type('test@clorizon.com');
    
    await page.keyboard.press('Tab'); // Focus password
    await page.keyboard.type('password123');
    
    await page.keyboard.press('Tab'); // Focus submit button
    await page.keyboard.press('Enter'); // Submit form

    // Verify form submission
    await page.waitForURL(/.*dashboard/, { timeout: 5000 });
  });
});
