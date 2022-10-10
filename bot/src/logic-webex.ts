import { Page } from "puppeteer"
import { RECORDINGS_PATH, WEBEX_MAIL } from "./config"
import { currentState } from "./current-state"
import { startRecording } from './recorder'
import { sleep } from "./utils"

export const createWebexSession = async (page: Page, url: string) => {
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36')
    await page.browserContext().overridePermissions(url, ['microphone', 'camera'])
    await page.goto(url, { waitUntil: 'domcontentloaded' })

    try {
        await page.waitForSelector('#push_download_join_by_browser', { timeout: 2000 })
        await page.click('#push_download_join_by_browser')
    } catch (e) {
    }

    const getCaptchaImage = async () => {
        for (let i = 0; i < 10; ++i) {
            const img = (await Promise.all((page.frames()).map(e => e.$('#verificationImage')))).find(e => e)
            if (img) {
                await sleep(1000);
                return await img.screenshot({ captureBeyondViewport: true, type: 'png' })
            }

            await sleep(1000);
        }
        await page.screenshot({ captureBeyondViewport: true, path: `${RECORDINGS_PATH}/debug.png` })
        throw new Error('Failed to get verification image')
    }

    await sleep(1000)
    const buffer = await getCaptchaImage()
    return { captchaImage: buffer }
}


export const fillCaptchaAndJoin = async (page: Page, captcha: string, sessionId: string) => {
    let frameIndex = (await Promise.all(page.frames().map(e => e.$('#guest_next-btn')))).findIndex(e => e)
    let frame = page.frames()[frameIndex]
    if (!frame) throw new Error('missing inputs frame')

    const results = await frame.$$('#meetingSimpleContainer input')
    if (!results) throw new Error('missing inputs')

    await page.focus('body')
    await sleep(1000)
    const [name, mail, characters] = results
    for (const c of 'Andrzej') {
        await sleep(Math.random() * 300 + 300)
        await name.type(c)
    }

    await sleep(Math.random() * 500 + 500)
    for (const c of WEBEX_MAIL) {
        await sleep(Math.random() * 300 + 300)
        await mail.type(c)
    }
    await sleep(Math.random() * 500 + 500)
    for (const c of captcha) {
        await sleep(Math.random() * 300 + 300)
        await characters.type(c)
    }
    await sleep(500)
    await frame.click('#guest_next-btn')

    for (let i = 0; i < 20; ++i) {
        frameIndex = (await Promise.all(page.frames().map(e => e.$('[data-doi="MEETING:JOIN_MEETING:MEETSIMPLE_INTERSTITIAL"]')))).findIndex(e => e)
        frame = page.frames()[frameIndex]
        if (frame) break
        await sleep(1000)
    }
    if (!frame) throw new Error('missing join button')
    await sleep(1000)
    try { await frame.click('[data-doi="AUDIO:MUTE_SELF:MEETSIMPLE_INTERSTITIAL"]'); await sleep(500) } catch (e) { }
    try { await frame.click('[data-doi="VIDEO:STOP_VIDEO:MEETSIMPLE_INTERSTITIAL"]'); await sleep(500) } catch (e) { }
    await frame.click('[data-doi="MEETING:JOIN_MEETING:MEETSIMPLE_INTERSTITIAL"]'); await sleep(500)
    try { await frame.click('[data-doi="VIDEO:JOIN_MEETING:MEETSIMPLE_INTERSTITIAL"]'); } catch (e) { }

    const waitToBeJoined = async () => {
        while (true) {
            const isMeetHidden = await frame.evaluate(() => document.getElementById('meetsimple')?.style?.display === 'none')
            if (isMeetHidden)
                return

            await sleep(1000)
        }
    }

    await waitToBeJoined()

    frame.waitForSelector('[title="Got it"]', { timeout: 5000 })
        .then(() => frame.click('[title="Got it"]'))
        .catch(e => void (e))


    sleep(5000)
        .then(() => frame.waitForSelector('[data-doi="LAYOUT:GOT_IT:DIALOG_LAYOUT_FTE"]', { timeout: 5000 }))
        .then(() => frame.click('[data-doi="LAYOUT:GOT_IT:DIALOG_LAYOUT_FTE"]'))
        .catch(e => void (e))

    if (currentState.type === 'joining-webex' && currentState.options?.showChat)
        frame.waitForSelector('[data-doi="CHAT:OPEN_CHAT_PANEL:MENU_CONTROL_BAR"]', { timeout: 5000 })
            .then(() => sleep(1000))
            .then(() => frame.click('[data-doi="CHAT:OPEN_CHAT_PANEL:MENU_CONTROL_BAR"]'))
            .catch(e => void (e))

    return {
        isMeetingStopped: async () => !!(await frame.$('[aria-label="The meeting has ended."]')),
        stop: await startRecording(page, sessionId)
    }
}
