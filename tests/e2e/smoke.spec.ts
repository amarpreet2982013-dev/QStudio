import { _electron as electron, expect, test } from "@playwright/test";

test("opens the Silq Studio window", async () => {
  const app = await electron.launch({ args: ["."] });
  const window = await app.firstWindow();
  await expect(window).toHaveTitle("Silq Studio");
  await app.close();
});
