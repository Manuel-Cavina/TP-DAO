import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

mkdirSync("e2e/.auth", { recursive: true });

async function setupAuth() {
  const browser = await chromium.launch({ headless: true });

  // 1. Setup Admin
  console.log("Setting up Admin session...");
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto("http://localhost:5173/#/login", { waitUntil: "networkidle" });
  
  const adminRoleBtn = adminPage.locator('button.role-card[data-role="Administrador"]');
  if (await adminRoleBtn.count() > 0) {
    await adminRoleBtn.click();
  }
  await adminPage.fill('#loginEmail', "admin@stocky.local");
  await adminPage.fill('#loginPassword', "stocky-demo");
  await adminPage.click('button[type="submit"]');
  
  await adminPage.waitForFunction(() => window.location.hash.includes("/dashboard"), { timeout: 10000 });
  console.log("Logged in as Admin. Current URL:", adminPage.url());
  await adminContext.storageState({ path: "e2e/.auth/admin.json" });
  console.log("Admin session saved to e2e/.auth/admin.json");
  await adminContext.close();

  // 2. Setup Operador
  console.log("Setting up Operador session...");
  const opContext = await browser.newContext();
  const opPage = await opContext.newPage();
  await opPage.goto("http://localhost:5173/#/login", { waitUntil: "networkidle" });
  
  const opRoleBtn = opPage.locator('button.role-card[data-role="Operador"]');
  if (await opRoleBtn.count() > 0) {
    await opRoleBtn.click();
  }
  await opPage.fill('#loginEmail', "operador@stocky.local");
  await opPage.fill('#loginPassword', "stocky-demo");
  await opPage.click('button[type="submit"]');
  
  await opPage.waitForFunction(() => window.location.hash.includes("/operador"), { timeout: 10000 });
  console.log("Logged in as Operador. Current URL:", opPage.url());
  await opContext.storageState({ path: "e2e/.auth/operador.json" });
  console.log("Operador session saved to e2e/.auth/operador.json");
  await opContext.close();

  await browser.close();
  console.log("Auth setup complete!");
}

setupAuth().catch((err) => {
  console.error("Auth setup error:", err);
  process.exit(1);
});
