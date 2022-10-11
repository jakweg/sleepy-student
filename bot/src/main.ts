import { spawn as nodeSpawn, spawnSync } from 'child_process';
import { ActivityType } from 'discord.js';
import { unlink } from 'fs/promises';
import process from 'process';
import { launch as launchBrowser } from './browser';
import { HEIGHT, WIDTH } from './config';
import { addStateListener, updateState } from './current-state';
import { launch as launchDiscord } from './discord-stuff';
import { spawn } from './process';
import { initScheduler } from './scheduler';
import { sleep } from './utils';

try { spawnSync('pulseaudio', ['-k'], { stdio: 'ignore' }) } catch (e) { void e }
spawn(['pulseaudio'])

try {
    try {
        await unlink('/tmp/.X1-lock')
    } catch (_) { }
    const displayProcess = nodeSpawn('Xvfb', [':1', '-screen', '0', `${WIDTH}x${HEIGHT}x16`], { stdio: 'inherit' })
    process.addListener('exit', () => {
        displayProcess.kill(15)
        unlink('/tmp/.X1-lock')
    })
} catch (e) {
}

await sleep(500)

const browser = await launchBrowser()
export const DISCORD = await launchDiscord()

addStateListener(state => {
    if (state.type === 'recording-webex' || state.type === 'recording-teams')
        DISCORD.user?.setActivity({ name: 'Recording session for You', type: ActivityType.Watching })
    else
        DISCORD.user?.setActivity(undefined)
})

addStateListener(state => {
    console.log('changed state to', state.type);
})

updateState({
    page: (await browser.pages())[0] ?? await browser.newPage(),
})

initScheduler()