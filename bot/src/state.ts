import * as puppeteer from 'puppeteer';

export type State = { type: 'none' }
    | {
        type: 'idle'
        page: puppeteer.Page
    } | {
        type: 'preparing-for-webex-captcha'
        sessionId: string
        page: puppeteer.Page
    } | {
        type: 'waiting-for-solution-for-webex-captcha'
        sessionId: string
        page: puppeteer.Page
    } | {
        type: 'joining-webex'
        sessionId: string
        page: puppeteer.Page
    } | {
        type: 'recording-webex'
        sessionId: string
        page: puppeteer.Page
        stopCallback: () => void
    }