import { rename, stat, unlink } from 'fs/promises';
import { Page } from "puppeteer";
import { HEIGHT, RECORDINGS_PATH, WIDTH } from "./config";
import { currentState, updateState } from './current-state';
import { DISCORD } from './main';
import { spawn } from './process';
import { sleep } from './utils';

const ALLOWED_CHARS_IN_FILE_NAME = new Set('qwertyuiopasdfghjklzxcvbnmąśęółźćńĘÓŁĄŚŻŹĆŃQWERTYUIOPASDFGHJKLZXCVBNM1234567890.-'.split(''))
const REPLACEMENT_CHARACTER = '_'
const sanitizeFileName = (name: string) => [...name].map(e => ALLOWED_CHARS_IN_FILE_NAME.has(e) ? e : REPLACEMENT_CHARACTER).join('')

const fileExists = (name: string) => stat(name).then(() => true).catch(() => false)

export const startRecording = async (page: Page, sessionId: string, suggestedSaveName: string,) => {

    console.log('starting recording');

    const VIDEO_PATH = `${RECORDINGS_PATH}/.current-video-${sessionId}.mp4`;
    const AUDIO_PATH = `${RECORDINGS_PATH}/.current-audio-${sessionId}.m4a`;

    const audioRecording = spawn(['ffmpeg', '-f', 'pulse', '-i', 'auto_null.monitor', '-y', AUDIO_PATH],)
    const videoRecording = spawn(['ffmpeg', '-f', 'x11grab', '-framerate', '4', '-r', '4', '-video_size', `${WIDTH}x${HEIGHT}`, '-i', ':1.0', '-c:v', 'libx264', '-preset', 'superfast', '-pix_fmt', 'yuv420p', '-y', VIDEO_PATH],)

    return {
        stop: async (notifyWhenRecordingReact: (name: string) => void) => {
            console.log('stopping recording');

            page.once('dialog', e => e.accept())
            await page.goto('about:blank', { waitUntil: 'networkidle2' })

            audioRecording.kill(15)
            videoRecording.kill(15)

            const TEMPORARY_MERGED_PATH = `${RECORDINGS_PATH}/.merged-${sessionId}.mp4`

            await sleep(1000);
            const merger = spawn(['ffmpeg',
                '-r', '4',
                '-i', VIDEO_PATH,
                '-i', AUDIO_PATH,
                '-c:v', 'libx264',
                '-crf', '38',
                TEMPORARY_MERGED_PATH, '-y',])

            merger.once('close', async () => {
                const sanitized = sanitizeFileName(suggestedSaveName);
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

                notifyWhenRecordingReact(name)
                await Promise.all([unlink(VIDEO_PATH), unlink(AUDIO_PATH)])
            })
        }
    }
}

export const stopRecording = async (done: (name: string) => void) => {
    if (currentState.type !== 'recording-teams' && currentState.type !== 'recording-webex')
        return

    if (currentState.stopRecordingButtonId) {
        const channel = await DISCORD.channels.fetch(currentState.stopRecordingButtonId[0])
        if (channel?.isTextBased())
            channel.messages.edit(currentState.stopRecordingButtonId[1], {
                content: 'Scheduled recording started and then stopped',
                components: [],
            }).catch(e => void (e))
    }

    const stopCallback = currentState.stopRecordingCallback
    updateState({
        type: "idle",
        stopRecordingCallback: () => { }
    })


    stopCallback(async name => {
        done(name)
    })
}