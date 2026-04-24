/**
 * Gate pass rejection and send-back flows
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Gate Pass — Rejection & Send Back", () => {

  test("HOD rejects a gate pass with remarks", async ({ page }) => {
    await loginAs(page, "hod");
    await page.goto("/gate-passes");

    const pendingRow = page.getByText("Pending").first();
    if (!(await pendingRow.count())) {
      test.skip(true, "No pending gate passes to test rejection");
      return;
    }
    await pendingRow.click();
    await page.waitForURL(/view-gate-pass/);

    await page.getByRole("button", { name: /reject/i }).click();

    // Fill remarks in dialog
    const remarksField = page.getByPlaceholder(/reason|remarks/i);
    if (await remarksField.count()) await remarksField.fill("Items list is incomplete.");

    await page.getByRole("button", { name: /confirm reject|yes/i }).click();

    await expect(page.getByText(/rejected/i)).toBeVisible({ timeout: 8_000 });
  });

  test("HOD sends back a gate pass with remarks", async ({ page }) => {
    await loginAs(page, "hod");
    await page.goto("/gate-passes");

    const pendingRow = page.getByText("Pending").first();
    if (!(await pendingRow.count())) {
      test.skip(true, "No pending gate passes to test send-back");
      return;
    }
    await pendingRow.click();
    await page.waitForURL(/view-gate-pass/);

    await page.getByRole("button", { name: /send back/i }).click();

    const remarksField = page.getByPlaceholder(/reason|remarks/i);
    if (await remarksField.count()) await remarksField.fill("Please update the customer address.");

    await page.getByRole("button", { name: /confirm|yes/i }).click();

    await expect(page.getByText(/sent back/i)).toBeVisible({ timeout: 8_000 });
  });

  test("Creator sees sent-back banner with remarks", async ({ page }) => {
    await loginAs(page, "creator");
    await page.goto("/gate-passes");

    const sentBackRow = page.getByText(/sent back/i).first();
    if (!(await sentBackRow.count())) {
      test.skip(true, "No sent-back gate passes");
      return;
    }
    await sentBackRow.click();
    await page.waitForURL(/view-gate-pass/);

    // Orange banner should appear
    await expect(page.getByText(/sent back.*review and resubmit/i)).toBeVisible();
    await expect(page.getByText(/Please update the customer address/i)).toBeVisible();
  });

  test("Creator resubmits a sent-back gate pass", async ({ page }) => {
    await loginAs(page, "creator");
    await page.goto("/gate-passes");

    const sentBackRow = page.getByText(/sent back/i).first();
    if (!(await sentBackRow.count())) {
      test.skip(true, "No sent-back gate passes");
      return;
    }
    await sentBackRow.click();
    await page.waitForURL(/view-gate-pass/);

    await page.getByRole("button", { name: /resubmit/i }).click();

    await expect(page.getByText(/pending/i)).toBeVisible({ timeout: 8_000 });
  });

});
