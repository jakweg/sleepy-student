import * as puppeteer from 'puppeteer';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';

const RECORDINGS_PATH = '/recordings/'

const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
    defaultViewport: {
        width: 1280,
        height: 720,
    }
});
const page = (await browser.pages())[0] ?? await browser.newPage()

const recordPage = async (url: string) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    const recorder = new PuppeteerScreenRecorder(page, {
        followNewTab: false,
        fps: 60,
        ffmpeg_Path: null,
        videoFrame: {
            width: 1280,
            height: 720,
        },
        autopad: {
            color: 'black',
        },
        aspectRatio: '16:9',
    })

    await recorder.start(RECORDINGS_PATH + 'hello.mp4')

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
        await recorder.stop()
    }
    console.log('ok');

    await new Promise(resolve => setTimeout(resolve, 500000))

}
await recordPage('https://www.youtube.com/watch?v=Kf-fMjV7Tio')

await browser.close()