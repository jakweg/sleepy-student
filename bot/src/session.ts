import { Message } from 'discord.js';
import { rename, unlink } from 'fs/promises';
import { Page } from 'puppeteer';
import { AUDIO_BITRATE, FINAL_FILENAME_FORMAT, FRAMERATE, HEIGHT, RECORDINGS_PATH, VIDEO_CRF, WIDTH } from "./config";
import { ScheduledRecording } from "./db";
import { BROWSER, DISCORD } from "./main";
import messages from './messages';
import { spawn } from './process';
import { fileExists, sanitizeFileName, sleep } from './utils';

export interface RecordingState {
    status: 'running' | 'stopped' | 'ready'
    stopped?: { type: 'by', by: string } | { type: 'timeout', afterMinutes: number } | { type: 'meeting-closed', } | { type: 'lost-participants', }
    readyFilename?: string
    videoPath: string
    audioPath: string
    videoProcess: ReturnType<typeof spawn>
    audioProcess: ReturnType<typeof spawn>
}

export default class Session {
    private requestedStop: boolean = false
    private recording: RecordingState | null = null
    protected constructor(
        public readonly page: Page,
        public readonly sessionId: string,
        public readonly entry: ScheduledRecording,
        protected readonly message: Message) {
    }

    public static async createWithNewScheduledMessage(entry: ScheduledRecording): Promise<Session> {
        const channel = await DISCORD.channels.fetch(entry.channel)
        if (!channel.isTextBased())
            throw new Error('Channel is not text based')

        const page = await BROWSER.newPage()
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);

        const sessionId = `${Date.now()}`
        const message = await channel.send(messages.fromState(entry, sessionId, null))

