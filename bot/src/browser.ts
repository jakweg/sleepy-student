import * as puppeteer from 'puppeteer';
import { HEIGHT, WIDTH } from './config';

export const launch = async () => {
    return await puppeteer.launch({
        headless: true,
        executablePath: '/usr/bin/google-chrome-stable',
        product: 'chrome',
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
}