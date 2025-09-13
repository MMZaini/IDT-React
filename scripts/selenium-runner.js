#!/usr/bin/env node
const { Builder, By, Key, until, Capabilities } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');
// Ensure chromedriver binary is registered (chromedriver npm package)
try {
  require('chromedriver');
  console.log('chromedriver module loaded');
} catch (e) {
  console.log('chromedriver module not found or failed to load:', e && e.message);
}

async function main() {
  const b64 = process.argv[2];
  if (!b64) {
    console.error('No data');
    process.exit(2);
  }
  const csv = Buffer.from(b64, 'base64').toString('utf8');
  console.log('CSV length', csv.length);

  // Start Chrome (headed)
  let options = new chrome.Options();
  options = options.addArguments('--start-maximized');

  let driver;
  try {
    console.log('Creating Chrome driver...');
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
    console.log('Driver created');
  } catch (err) {
    console.error('Failed to create driver', err);
    process.exit(4);
  }
  try {
    await driver.get('https://eu.idtdna.com/site/order/oligoentry');

    // accept cookies if present — try a few strategies and xpaths
    try {
      const cookieXPaths = [
        '/html/body/div[7]/div[2]/div/div/div[2]/div/div/button',
        '/html/body/div[6]/div[2]/div/div/div[2]/div/div/button',
        "//button[contains(., 'Accept') or contains(., 'accept') or contains(., 'Agree') or contains(., 'I agree')]",
      ];

      let clickedCookie = false;
      for (const xp of cookieXPaths) {
        try {
          await driver.wait(until.elementLocated(By.xpath(xp)), 2000);
          const cookieBtn = await driver.findElement(By.xpath(xp));
          try {
            await driver.executeScript('arguments[0].scrollIntoView({block:"center"})', cookieBtn);
          } catch (e) {}
          try {
            await cookieBtn.click();
            console.log('Clicked cookie accept via xpath', xp);
            clickedCookie = true;
            break;
          } catch (e) {
            try {
              await driver.executeScript('arguments[0].click()', cookieBtn);
              console.log('Clicked cookie accept via JS click xpath', xp);
              clickedCookie = true;
              break;
            } catch (err) {
              console.log('Cookie element found but not clickable for xpath', xp, err && err.message);
            }
          }
        } catch (err) {
          // not found quickly, try next
        }
      }
      if (!clickedCookie) console.log('No cookie prompt clicked');
    } catch (e) {
      console.log('Error while attempting cookie accept:', e && e.message);
    }

    // helper to robustly click elements
    async function robustClick(el) {
      try {
        await driver.executeScript('arguments[0].scrollIntoView({block:"center"})', el);
      } catch (e) {}
      try {
        await driver.wait(until.elementIsVisible(el), 5000);
      } catch (e) {}
      // wait until enabled as well
      try {
        await driver.wait(async () => {
          try {
            return await el.isEnabled();
          } catch (err) {
            return false;
          }
        }, 5000);
      } catch (e) {}

      try {
        await el.click();
      } catch (e) {
        // fallback to JS click
        try {
          await driver.executeScript('arguments[0].click()', el);
        } catch (err) {
          throw err;
        }
      }
    }

    // Bulk input mode button
    await driver.wait(until.elementLocated(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[5]/div/div[1]/div[1]/div/div[3]/button')), 7000)
    const bulkBtn = await driver.findElement(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[5]/div/div[1]/div[1]/div/div[3]/button'))
    await robustClick(bulkBtn);
    console.log('Clicked bulk input');
    await driver.sleep(600);

    // Delimiter dropdown
    await driver.wait(until.elementLocated(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[2]/div[3]/div[1]/select')), 5000)
    const delim = await driver.findElement(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[2]/div[3]/div[1]/select'))
    await robustClick(delim);
    // select comma (second option)
    try {
      const opt = await delim.findElement(By.css('option:nth-child(2)'));
      await robustClick(opt);
    } catch (e) {
      console.log('Could not click option directly, trying sendKeys', e && e.message);
      await delim.sendKeys(',');
    }
    console.log('Selected comma delimiter');
    await driver.sleep(300);

    // Bulk code textarea
    await driver.wait(until.elementLocated(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[2]/div[4]/div[1]/div[1]/textarea')), 5000)
    const ta = await driver.findElement(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[2]/div[4]/div[1]/div[1]/textarea'))
    try {
      await driver.executeScript('arguments[0].scrollIntoView({block:"center"})', ta);
    } catch (e) {}
    await ta.clear();
    await ta.sendKeys(csv);
    console.log('Entered CSV');
    await driver.sleep(300);

    // Click update
  const updateBtn = await driver.findElement(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[3]/div/div[1]/button'))
  await robustClick(updateBtn);
  console.log('Clicked update');
  await driver.sleep(800);

    // Click add to cart
  const addBtn = await driver.findElement(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[5]/div/div[2]/div[1]/div[2]/div[3]/div/button[1]'))
  await robustClick(addBtn);
  console.log('Clicked add to cart');

    console.log('Done');
    process.exit(0);
  } catch (err) {
    console.error('Runner error', err);
    process.exit(3);
  } finally {
    // don't quit to allow user to see the final state
    // await driver.quit();
  }
}

main();
