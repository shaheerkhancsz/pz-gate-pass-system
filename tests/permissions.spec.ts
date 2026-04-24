/**
 * Role-based permission tests
 * Verifies each role sees/does only what they are allowed to.
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Permissions — Admin", () => {

  test("Admin sees Statistics cards on dashboard", async ({ page }) => {
    await loginAs(page, "admin");
    await expect(page.getByText(/total gate passes/i)).toBeVisible();
  });

  test("Admin can access /admin panel", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin");
    await expect(page).toHaveURL("/admin");
    await expect(page.getByRole("heading", { name: /admin|administration/i })).toBeVisible();
  });

  test("Admin can access all report tabs", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/reports");
    await expect(page.getByRole("tab", { name: /gate pass summary/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /analytics/i })).toBeVisible();
  });

});

test.describe("Permissions — Creator (User role)", () => {

  test("Creator does NOT see Statistics cards", async ({ page }) => {
    await loginAs(page, "creator");
    await expect(page.getByText(/total gate passes/i)).not.toBeVisible();
  });

  test("Creator can create a gate pass", async ({ page }) => {
    await loginAs(page, "creator");
    await page.goto("/create-gate-pass");
    await expect(page.getByRole("heading", { name: /create gate pass/i })).toBeVisible();
  });

  test("Creator cannot access /admin panel", async ({ page }) => {
    await loginAs(page, "creator");
    await page.goto("/admin");
    // Should redirect away or show forbidden
    await expect(page).not.toHaveURL("/admin");
  });

  test("Creator sees their own gate passes in list", async ({ page }) => {
    await loginAs(page, "creator");
    await page.goto("/gate-passes");
    await expect(page.getByRole("heading", { name: /gate passes/i })).toBeVisible();
  });

});

test.describe("Permissions — HOD", () => {

  test("HOD sees Pending Approvals widget on dashboard", async ({ page }) => {
    await loginAs(page, "hod");
    await expect(page.getByText(/pending approval|awaiting your approval/i)).toBeVisible();
  });

  test("HOD does NOT see Statistics cards", async ({ page }) => {
    await loginAs(page, "hod");
    await expect(page.getByText(/total gate passes/i)).not.toBeVisible();
  });

  test("HOD sees Approve/Reject buttons on pending gate passes", async ({ page }) => {
    await loginAs(page, "hod");
    await page.goto("/gate-passes");

    const pendingRow = page.getByText("Pending").first();
    if (!(await pendingRow.count())) {
      test.skip(true, "No pending gate passes");
      return;
    }
    await pendingRow.click();
    await page.waitForURL(/view-gate-pass/);

    await expect(page.getByRole("button", { name: /^approve$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /reject/i })).toBeVisible();
  });

});

test.describe("Permissions — Security Guard", () => {

  test("Security Guard sees clearance widget on dashboard", async ({ page }) => {
    await loginAs(page, "guard");
    await expect(page.getByText(/security|awaiting clearance|security allowed/i)).toBeVisible();
  });

  test("Security Guard does NOT see Approve button (HOD action)", async ({ page }) => {
    await loginAs(page, "guard");
    await page.goto("/gate-passes");

    const pendingRow = page.getByText("Pending").first();
    if (!(await pendingRow.count())) {
      test.skip(true, "No pending passes");
      return;
    }
    await pendingRow.click();
    await page.waitForURL(/view-gate-pass/);

    await expect(page.getByRole("button", { name: /^approve$/i })).not.toBeVisible();
  });

});

test.describe("Permissions — Vendor page", () => {

  test("Admin can see Vendors in sidebar", async ({ page }) => {
    await loginAs(page, "admin");
    await expect(page.getByRole("link", { name: /vendors/i })).toBeVisible();
  });

});
