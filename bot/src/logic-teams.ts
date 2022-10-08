import { Page } from "puppeteer"
import { MS_TEAMS_CREDENTIALS_LOGIN, MS_TEAMS_CREDENTIALS_ORIGINS, MS_TEAMS_CREDENTIALS_PASSWORD } from "./config"
import { sleep } from "./utils"

const requireOriginForCredentials = (page: Page) => {
    const url = page.url()
    const origin = new URL(url).origin;
    if (!MS_TEAMS_CREDENTIALS_ORIGINS.includes(origin))
        throw new Error(`Origin ${origin} not permitted to enter credentials`)
}

export const startTeamsSession = async (url: string, page: Page) => {

    await page.browserContext().overridePermissions(url, ['microphone', 'camera'])
    await page.goto(url, { waitUntil: "networkidle2" })

    let willLogin = true
    try {
        await page.waitForSelector('input[type=email]')
    } catch (e) {
        willLogin = false
        await page.waitForSelector('#ts-waffle-button')
    }
    if (willLogin) {
        await page.waitForSelector('input[type=email]')
        requireOriginForCredentials(page)
        await page.type('input[type=email]', MS_TEAMS_CREDENTIALS_LOGIN!, { delay: 20 })
        await page.keyboard.press('Enter', { delay: 100 })
        await page.waitForSelector('input[type=password]', { timeout: 20_000, hidden: true })
        await page.waitForSelector('input[type=password]', { timeout: 20_000, })
        await page.waitForSelector('input[type=text]', { timeout: 20_000, })

        await page.evaluate(() => (document.querySelector('input[type=email]') as HTMLInputElement || {}).value = '')
        requireOriginForCredentials(page)
        try { await page.type('input[type=email]', MS_TEAMS_CREDENTIALS_LOGIN!, { delay: 20 }) } catch (e) { }
        requireOriginForCredentials(page)
        try { await page.type('input[type=text]', MS_TEAMS_CREDENTIALS_LOGIN!, { delay: 20 }) } catch (e) { }
        requireOriginForCredentials(page)
        await page.type('input[type=password]', MS_TEAMS_CREDENTIALS_PASSWORD!, { delay: 20 })
        await page.keyboard.press('Enter', { delay: 100 })
        await page.waitForSelector('input[type=submit]', { hidden: true })
        await page.waitForSelector('input[type=submit]', { timeout: 20_000 })
        requireOriginForCredentials(page)
        await page.click('input[type=submit]')
        await sleep(10_000)
    }

    await page.goto(url, { waitUntil: "domcontentloaded" })
    await sleep(3_000)

    try {
        await page.waitForSelector('button[type=button].icons-call-jump-in', { timeout: 20_000 })
    } catch (e) {
        console.warn('Failed to find join button, trying loading page again');

        await page.goto('about:blank', { waitUntil: 'domcontentloaded' })
        await sleep(500)
        await page.goto(url, { waitUntil: "domcontentloaded" })

        // await page.click('.btn-group.app-tabs-list-item:not(.app-tabs-selected)')
        // await sleep(2000)
        // await page.click('.btn-group.app-tabs-list-item:not(.app-tabs-selected)')
        // await sleep(2000)
        // await page.click('.start-meetup')
        // await sleep(5000)
        // await page.waitForSelector('#leave-calling-pre-join')
        // await page.click('#leave-calling-pre-join')
        // page.screenshot({ path: '/recordings/debug2.png', })

        await page.waitForSelector('button[type=button].icons-call-jump-in', { timeout: 20_000 })
    }
    await page.click('button[type=button].icons-call-jump-in')

    await page.waitForSelector('button[type=button].join-btn', { timeout: 10_000 })
    await page.click('button[type=button].join-btn')

    try {
        await page.waitForSelector('button[type=button].join-btn', { timeout: 10_000, hidden: true })
    } catch (e) {
        await page.click('button[type=button].join-btn')
    }

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