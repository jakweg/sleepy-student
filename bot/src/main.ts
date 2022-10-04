import { spawnSync } from 'child_process';
import * as puppeteer from 'puppeteer';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration))

try { spawnSync('pulseaudio', ['-D']) } catch (e) { void e }
await sleep(1000)

const RECORDINGS_PATH = '/recordings/'
const WIDTH = 1920
const HEIGHT = 1080

const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: {
        width: WIDTH,
        height: HEIGHT,
    },
    ignoreDefaultArgs: [
        "--mute-audio",
    ],
    args: [
        '--no-sandbox',
        "--autoplay-policy=no-user-gesture-required",
    ],
});
const page = (await browser.pages())[0] ?? await browser.newPage()

const recordPage = async (url: string) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
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

    // await recorder.start(RECORDINGS_PATH + 'hello.mp4')
    // const audioRecording = spawn('ffmpeg', ['-f', 'pulse', '-i', 'auto_null.monitor', '-y', RECORDINGS_PATH + '/current-audio.m4a'])

    try {
        await new Promise(resolve => setTimeout(resolve, 1_000))
        await page.evaluate(async () => {
            for (let i = 0; i < 10; ++i) {
                const btn = [...document.querySelectorAll('a')].filter(e => (e as HTMLAnchorElement)?.textContent?.includes('Reject all'))[0] as HTMLAnchorElement
                if (btn) {
                    btn.click()
                    break
                }
                await new Promise(resolve => setTimeout(resolve, 1_000))
            }
        })

        await new Promise(resolve => setTimeout(resolve, 5000))

    } finally {
        // await recorder.stop()
        // audioRecording.kill(15)
    }
    console.log('ok');

    await new Promise(resolve => setTimeout(resolve, 500000))

}
await recordPage('https://meet231.webex.com/meet/pr27415595744')

await browser.close()