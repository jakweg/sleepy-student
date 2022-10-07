import * as puppeteer from 'puppeteer';
import { DEBUG, HEIGHT, WIDTH } from './config';

export const launch = async () => {
    return await puppeteer.launch({
        headless: false,
        executablePath: DEBUG ? undefined : '/usr/bin/google-chrome-stable',
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