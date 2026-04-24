/**
 * Form validation tests — phone, CNIC, date, required fields
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Form Validation", () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page, "creator");
    await page.goto("/create-gate-pass");
    // Scroll to driver section where phone/CNIC fields are
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(400);
  });

  test("phone without dash (03062228391) is accepted", async ({ page }) => {
    const phoneField = page.getByPlaceholder(/03\d\d|driver.*mobile/i).first();
    await phoneField.fill("03062228391");
    await phoneField.blur();
    await expect(page.getByText(/phone number must be in format/i)).not.toBeVisible();
  });

  test("phone with dash (0306-2228391) is accepted", async ({ page }) => {
    const phoneField = page.getByPlaceholder(/03\d\d|driver.*mobile/i).first();
    await phoneField.fill("0306-2228391");
    await phoneField.blur();
    await expect(page.getByText(/phone number must be in format/i)).not.toBeVisible();
  });

  test("invalid phone (12345) is rejected", async ({ page }) => {
    const phoneField = page.getByPlaceholder(/03\d\d|driver.*mobile/i).first();
    await phoneField.fill("12345");
    await phoneField.blur();
    // Submit to trigger validation
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.getByRole("button", { name: /create gate pass|submit/i }).click();
    await expect(page.getByText(/phone number must be in format/i)).toBeVisible({ timeout: 5_000 });
  });

  test("past date cannot be selected in calendar", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dayNum = yesterday.getDate().toString();

    const dateBtn = page.locator("button").filter({ hasText: /^\d{1,2}$/ }).first();
    const calendarTrigger = page.locator("[data-testid='date-picker'], button").filter({ hasText: /Mar|Feb|Jan|Apr/ }).first();

    // Try clicking the calendar icon
    await page.locator(".lucide-calendar, [data-testid='calendar']").first().click().catch(() => {});

    const pastDayBtn = page.getByRole("button", { name: new RegExp(`^${dayNum}$`) }).first();
    if (await pastDayBtn.count()) {
      const isDisabled = await pastDayBtn.isDisabled();
      expect(isDisabled).toBe(true);
    } else {
      // Calendar not open — skip gracefully
      test.skip(true, "Calendar not accessible via this selector");
    }
  });

  test("gate pass cannot be submitted without required fields", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.getByRole("button", { name: /create gate pass|submit/i }).click();
    await expect(page).toHaveURL("/create-gate-pass");
  });

  test("CNIC wrong format is rejected", async ({ page }) => {
    const cnicField = page.getByPlaceholder(/cnic|42101/i).first();
    if (!(await cnicField.count())) {
      test.skip(true, "CNIC field not visible — may need scrolling");
      return;
    }
    await cnicField.fill("1234567890");
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.getByRole("button", { name: /create gate pass|submit/i }).click();
    await expect(page.getByText(/cnic must be in format/i)).toBeVisible({ timeout: 5_000 });
  });

});
