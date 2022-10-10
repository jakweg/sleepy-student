import { spawn } from 'child_process';
import { unlink } from 'fs/promises';
import { Page } from "puppeteer";
import { HEIGHT, RECORDINGS_PATH, WIDTH } from "./config";
import { currentState, updateState } from './current-state';
import { DISCORD } from './main';
import { sleep } from './utils';

export const startRecording = async (page: Page, sessionId: string) => {

    console.log('starting recording');

    const VIDEO_PATH = `${RECORDINGS_PATH}/current-video-${sessionId}.mp4`;
    const AUDIO_PATH = `${RECORDINGS_PATH}/current-audio-${sessionId}.m4a`;

    const stdio = 'ignore'
    const audioRecording = spawn('ffmpeg', ['-f', 'pulse', '-i', 'auto_null.monitor', '-y', AUDIO_PATH], { stdio })
    const videoRecording = spawn('ffmpeg', ['-f', 'x11grab', '-framerate', '4', '-r', '4', '-video_size', `${WIDTH}x${HEIGHT}`, '-i', ':1.0', '-c:v', 'libx264', '-preset', 'superfast', '-pix_fmt', 'yuv420p', '-y', VIDEO_PATH], { stdio })

    return {
        stop: async (notifyWhenRecordingReact: (name: string) => void) => {
            console.log('stopping recording');

            page.once('dialog', e => e.accept())
            await page.goto('about:blank', { waitUntil: 'networkidle2' })

            audioRecording.kill(15)
            videoRecording.kill(15)

            const name = `combined-${new Date().toJSON().replace(/\:/g, '-')}.mp4`
            const FINAL_PATH = `${RECORDINGS_PATH}/${name}`

            await sleep(1000);
            const merger = spawn('ffmpeg', [
                '-r', '4',
                '-i', VIDEO_PATH,
                '-i', AUDIO_PATH,
                '-c:v', 'libx265',
                '-crf', '38',
                FINAL_PATH, '-y',], { stdio })

            merger.once('close', async () => {
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