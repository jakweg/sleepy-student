import { spawn } from 'child_process'
import { unlink } from 'fs/promises'
import { Page } from "puppeteer"
import { PuppeteerScreenRecorder } from "puppeteer-screen-recorder"
import { HEIGHT, RECORDINGS_PATH, WIDTH } from "./config"
import { sleep } from "./utils"

export const createWebexSession = async (page: Page, url: string) => {
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36')
    await page.browserContext().overridePermissions(url, ['microphone', 'camera'])
    await page.goto(url, { waitUntil: 'domcontentloaded' })

    try {
        await page.waitForSelector('#push_download_join_by_browser')
        await page.click('#push_download_join_by_browser')
    } catch (e) {
    }

    const getCaptchaImage = async () => {
        for (let i = 0; i < 10; ++i) {
            const img = (await Promise.all((page.frames()).map(e => e.$('#verificationImage')))).find(e => e)
            if (img) return await img.screenshot({ captureBeyondViewport: true, type: 'png' })
            await sleep(1000)
        } throw new Error('Failed to get verification image')
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
    const [name, _, characters] = results
    for (const c of 'Andrzej') {
        await sleep(Math.random() * 300 + 300)
        await name.type(c)
    }

    await sleep(Math.random() * 500 + 500)
    for (const c of captcha) {
        await sleep(Math.random() * 300 + 300)
        await characters.type(c)
    }
    await sleep(1000)
    await frame.click('#guest_next-btn')

    await sleep(5000)

    frameIndex = (await Promise.all(page.frames().map(e => e.$('[data-doi="MEETING:JOIN_MEETING:MEETSIMPLE_INTERSTITIAL"]')))).findIndex(e => e)
    frame = page.frames()[frameIndex]
    if (!frame) throw new Error('missing join button')
    try { await frame.click('[data-doi="AUDIO:MUTE_SELF:MEETSIMPLE_INTERSTITIAL"]'); await sleep(500) } catch (e) { }
    try { await frame.click('[data-doi="VIDEO:STOP_VIDEO:MEETSIMPLE_INTERSTITIAL"]'); await sleep(500) } catch (e) { }
    await sleep(1000)
    await frame.click('[data-doi="MEETING:JOIN_MEETING:MEETSIMPLE_INTERSTITIAL"]'); await sleep(500)
    try { await frame.click('[data-doi="VIDEO:JOIN_MEETING:MEETSIMPLE_INTERSTITIAL"]'); } catch (e) { }

    const waitToBeJoined = async () => {
        for (let i = 0; i < 120; ++i) {
            if (await frame.$('[data-doi="PARTICIPANT:OPEN_PARTICIPANT_PANEL:MENU_CONTROL_BAR"]')) {
                await sleep(1000)
                return
            }
            await sleep(1000)
        }
        throw new Error('timeout waitToBeJoined')
    }

    await waitToBeJoined()

    try {
        await frame.waitForSelector('[title="Got it"]')
        await frame.click('[title="Got it"]')
    } catch (e) {
    }

    const recorder = new PuppeteerScreenRecorder(page, {
        followNewTab: false,
        fps: 60,
        ffmpeg_Path: null,
        videoFrame: {
            width: WIDTH,
            height: HEIGHT,
        },
        autopad: {
            color: 'black',
        },
        aspectRatio: '16:9',
    })

    console.log('starting recording');

    const VIDEO_PATH = `${RECORDINGS_PATH}/current-video-${sessionId}.mp4`;
    const AUDIO_PATH = `${RECORDINGS_PATH}/current-audio-${sessionId}.m4a`;

    await recorder.start(VIDEO_PATH)
    const audioRecording = spawn('ffmpeg', ['-f', 'pulse', '-i', 'auto_null.monitor', '-y', AUDIO_PATH])

    const recordingStopper = async () => {
        audioRecording.kill(15)
        await recorder.stop()

        const FINAL_PATH = `${RECORDINGS_PATH}/combined-${new Date().toJSON().replace(':', '-')}.mp4`

        const merger = spawn('ffmpeg', ['-i',
            VIDEO_PATH, '-i', AUDIO_PATH,
            '-c:v', 'copy',
            '-c:a', 'aac',
            FINAL_PATH, '-y',])

        merger.once('close', async () => {
            console.log('recording merged!', FINAL_PATH);
            await unlink(VIDEO_PATH)
            await unlink(AUDIO_PATH)
        })
        await page.goto('https://example.com', { waitUntil: 'networkidle2' })
    }

    return {
        recordingStopper,
    }
}
