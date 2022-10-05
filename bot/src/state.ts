import * as puppeteer from 'puppeteer';

export interface RecordingStartOptions {
    sessionId: string
    url: string
    showChat: boolean
}

export type State = { type: 'none' }
    | {
        type: 'idle'
        page: puppeteer.Page
    } | {
        type: 'preparing-for-webex-captcha'
        options: RecordingStartOptions
        page: puppeteer.Page
    } | {
        type: 'waiting-for-solution-for-webex-captcha'
        options: RecordingStartOptions
        page: puppeteer.Page
    } | {
        type: 'joining-webex'
        options: RecordingStartOptions
        page: puppeteer.Page
    } | {
        type: 'recording-webex'
        options: RecordingStartOptions
        page: puppeteer.Page
        stopCallback: (callback: (name: string) => void) => void
    }