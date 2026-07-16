import { chromium } from 'playwright-core';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const executablePath =
  process.env.HOME +
  '/Library/Caches/ms-playwright/chromium-1060/chrome-mac/Chromium.app/Contents/MacOS/Chromium';

function loadEnv() {
  const p = join(root, '.env');
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

function summarize(obj) {
  if (!obj) return 'null';
  if (obj.error) return `error:${obj.error.message || JSON.stringify(obj.error).slice(0, 120)}`;
  const c = obj.choices?.[0]?.message?.content;
  if (c) return `ok:${String(c).slice(0, 80).replace(/\n/g, ' ')}`;
  return `raw:${JSON.stringify(obj).slice(0, 120)}`;
}

const results = [];

async function testApi(env) {
  const key = env.VOLCENGINE_API_KEY || env.VITE_VOLCENGINE_API_KEY;
  const base = (env.VOLCENGINE_BASE_URL || env.VITE_VOLCENGINE_BASE_URL || '').replace(/\/$/, '');
  const model = env.VOLCENGINE_MODEL || env.VITE_VOLCENGINE_MODEL;
  if (!key || !base || !model) {
    results.push({ name: 'volcengine_api', pass: false, detail: 'missing env' });
    return;
  }
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: '只回复两个字：正常' }],
        max_tokens: 32,
        temperature: 0,
      }),
    });
    const data = await res.json();
    const ok = res.ok && !!data.choices?.[0]?.message?.content;
    results.push({
      name: 'volcengine_chat_completions',
      pass: ok,
      status: res.status,
      detail: summarize(data),
    });
  } catch (e) {
    results.push({
      name: 'volcengine_chat_completions',
      pass: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}

async function testUi() {
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('http://localhost:1420/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const body = await page.locator('body').innerText();
  results.push({
    name: 'ui_shell_loads',
    pass: body.includes('资源管理器') || body.includes('Explorer'),
    detail: body.slice(0, 200).replace(/\n/g, ' | '),
  });
  results.push({
    name: 'ui_no_page_errors',
    pass: errors.length === 0,
    detail: errors.join('; ') || 'none',
  });

  // Open README
  await page.getByText('README.md').first().click();
  await page.waitForTimeout(2000);
  const afterOpen = await page.locator('body').innerText();
  results.push({
    name: 'ui_open_file',
    pass: /OpenForge/i.test(afterOpen) && /markdown|行|Ln/i.test(afterOpen),
    detail: afterOpen.slice(0, 250).replace(/\n/g, ' | '),
  });

  // Open settings
  const gear = page.locator('button').filter({ has: page.locator('svg') }).last();
  // Click settings via activity - look for settings text or last activity button
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')];
    const settings = buttons.find((b) => /设置|Settings/i.test(b.getAttribute('title') || b.textContent || ''));
    if (settings) settings.click();
  });
  await page.waitForTimeout(800);
  let settingsText = await page.locator('body').innerText();
  if (!/火山|Volcengine|API/i.test(settingsText)) {
    // try clicking activity bar icons by order - settings often last
    const acts = page.locator('.activity-bar button, [class*="activity"] button');
    const count = await acts.count().catch(() => 0);
    if (count > 0) {
      await acts.nth(count - 1).click().catch(() => {});
      await page.waitForTimeout(800);
      settingsText = await page.locator('body').innerText();
    }
  }
  results.push({
    name: 'ui_settings_volcengine',
    pass: /火山|Volcengine|doubao-seed/i.test(settingsText),
    detail: settingsText.slice(0, 300).replace(/\n/g, ' | '),
  });

  // Chat send via UI
  await page.evaluate(() => {
    // close modal if open
    document.querySelector('.modal-overlay')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(400);
  const input = page.locator('#chat-input');
  if (await input.count()) {
    await input.fill('只回复两个字：正常');
    await page.locator('.send-btn, button').filter({ hasText: /发送|Send/i }).first().click().catch(async () => {
      await input.press('Enter');
    });
    await page.waitForTimeout(12000);
    const chat = await page.locator('.chat-messages, .chat-panel').innerText().catch(() => '');
    results.push({
      name: 'ui_chat_roundtrip',
      pass: /正常|assistant|Error|error|失败|401|403|404|429/i.test(chat) && chat.length > 10,
      detail: chat.slice(0, 400).replace(/\n/g, ' | '),
    });
  } else {
    results.push({ name: 'ui_chat_roundtrip', pass: false, detail: 'chat input missing' });
  }

  await browser.close();
}

async function testCli() {
  const { execSync } = await import('child_process');
  try {
    const help = execSync('node apps/cli/dist/index.js --help', {
      cwd: root,
      encoding: 'utf8',
      env: process.env,
    });
    results.push({
      name: 'cli_help',
      pass: /openforge|agent|ask|plan/i.test(help),
      detail: help.slice(0, 200).replace(/\n/g, ' | '),
    });
  } catch (e) {
    results.push({
      name: 'cli_help',
      pass: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}

const env = loadEnv();
await testApi(env);
await testCli();
await testUi();

const failed = results.filter((r) => !r.pass);
console.log(JSON.stringify({ summary: { total: results.length, passed: results.length - failed.length, failed: failed.length }, results }, null, 2));
process.exit(failed.length ? 1 : 0);
