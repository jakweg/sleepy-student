import { spawnSync } from 'child_process';
import { ActivityType } from 'discord.js';
import * as dotenv from 'dotenv';
import { launch as launchBrowser } from './browser';
import { addStateListener, setCurrentState } from './current-state';
import { launch as launchDiscord } from './discord';
dotenv.config()

try { spawnSync('pulseaudio', ['-D']) } catch (e) { void e }

const browser = await launchBrowser()
const ds = await launchDiscord()

addStateListener(state => {
    if (state.type === 'recording-webex')
        ds.user?.setActivity({ name: 'Recording session for You', type: ActivityType.Watching })
    else
        ds.user?.setActivity(undefined)
})

addStateListener(state => {
    console.log('changed state to', state.type);
})

setCurrentState({
    type: 'idle',
    page: (await browser.pages())[0] ?? await browser.newPage(),
})