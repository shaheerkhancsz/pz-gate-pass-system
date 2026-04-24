/**
 * Returnable gate pass workflow:
 * Create → HOD approve → Security allow (stays open) → Partial return → Full return → Auto-complete
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Returnable Gate Pass — Partial Return Workflow", () => {

  test("1. Creator creates a returnable gate pass (10 items)", async ({ page }) => {
    await loginAs(page, "creator");
    await page.goto("/create-gate-pass");

    // Select returnable type
    const returnableBtn = page.getByRole("radio", { name: /returnable/i });
    if (await returnableBtn.count()) await returnableBtn.click();

    await page.getByPlaceholder(/customer name/i).fill("Return Test Customer");
    await page.getByPlaceholder(/delivery address/i).fill("456 Return Street, Karachi");
    await page.getByPlaceholder(/driver name/i).fill("Bilal Ahmed");
    await page.getByPlaceholder(/driver.*mobile|mobile.*number/i).fill("03002345678");
    await page.getByPlaceholder(/cnic/i).fill("42101-2345678-2");
    await page.getByPlaceholder(/vehicle|van number/i).fill("KHI-5678");

    // Add item with quantity 10
    await page.getByPlaceholder(/item name/i).first().fill("Laptop");
    await page.getByPlaceholder(/sku/i).first().fill("LAP-001");
    await page.getByPlaceholder(/qty|quantity/i).first().fill("10");

    // Set expected return date (tomorrow)
    // Click the date picker
    const dateBtn = page.getByRole("button", { name: /pick a date|expected return/i });
    if (await dateBtn.count()) {
      await dateBtn.click();
      // Click tomorrow's date in the calendar
      await page.getByRole("button", { name: "15" }).first().click();
    }

    await page.getByRole("button", { name: /create gate pass|submit/i }).click();
    await page.waitForURL("/gate-passes", { timeout: 15_000 });
    await expect(page.getByText(/gate pass created/i)).toBeVisible();
  });

  test("2. HOD approves the returnable gate pass", async ({ page }) => {
    await loginAs(page, "hod");
    await page.goto("/gate-passes");

    // Find pending returnable pass
    const pendingRow = page.getByText("Pending").first();
    await pendingRow.click();
    await page.waitForURL(/view-gate-pass/);

    await page.getByRole("button", { name: /^approve$/i }).click();
    const confirmBtn = page.getByRole("button", { name: /confirm|yes/i });
    if (await confirmBtn.count()) await confirmBtn.click();

    await expect(page.getByText(/hod approved/i)).toBeVisible({ timeout: 8_000 });
  });

  test("3. Security allows returnable — stays open (not auto-closed)", async ({ page }) => {
    await loginAs(page, "guard");
    await page.goto("/gate-passes");

    const approvedRow = page.getByText(/hod approved/i).first();
    await approvedRow.click();
    await page.waitForURL(/view-gate-pass/);

    await page.getByRole("button", { name: /security allow|allow/i }).click();
    const confirmBtn = page.getByRole("button", { name: /confirm|yes/i });
    if (await confirmBtn.count()) await confirmBtn.click();

    // Should be security_allowed — NOT completed
    await expect(page.getByText(/security allowed/i)).toBeVisible({ timeout: 8_000 });
    // Should NOT show SAP code yet
    await expect(page.getByText(/SAP-/)).not.toBeVisible();
  });

  test("4. Security records partial return (5 of 10 laptops)", async ({ page }) => {
    await loginAs(page, "guard");
    await page.goto("/gate-passes");

    // Find the security_allowed returnable pass
    await page.getByText(/security allowed/i).first().click();
    await page.waitForURL(/view-gate-pass/);

    // Enter 5 in the "Receive Now" input for the Laptop row
    await page.getByPlaceholder("0").first().fill("5");

    // Click Record Received Items
    await page.getByRole("button", { name: /record received items/i }).click();

    // Should show partial return confirmation toast
    await expect(page.getByText(/partial return recorded|items recorded/i)).toBeVisible({ timeout: 8_000 });

    // Gate pass should still be open
    await expect(page.getByText(/security allowed/i)).toBeVisible();

    // Received = 5, Remaining = 5
    await expect(page.getByText("5").nth(1)).toBeVisible();
  });

  test("5. Security records remaining 5 — gate pass auto-completes", async ({ page }) => {
    await loginAs(page, "guard");
    await page.goto("/gate-passes");

    await page.getByText(/security allowed/i).first().click();
    await page.waitForURL(/view-gate-pass/);

    // Enter remaining 5
    await page.getByPlaceholder("0").first().fill("5");
    await page.getByRole("button", { name: /record received items/i }).click();

    // All items returned — auto-completes
    await expect(page.getByText(/gate pass completed|all items returned/i)).toBeVisible({ timeout: 8_000 });

    // Status should now be completed
    await expect(page.getByText(/completed/i)).toBeVisible();

    // SAP code should appear
    await expect(page.getByText(/SAP-/)).toBeVisible({ timeout: 5_000 });
  });

});
