import { stat } from 'fs/promises';
import * as puppeteer from 'puppeteer';
import { HEIGHT, WIDTH } from './config';

export const launch = async () => {
    let browserPath: string | undefined = '/usr/bin/google-chrome-stable'
    try {
        if (!(await stat(browserPath)).isFile())
            browserPath = undefined
    } catch (_) {
        browserPath = undefined
    }
    return await puppeteer.launch({
        headless: false,
        executablePath: browserPath,
        product: 'chrome',
        defaultViewport: null,
        ignoreDefaultArgs: [
            "--mute-audio",
            '--enable-automation',
        ],
        env: {
            'DISPLAY': ':1',
        },
        args: [
            '--kiosk',
            '--disable-remote-fonts',
            '--start-maximized',
            '--start-fullscreen',
            '--disable-infobars',
            `--window-size=${WIDTH},${HEIGHT}`,
            '--no-sandbox',
            "--autoplay-policy=no-user-gesture-required",
        ].filter(e => typeof e === 'string') as string[],
    });
}