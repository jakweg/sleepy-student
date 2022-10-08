import { spawn, spawnSync } from 'child_process';
import { ActivityType } from 'discord.js';
import { launch as launchBrowser } from './browser';
import { HEIGHT, WIDTH } from './config';
import { addStateListener, updateState } from './current-state';
import { launch as launchDiscord } from './discord';
import { sleep } from './utils';

try { spawnSync('pulseaudio', ['-D']) } catch (e) { void e }
try { spawn('Xvfb', [':1', '-screen', '0', `${WIDTH}x${HEIGHT}x16`]) } catch (e) { void e }
await sleep(500)

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

updateState({
    page: (await browser.pages())[0] ?? await browser.newPage(),
})