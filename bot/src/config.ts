import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
dotenv.config()

export const ENVIRONMENT = (process.env.ENVIRONMENT?.toLowerCase()) || 'unset'
export const DEBUG = ENVIRONMENT === 'dev'
export const RECORDINGS_PATH = process.env.RECORDINGS_PATH || '/recordings'
export const WIDTH = parseInt(process.env.WIDTH!, 10) || 1280
export const HEIGHT = parseInt(process.env.HEIGHT!, 10) || 720
export const ALLOWED_CHANNELS = Object.freeze((process.env.ALLOWED_CHANNELS || '').split(',').map(e => e.trim()))
export const RECORDING_READY_MESSAGE_FORMAT = process.env.RECORDING_READY_MESSAGE_FORMAT || 'Recording ready %name%'
export const MS_TEAMS_CREDENTIALS_LOGIN = process.env.MS_TEAMS_CREDENTIALS_LOGIN
export const MS_TEAMS_CREDENTIALS_PASSWORD = process.env.MS_TEAMS_CREDENTIALS_PASSWORD

console.log(`Using config:
    ENVIRONMENT=${ENVIRONMENT}
    RECORDINGS_PATH=${RECORDINGS_PATH}
    WIDTH=${WIDTH}
    HEIGHT=${HEIGHT}
    ALLOWED_CHANNELS=${ALLOWED_CHANNELS}
    RECORDING_READY_MESSAGE_FORMAT=${RECORDING_READY_MESSAGE_FORMAT}
    MS_TEAMS_CREDENTIALS_LOGIN=${MS_TEAMS_CREDENTIALS_LOGIN}
    MS_TEAMS_CREDENTIALS_PASSWORD=${MS_TEAMS_CREDENTIALS_PASSWORD ? '*preset*' : '*none*'}
`);

if (ENVIRONMENT !== 'production' && ENVIRONMENT !== 'dev') {
    throw new Error(ENVIRONMENT === 'unset' ? 'Missing valid .env configuration' : 'invalid environment')
}

await fs.writeFile(`${RECORDINGS_PATH}/access-test`, '')
await fs.unlink(`${RECORDINGS_PATH}/access-test`)
