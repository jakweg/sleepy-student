import * as puppeteer from 'puppeteer';
import { ScheduledRecording } from './db';

export interface RecordingStartOptions {
    sessionId: string
    url: string
    showChat: boolean
    scheduled?: ScheduledRecording
}

export const defaultState = {
    type: 'idle' as 'idle' | 'preparing-for-webex-captcha' | 'waiting-for-solution-for-webex-captcha' | 'joining-webex' | 'recording-webex' | 'joining-teams' | 'recording-teams',
    page: (null as any) as puppeteer.Page,
    options: null as (RecordingStartOptions | null),
    stopRecordingButtonId: null as (string | null),
    stopRecordingCallback: (whenFinished: (name: string) => void) => { }
}

export type State = typeof defaultState