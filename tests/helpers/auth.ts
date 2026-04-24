import { Page } from "@playwright/test";

export const USERS = {
  admin:    { email: "admin@parazelsus.pk", password: "admin123", name: "Admin User" },
  hod:      { email: "HOD@agp.com.pk",      password: "hod123",   name: "HOD"        },
  guard:    { email: "guard@agp.com.pk",    password: "guard123", name: "Guard"      },
  creator:  { email: "User@agp.com.pk",     password: "user123",  name: "User"       },
} as const;

export type UserRole = keyof typeof USERS;

/** Log in as the given role and wait for the dashboard. */
export async function loginAs(page: Page, role: UserRole) {
  const user = USERS[role];
  await page.goto("/login");
  await page.getByPlaceholder("example@agp.com.pk").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: /^login$/i }).click();
  await page.waitForURL("/", { timeout: 10_000 });
}

/** Log out by clicking the logout button in the sidebar. */
export async function logout(page: Page) {
  // Click the logout button in the sidebar (bottom of the nav)
  await page.getByRole("button", { name: /logout/i }).click();
  await page.waitForURL("/login", { timeout: 5_000 });
}
