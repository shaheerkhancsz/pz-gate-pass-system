import { test, expect } from "@playwright/test";
import { loginAs, logout, USERS } from "./helpers/auth";

test.describe("Authentication", () => {

  test("login with valid admin credentials → redirects to dashboard", async ({ page }) => {
    await loginAs(page, "admin");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("login with wrong password → stays on login page", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("example@agp.com.pk").fill(USERS.admin.email);
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: /^login$/i }).click();
    // Wrong credentials → user is NOT redirected to dashboard
    await page.waitForTimeout(2_000);
    await expect(page).toHaveURL("/login");
  });

  test("login with empty fields → shows validation error", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /^login$/i }).click();
    // Zod will show validation messages
    await expect(page.getByText(/invalid email/i)).toBeVisible();
  });

  test("HOD can log in", async ({ page }) => {
    await loginAs(page, "hod");
    await expect(page).toHaveURL("/");
  });

  test("Security Guard can log in", async ({ page }) => {
    await loginAs(page, "guard");
    await expect(page).toHaveURL("/");
  });

  test("Creator (User) can log in", async ({ page }) => {
    await loginAs(page, "creator");
    await expect(page).toHaveURL("/");
  });

  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });

  test("logout clears session", async ({ page }) => {
    await loginAs(page, "admin");
    await logout(page);
    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });

});
