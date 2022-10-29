import { spawn as nodeSpawn, spawnSync } from 'child_process';
import { unlink, writeFile } from 'fs/promises';
import process from 'process';
import { launch as launchBrowser } from './browser';
import { HEIGHT, WIDTH } from './config';
import { launch as launchDiscord } from './discord-stuff';
import { spawn } from './process';
import { initScheduler } from './scheduler';
import { sleep } from './utils';

try { spawnSync('rm', ['/run/pulse', '-rf'], { stdio: 'ignore' }) } catch (e) { void e }
try { spawnSync('rm', ['/tmp/pulse-*', '-rf'], { stdio: 'ignore' }) } catch (e) { void e }
await writeFile('/etc/pulse/daemon.conf', 'use-pid-file=no')
try { spawnSync('pulseaudio', ['-k'], { stdio: 'ignore' }) } catch (e) { void e }
spawn(['pulseaudio', '-D'])

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

export const [BROWSER, DISCORD] = await Promise.all([launchBrowser(), launchDiscord()])

initScheduler()