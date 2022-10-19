import { Page } from "puppeteer"
import { RECORDINGS_PATH, WEBEX_MAIL, WEBEX_NAME } from "./config"
import Session from "./session"
import { sleep } from "./utils"

export const createWebexSession = async (page: Page, url: string): Promise<{ captchaImage: Buffer | 'not-needed' }> => {
    url = url.replace('launchApp=true', '')
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36')
    await page.browserContext().overridePermissions(url, ['microphone', 'camera'])
    await page.goto(url, { waitUntil: 'domcontentloaded' })

    try {
        await page.waitForSelector('#push_download_join_by_browser', { timeout: 2000 })
        await page.click('#push_download_join_by_browser')
    } catch (e) {
    }

    const getCaptchaImage = async (): Promise<Buffer | 'not-needed'> => {
        for (let i = 0; i < 10; ++i) {
            const img = (await Promise.all((page.frames()).map(e => e.$('#verificationImage')))).find(e => e)
            if (img) {
                await sleep(1000);
                return await img.screenshot({ captureBeyondViewport: true, type: 'png' }) as Buffer
            }

            const nameInput = (await Promise.all((page.frames()).map(e => e.$('[placeholder="Email address"]')))).find(e => e)
            if (nameInput)
                return 'not-needed'

            await sleep(1000);
        }
        await page.screenshot({ captureBeyondViewport: true, path: `${RECORDINGS_PATH}/debug.png` })
        throw new Error('Failed to get verification image')
    }

    await sleep(1000)
    const buffer = await getCaptchaImage()
    return { captchaImage: buffer }
}

export const randomizeLettersCase = (text: string, upperProbability: number = 0.2) => {
    return text.split('').map(e => Math.random() < upperProbability ? e.toLocaleUpperCase() : e.toLocaleLowerCase()).join('')
}

export const fillCaptchaAndJoin = async (session: Session, captcha: string | null,) => {
    session.assertActive()
    const page = session.page
    let frameIndex = (await Promise.all(page.frames().map(e => e.$('#guest_next-btn')))).findIndex(e => e)
    let frame = page.frames()[frameIndex]
    if (!frame) throw new Error('missing inputs frame')

    session.assertActive()
    const results = await frame.$$('#meetingSimpleContainer input')
    if (!results) throw new Error('missing inputs')

    await page.focus('body')
    await sleep(300)
    const [name, mail, characters] = results
    await name.evaluate(element => (element as any).value = '')
    await name.click({ clickCount: 3 });
    await name.press('Backspace');
    for (const c of randomizeLettersCase(WEBEX_NAME)) {
        await sleep(Math.random() * 300 + 300)
        await name.type(c)
    }

    session.assertActive()
    await sleep(Math.random() * 500 + 100)
    await mail.evaluate(element => (element as any).value = '')
    await mail.click({ clickCount: 3 });
    await mail.press('Backspace');

    for (const c of WEBEX_MAIL) {
        await sleep(Math.random() * 300 + 300)
        await mail.type(c)
    }

    if (characters && captcha) {
        await characters.evaluate(element => (element as any).value = '')
        await characters.click({ clickCount: 3 });
        await characters.press('Backspace');
        await sleep(Math.random() * 500 + 100)
        for (const c of captcha) {
            await sleep(Math.random() * 300 + 300)
            await characters.type(c)
        }
    }
    await sleep(300)
    session.assertActive()
    await frame.click('#guest_next-btn')

    for (let i = 0; i < 20; ++i) {
        frameIndex = (await Promise.all(page.frames().map(e => e.$('[data-doi="MEETING:JOIN_MEETING:MEETSIMPLE_INTERSTITIAL"]')))).findIndex(e => e)
        frame = page.frames()[frameIndex]
        if (frame) break
        await sleep(1000)
    }
    session.assertActive()
    if (!frame) throw new Error('missing join button')
    await sleep(1000)
    try { await frame.click('[data-doi="VIDEO:STOP_VIDEO:MEETSIMPLE_INTERSTITIAL"]'); await sleep(500) } catch (e) { }
    await frame.click('[data-doi="MEETING:JOIN_MEETING:MEETSIMPLE_INTERSTITIAL"]'); await sleep(500)
    session.assertActive()
    try { await frame.click('[data-doi="VIDEO:JOIN_MEETING:MEETSIMPLE_INTERSTITIAL"]'); } catch (e) { }

    const waitToBeJoined = async () => {
        while (true) {
            const isMeetHidden = await frame.evaluate(() => document.getElementById('meetsimple')?.style?.display === 'none')
            if (isMeetHidden)
                return

            session.assertActive()
            await sleep(1000)
        }
    }

    await waitToBeJoined()

    session.assertActive()
    try { await frame.click('[data-doi="AUDIO:MUTE_SELF:MEETSIMPLE_INTERSTITIAL"]'); } catch (e) { }
    try { await frame.click('[data-doi="AUDIO:UNMUTE_SELF:MENU_CONTROL_BAR"]'); } catch (e) { }

    frame.waitForSelector('[title="Got it"]', { timeout: 5000 })
        .then(() => frame.click('[title="Got it"]'))
        .catch(e => void (e))

    sleep(6000)
        .then(() => frame.waitForSelector('[title="Got it"]', { timeout: 0 }))
        .then(() => frame.click('[title="Got it"]'))
        .catch(e => void (e))

    sleep(7000)
        .then(() => frame.waitForSelector('[data-doi="AUDIO:UNMUTE_SELF:MENU_CONTROL_BAR"]', { timeout: 10000 }))
        .then(() => frame.click('[data-doi="AUDIO:UNMUTE_SELF:MENU_CONTROL_BAR"]'))
        .catch(e => void (e))


    sleep(5000)
        .then(() => frame.waitForSelector('[data-doi="LAYOUT:GOT_IT:DIALOG_LAYOUT_FTE"]', { timeout: 0 }))
        .then(() => frame.click('[data-doi="LAYOUT:GOT_IT:DIALOG_LAYOUT_FTE"]'))
        .then(() => sleep(5000))
        .then(() => frame.waitForSelector('[data-doi="LAYOUT:GOT_IT:DIALOG_LAYOUT_FTE"]', { timeout: 0 }))
        .then(() => frame.click('[data-doi="LAYOUT:GOT_IT:DIALOG_LAYOUT_FTE"]'))
        .then(() => sleep(5000))
        .then(() => frame.waitForSelector('[data-doi="LAYOUT:GOT_IT:DIALOG_LAYOUT_FTE"]', { timeout: 0 }))
        .then(() => frame.click('[data-doi="LAYOUT:GOT_IT:DIALOG_LAYOUT_FTE"]'))
        .catch(e => void (e))

    sleep(10000)
        .then(() => frame.waitForSelector('[aria-label*="close"]', { timeout: 5000 }))
        .then(() => frame.click('[aria-label*="close"]'))
        .catch(e => void (e))

    // frame.waitForSelector('[data-doi="CHAT:OPEN_CHAT_PANEL:MENU_CONTROL_BAR"]', { timeout: 5000 })
    //     .then(() => sleep(1000))
    //     .then(() => frame.click('[data-doi="CHAT:OPEN_CHAT_PANEL:MENU_CONTROL_BAR"]'))
    //     .catch(e => void (e))

    return {
        isMeetingStopped: async () => !!(await frame.$('[aria-label="The meeting has ended."]')),
    }
}
