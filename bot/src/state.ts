import * as puppeteer from 'puppeteer';

export interface RecordingStartOptions {
    sessionId: string
    url: string
    showChat: boolean
}

export const defaultState = {
    type: 'idle' as 'idle' | 'preparing-for-webex-captcha' | 'waiting-for-solution-for-webex-captcha' | 'joining-webex' | 'recording-webex' | 'joining-teams' | 'recording-teams',
    page: (null as any) as puppeteer.Page,
    options: null as (RecordingStartOptions | null),
    stopRecordingCallback: (whenFinished: (name: string) => void) => { }
}

export type State = typeof defaultState