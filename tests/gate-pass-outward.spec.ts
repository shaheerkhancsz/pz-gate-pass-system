/**
 * Full outward gate pass workflow:
 * Creator creates → HOD approves → Security allows → Auto-completed + SAP code
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Outward Gate Pass — Full Workflow", () => {

  test("1. Creator creates an outward gate pass", async ({ page }) => {
    await loginAs(page, "creator");
    await page.goto("/create-gate-pass");

    // Outward is selected by default
    await expect(page.getByText("Outward")).toBeVisible();

    // ── Customer section ──
    await page.getByPlaceholder("Enter customer name").fill("Test Customer");
    await page.getByPlaceholder("e.g. 0300-1234567").first().fill("0306-2228391");
    await page.getByPlaceholder("Enter delivery address").fill("123 Test Street, Karachi");

    // ── Scroll to driver section ──
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(400);

    // Fill driver fields by label proximity
    await page.getByLabel(/^Driver Name/i).fill("Ali Khan");
    await page.getByLabel(/Driver Mobile|Driver Phone/i).fill("0301-1234567");
    await page.getByLabel(/CNIC/i).fill("42101-1234567-1");
    await page.getByLabel(/Vehicle|Van Number/i).fill("KHI-1234");

    // ── Scroll to items section ──
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(400);
    await page.getByPlaceholder(/item name/i).first().fill("Test Item");
    await page.getByPlaceholder(/sku/i).first().fill("SKU-001");

    // ── Submit ──
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /create gate pass|submit/i }).click();

    await page.waitForURL("/gate-passes", { timeout: 15_000 });
    await expect(page.getByText(/gate pass created/i)).toBeVisible();
  });

  test("2. HOD approves the gate pass", async ({ page }) => {
    await loginAs(page, "hod");
    await page.goto("/gate-passes");

    await page.getByText("Pending").first().click();
    await page.waitForURL(/view-gate-pass/);

    await page.getByRole("button", { name: /^approve$/i }).click();

    const confirmBtn = page.getByRole("button", { name: /confirm|yes/i });
    if (await confirmBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    await expect(page.getByText(/hod approved/i)).toBeVisible({ timeout: 8_000 });
  });

  test("3. Security Guard allows — outward auto-completes with SAP code", async ({ page }) => {
    await loginAs(page, "guard");
    await page.goto("/gate-passes");

    await page.getByText(/hod approved/i).first().click();
    await page.waitForURL(/view-gate-pass/);

    await page.getByRole("button", { name: /security allow|allow/i }).click();

    const confirmBtn = page.getByRole("button", { name: /confirm|yes/i });
    if (await confirmBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    await expect(page.getByText(/completed/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.locator("code").filter({ hasText: /SAP-/ })).toBeVisible({ timeout: 5_000 });
  });

  test("4. SAP code is copyable", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/gate-passes");

    await page.getByText(/completed/i).first().click();
    await page.waitForURL(/view-gate-pass/);

    await expect(page.locator("code").filter({ hasText: /SAP-/ })).toBeVisible();
    await expect(page.getByTitle(/copy to clipboard/i)).toBeVisible();
  });

  test("5. Workflow History tab shows full audit trail", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/gate-passes");

    await page.getByText(/completed/i).first().click();
    await page.waitForURL(/view-gate-pass/);

    await page.getByRole("tab", { name: /workflow history/i }).click();

    await expect(page.getByText(/gate pass created/i)).toBeVisible();
    await expect(page.getByText(/hod approved/i)).toBeVisible();
    await expect(page.getByText(/security cleared/i)).toBeVisible();
  });

});
