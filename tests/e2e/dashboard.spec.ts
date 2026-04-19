import { expect, test } from "@playwright/test";

test("overview dashboard loads and links to insights", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /see the shape of your money/i })).toBeVisible();
  await page.getByRole("link", { name: "Insights" }).click();
  await expect(page).toHaveURL(/insights/);
  await expect(page.getByRole("heading", { name: /turn the analytics into clear money decisions/i })).toBeVisible();
});