        return new (entry.type === 'webex' ? WebexSession : Session)(page, sessionId, entry, message)
    }

    public isActive(): boolean {
        return !this.requestedStop
    }

    private _executingPromise: Promise<void> | null = null
    public async do(callback: () => Promise<void>) {
        if (this.requestedStop) return
        if (this._executingPromise !== null) {
            this._executingPromise.finally(() => this.do(callback))
            return
        }

        try {
            this._executingPromise = callback().finally(() => this._executingPromise = null)
            await this._executingPromise;
        } catch (e) {
            if (e.message !== 'Requested stop')
                throw e;
        }
    }

    private updateMessage() {
        this.message.edit(messages.fromState(this.entry, this.sessionId, this.recording)).catch(e => console.error('Failed to update message', e.message))
    }

    public setFatalErrorAndStop(message: string): void {
        if (this.requestedStop)
            return
        this.page.close({ runBeforeUnload: false }).catch(e => void (e))
        this.requestedStop = true
        this.message.edit(messages.fatalError(this.entry, message)).catch(e => void (e))
    }

    public assertActive(): void {
        if (this.requestedStop) {
            this.page.close({ runBeforeUnload: false }).catch(e => void (e))
            throw new Error('Requested stop')
        }
    }

    async startRecording(): Promise<void> {
        if (this.recording) return
        console.log('starting recording');

        const videoPath = `${RECORDINGS_PATH}/.current-video-${this.sessionId}.mp4`;
        const audioPath = `${RECORDINGS_PATH}/.current-audio-${this.sessionId}.m4a`;

        const audioRecording = spawn(['ffmpeg', '-f', 'pulse', '-i', 'auto_null.monitor', '-y', audioPath],)
        const videoRecording = spawn(['ffmpeg', '-f', 'x11grab', '-framerate', FRAMERATE, '-r', FRAMERATE, '-video_size', `${WIDTH}x${HEIGHT}`, '-i', ':1.0', '-c:v', 'libx264', '-preset', 'superfast', '-pix_fmt', 'yuv420p', '-y', videoPath],)

        this.recording = {
            status: 'running',
            videoPath, audioPath,
            audioProcess: audioRecording,
            videoProcess: videoRecording,
        }

        this.updateMessage()
    }

    private async internalStopRecording(newStatus: RecordingState['stopped']) {
        if (!this.recording || this.recording.status !== 'running') return
        console.log('stopping recording');

        this.requestedStop = true
        this.recording.status = 'stopped'
        this.recording.stopped = newStatus

        this.updateMessage()

        this.recording.audioProcess.kill(15)
        this.recording.videoProcess.kill(15)

        await sleep(100)
        await this.page.close({ runBeforeUnload: false }).catch(e => void (e))

        const TEMPORARY_MERGED_PATH = `${RECORDINGS_PATH}/.merged-${this.sessionId}.mp4`

        await sleep(2000);
        const merger = spawn(['ffmpeg',
            '-r', FRAMERATE,
            '-i', this.recording.videoPath,
            '-i', this.recording.audioPath,
            '-c:v', 'libx264',
            '-crf', VIDEO_CRF,
            '-c:a', 'aac',
            '-abr', '1',
            '-b:a', `${AUDIO_BITRATE}k`,
            '-ac', '1',
            TEMPORARY_MERGED_PATH, '-y',])

        merger.once('close', async () => {
            const suggestedSaveName = this.entry.name ? this.entry.name : `unnamed-${this.entry.type}`
            const entry = this.entry
            const date = new Date(entry.timestamp)
            const sanitized = sanitizeFileName(FINAL_FILENAME_FORMAT
                .replace('%year%', `${date.getFullYear()}`)
                .replace('%month%', `${(date.getMonth() + 1 < 10 ? '0' : '') + (date.getMonth() + 1)}`)
                .replace('%day%', `${(date.getDate() < 10 ? '0' : '') + date.getDate()}`)
                .replace('%hour%', `${(date.getHours() < 10 ? '0' : '') + date.getHours()}`)
                .replace('%minute%', `${(date.getMinutes() < 10 ? '0' : '') + date.getMinutes()}`)
                .replace('%name%', suggestedSaveName)
            );
            let name = `${sanitized}.mp4`

            if (await fileExists(`${RECORDINGS_PATH}/${name}`)) {
                let i = 1
                while (true) {
                    name = `${sanitized}_${i}.mp4`
                    if (!await fileExists(`${RECORDINGS_PATH}/${name}`))
                        break
                    i++
                }
            }

            const FINAL_PATH = `${RECORDINGS_PATH}/${name}`
            await rename(TEMPORARY_MERGED_PATH, FINAL_PATH)

            console.log('recording merged!', FINAL_PATH);

            this.recording.status = 'ready'
            this.recording.readyFilename = name

            this.updateMessage()
            await Promise.all([unlink(this.recording.videoPath), unlink(this.recording.audioPath)])
        })
    }

    public setRecordingTimeout(minutes: number): void {
        sleep(minutes * 60 * 1000)
            .then(async () => {
                try {
                    this.assertActive()

                    this.internalStopRecording({ type: 'timeout', afterMinutes: minutes })
                } catch (e) { }
            },);
    }


    public async addMeetingClosedMonitor(checker: (page: Page) => Promise<'closed' | 'lost-participants' | null>): Promise<void> {
        try {
            while (true) {
                this.assertActive()

                const result = await checker(this.page)
                if (result === 'closed') {
                    this.internalStopRecording({ type: 'meeting-closed' })
                    break
                } else if (result === 'lost-participants') {
                    this.internalStopRecording({ type: 'lost-participants' })
                    break
                }

                await sleep(500)
            }
        } catch (e) {
            void (e)
        }
    }

    public stopRecordingByUser(userId: string): void {
        this.internalStopRecording({ type: 'by', by: userId })
    }
}

export class WebexSession extends Session {
    private _isWaitingForCaptcha: boolean = false

    public enableWaitingForCaptcha(imageData: Buffer): void {
        this._isWaitingForCaptcha = true
        this.message.reply(messages.captcha(this.sessionId, imageData))
    }

    public isWaitingForCaptcha(): boolean {
        return this._isWaitingForCaptcha
    }

    public disableWaitingForCaptcha(): void {
        this._isWaitingForCaptcha = false
    }
}