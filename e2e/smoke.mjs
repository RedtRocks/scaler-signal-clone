// End-to-end smoke test: user A signs in with the OTP, opens a chat, sends a message, and user B sees it live.
//
//   cd e2e && npm install && PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npm run smoke
//
// Needs the backend (seeded) and the frontend running. URLs and users can be overridden:
//   WEB_URL=http://localhost:3000 API_URL=http://localhost:8000 A=+15550000001 B=+15550000002
// Selectors are role/text based, so they follow the UI rather than internal test ids.
import { chromium } from "playwright";

const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const API = process.env.API_URL ?? "http://localhost:8000";
const PHONE_A = process.env.A ?? "+15550000001";
const PHONE_B = process.env.B ?? "+15550000002";
const OTP = "123456";

// 10x10 PNG
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC",
  "base64",
);

const step = (msg) => console.log(`- ${msg}`);

async function api(path, { token, method = "GET", body } = {}) {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

/** Signs in through the login screen: phone number, then the 6-digit code. */
async function loginThroughUi(page, phone) {
  await page.goto(`${WEB}/login`);
  // "+1 555 000 0001" -> national digits for the default +1 country
  const national = phone.replace(/^\+1/, "");
  await page.getByPlaceholder("Phone number").fill(national);
  await page.getByRole("button", { name: /^(next|continue|send code|get code)$/i }).click();
  const code = page.getByRole("group", { name: /verification code/i }).getByRole("textbox").first();
  await code.waitFor();
  await code.click();
  await page.keyboard.type(OTP, { delay: 40 });
  // The code usually submits on the last digit; click a confirm button if one is still there.
  const confirm = page.getByRole("button", { name: /^(verify|next|continue|confirm)$/i });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}

async function main() {
  const login = (phone) => api("/auth/verify-otp", { method: "POST", body: { phone, code: OTP } });
  const a = await login(PHONE_A);
  const b = await login(PHONE_B);
  // How each user sees the other (nicknames are per user).
  const chatsA = await api("/conversations", { token: a.token });
  const direct = chatsA.find((c) => c.kind === "direct" && c.peer?.phone === PHONE_B);
  if (!direct) throw new Error(`No direct conversation between ${PHONE_A} and ${PHONE_B}; run python -m app.seed`);
  const titleForA = direct.title;
  const titleForB = a.user.display_name;
  const text = `smoke ${Date.now()}`;

  const browser = await chromium.launch();
  try {
    const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    step(`user B (${PHONE_B}) signs in with the OTP`);
    await loginThroughUi(pageB, PHONE_B);
    step(`user B opens the conversation with ${titleForB}`);
    await pageB.getByText(titleForB, { exact: true }).first().click();
    await pageB.getByRole("textbox", { name: "Message" }).waitFor();

    step(`user A (${PHONE_A}) signs in with the OTP`);
    await loginThroughUi(pageA, PHONE_A);
    step(`user A opens the conversation with ${titleForA}`);
    await pageA.getByText(titleForA, { exact: true }).first().click();
    const composer = pageA.getByRole("textbox", { name: "Message" });
    await composer.waitFor();

    step(`user A sends "${text}"`);
    await composer.fill(text);
    await composer.press("Enter");
    await pageA.getByLabel("Messages", { exact: true }).getByText(text).waitFor({ timeout: 10_000 });

    step("user B sees it arrive without reloading");
    await pageB.getByLabel("Messages", { exact: true }).getByText(text).waitFor({ timeout: 10_000 });
    step("user A attaches a small PNG with a caption; user B sees the picture and the caption live");
    const caption = `photo ${Date.now()}`;
    await pageA.getByTestId("file-input").setInputFiles({ name: "smoke.png", mimeType: "image/png", buffer: TINY_PNG });
    await composer.fill(caption);
    await composer.press("Enter");
    await pageB.getByLabel("Messages", { exact: true }).getByText(caption).waitFor({ timeout: 10_000 });
    await pageB.getByRole("button", { name: "Open smoke.png" }).last().waitFor({ timeout: 10_000 });
    console.log("PASS");
  } catch (error) {
    console.error("FAIL:", error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
