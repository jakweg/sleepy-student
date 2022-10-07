import { spawn } from 'child_process';
import { unlink } from "fs/promises";
import { Page } from "puppeteer";
import { HEIGHT, RECORDINGS_PATH, WIDTH } from "./config";
import { sleep } from './utils';

export const startRecording = async (page: Page, sessionId: string) => {

    console.log('starting recording');

    const VIDEO_PATH = `${RECORDINGS_PATH}/current-video-${sessionId}.mp4`;
    const AUDIO_PATH = `${RECORDINGS_PATH}/current-audio-${sessionId}.m4a`;

    // await recorder.start(VIDEO_PATH)
    const audioRecording = spawn('ffmpeg', ['-f', 'pulse', '-i', 'auto_null.monitor', '-y', AUDIO_PATH])
    const videoRecording = spawn('ffmpeg', ['-f', 'x11grab', '-framerate', '4', '-r', '4', '-video_size', `${WIDTH}x${HEIGHT}`, '-i', ':1.0', '-c:v', 'libx264', '-preset', 'superfast', '-pix_fmt', 'yuv420p', '-y', VIDEO_PATH])

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
                FINAL_PATH, '-y',])

            merger.once('close', async () => {
                console.log('recording merged!', FINAL_PATH);

                notifyWhenRecordingReact(name)
                await Promise.all([unlink(VIDEO_PATH), unlink(AUDIO_PATH)])
            })
        }
    }
}