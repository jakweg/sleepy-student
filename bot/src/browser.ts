import * as puppeteer from 'puppeteer';
import { DEBUG, HEIGHT, WIDTH } from './config';

export const launch = async () => {
    return await puppeteer.launch({
        headless: !DEBUG,
        executablePath: DEBUG ? undefined : '/usr/bin/google-chrome-stable',
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