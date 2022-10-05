import { Page } from "puppeteer"
import { MS_TEAMS_CREDENTIALS_LOGIN, MS_TEAMS_CREDENTIALS_PASSWORD } from "./config"
import { sleep } from "./utils"

export const startTeamsSession = async (url: string, page: Page) => {

    await page.browserContext().overridePermissions(url, ['microphone', 'camera'])
    await page.goto(url, { waitUntil: "networkidle2" })

    await page.waitForSelector('input[type=email]')
    await page.type('input[type=email]', MS_TEAMS_CREDENTIALS_LOGIN!, { delay: 20 })
    await page.keyboard.press('Enter', { delay: 100 })
    await page.waitForSelector('input[type=password]', { timeout: 20_000, hidden: true })
    await page.waitForSelector('input[type=password]', { timeout: 20_000, })
    await page.waitForSelector('input[type=text]', { timeout: 20_000, })

    await page.evaluate(() => (document.querySelector('input[type=email]') as HTMLInputElement || {}).value = '')
    try { await page.type('input[type=email]', MS_TEAMS_CREDENTIALS_LOGIN!, { delay: 20 }) } catch (e) { }
    try { await page.type('input[type=text]', MS_TEAMS_CREDENTIALS_LOGIN!, { delay: 20 }) } catch (e) { }
    await page.type('input[type=password]', MS_TEAMS_CREDENTIALS_PASSWORD!, { delay: 20 })
    await page.keyboard.press('Enter', { delay: 100 })
    await page.waitForSelector('input[type=submit]', { hidden: true })
    await page.waitForSelector('input[type=submit]', { timeout: 20_000 })
    await page.click('input[type=submit]')
    await sleep(30_000)

    await page.goto(url, { waitUntil: "domcontentloaded" })
    await sleep(3_000)
    page.screenshot({ path: '/recordings/debug.png' })

    await page.waitForSelector('button[type=button].icons-call-jump-in', { timeout: 100_000 })
    await page.click('button[type=button].icons-call-jump-in')

    await page.waitForSelector('button[type=button].join-btn', { timeout: 10_000 })
    await page.click('button[type=button].join-btn')

    await page.waitForSelector('#microphone-button', { timeout: 60_000 })
    await page.click('#microphone-button')

    await page.waitForSelector('#callingButtons-showMoreBtn', { timeout: 10_000 })
    await page.click('#callingButtons-showMoreBtn')

    await page.waitForSelector('#full-screen-button', { timeout: 10_000 })
    await page.click('#full-screen-button')

    sleep(1_000)
        .then(() => page.waitForSelector('.calling-alert-container .icons-close', { timeout: 0 }))
        .then(() => page.click('.calling-alert-container .icons-close'))
        .catch(e => void (e))
}