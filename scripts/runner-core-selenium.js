const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

// Ensure chromedriver binary is registered (chromedriver npm package)
try { require('chromedriver'); } catch {}

function createLogger() {
  const lines = [];
  return {
    log: (...args) => { const s = args.map(a => String(a)).join(' '); lines.push(s); },
    output: () => lines.join('\n')
  };
}

async function robustClick(driver, el, log) {
  try { await driver.executeScript('arguments[0].scrollIntoView({block:"center"})', el); } catch {}
  try { await driver.wait(until.elementIsVisible(el), 5000); } catch {}
  try {
    await driver.wait(async () => {
      try { return await el.isEnabled(); } catch { return false; }
    }, 5000);
  } catch {}
  try { await el.click(); }
  catch (e) {
    try { await driver.executeScript('arguments[0].click()', el); }
    catch (err) { throw err; }
  }
}

async function acceptCookiesIfPresent(driver, log) {
  const cookieXPaths = [
    '/html/body/div[7]/div[2]/div/div/div[2]/div/div/button',
    '/html/body/div[6]/div[2]/div/div/div[2]/div/div/button',
    "//button[contains(., 'Accept') or contains(., 'accept') or contains(., 'Agree') or contains(., 'I agree')]",
  ];
  for (const xp of cookieXPaths) {
    try {
      await driver.wait(until.elementLocated(By.xpath(xp)), 2000);
      const btn = await driver.findElement(By.xpath(xp));
      await robustClick(driver, btn, log);
  log.log('Accepted cookies');
      return;
    } catch {}
  }
}

async function runSelenium({ csv, test }, log = createLogger()) {
  log.log(`CSV length: ${String(csv ? csv.length : 0)}`);

  let options = new chrome.Options();
  options = options.addArguments('--start-maximized');

  let driver;
  try {
  log.log('Launching Chrome');
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  log.log('Chrome ready');
  } catch (err) {
    log.log('Failed to create driver', err && err.message);
    return { ok: false, output: log.output() };
  }
  try {
  await driver.get('https://eu.idtdna.com/site/order/oligoentry');
    await acceptCookiesIfPresent(driver, log);

    if (test) {
      await driver.sleep(3000);
      return { ok: true, output: log.output() };
    }

    // Bulk input button
    await driver.wait(until.elementLocated(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[5]/div/div[1]/div[1]/div/div[3]/button')), 10000);
  const bulkBtn = await driver.findElement(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[5]/div/div[1]/div[1]/div/div[3]/button'));
    await robustClick(driver, bulkBtn, log);
  log.log('Selected bulk input');
    await driver.sleep(600);

    // Delimiter dropdown
    await driver.wait(until.elementLocated(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[2]/div[3]/div[1]/select')), 10000);
    const delim = await driver.findElement(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[2]/div[3]/div[1]/select'));
    await robustClick(driver, delim, log);
    try { const opt = await delim.findElement(By.css('option:nth-child(2)')); await robustClick(driver, opt, log); }
    catch { await delim.sendKeys(','); }
  log.log('Set delimiter to comma');
    await driver.sleep(300);

    // Bulk textarea
    await driver.wait(until.elementLocated(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[2]/div[4]/div[1]/div[1]/textarea')), 10000);
    const ta = await driver.findElement(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[2]/div[4]/div[1]/div[1]/textarea'));
    await ta.clear();
    await ta.sendKeys(csv);
  log.log('Entered CSV lines');
    await driver.sleep(300);

    // Update
    const updateBtn = await driver.findElement(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[3]/div/div[1]/button'));
    await robustClick(driver, updateBtn, log);
  log.log('Updated lines');
    await driver.sleep(1000);

    // Add to cart
    const addBtn = await driver.findElement(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[5]/div/div[2]/div[1]/div[2]/div[3]/div/button[1]'));
    await robustClick(driver, addBtn, log);
  log.log('Added to cart');

    await driver.sleep(Number(process.env.IDT_KEEP_OPEN_MS || '4000'));
  log.log('Automation complete');
    return { ok: true, output: log.output() };
  } catch (err) {
  log.log(`Error: ${err && err.message}`);
    return { ok: false, output: log.output() };
  } finally {
    // leave window open by not calling driver.quit();
  }
}

module.exports = { runSelenium };
