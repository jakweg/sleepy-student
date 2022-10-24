import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
dotenv.config()

export const RECORDINGS_PATH = process.env.RECORDINGS_PATH || '/recordings'
export const DB_PATH = process.env.DB_PATH || '/persistent/db.json'
export const TIME_ZONE = process.env.TIME_ZONE || 'GMT'
export const LANGUAGE = process.env.LANGUAGE || 'en-US'
export const WIDTH = parseInt(process.env.WIDTH!, 10) || 1280
export const HEIGHT = parseInt(process.env.HEIGHT!, 10) || 720
export const FINAL_FILENAME_FORMAT = process.env.FILENAME_FORMAT || '%name%-%month%-%day%'
export const VIDEO_CRF = `${parseInt(process.env.VIDEO_CRF!, 10) || 38}`
export const AUDIO_BITRATE = `${parseInt(process.env.AUDIO_BITRATE!, 10) || 32}`
export const FRAMERATE = `${parseInt(process.env.FRAMERATE!, 10) || 4}`
export const SCHEDULER_INTERVAL_MS = parseInt(process.env.SCHEDULER_INTERVAL_MS!, 10) || 60_000
export const ALLOWED_CHANNELS = Object.freeze((process.env.ALLOWED_CHANNELS || '').split(',').map(e => e.trim()))
export const WEBEX_NAME = process.env.WEBEX_NAME || 'Wojtek'
export const WEBEX_MAIL = process.env.WEBEX_MAIL || ''
export const RECORDING_READY_URL_FORMAT = process.env.RECORDING_READY_URL_FORMAT
export const MS_TEAMS_CREDENTIALS_LOGIN = process.env.TEAMS_EMAIL
export const MS_TEAMS_CREDENTIALS_PASSWORD = process.env.TEAMS_PASSWORD
export const MS_TEAMS_CREDENTIALS_ORIGINS = Object.freeze((process.env.TEAMS_ORIGINS || '').split(',').map(e => e.trim()))
export const MAX_MEETING_DURATION_MINUTES = (parseInt(process.env.MAX_MEETING_DURATION, 10) || 90)

process.env.TZ = TIME_ZONE

console.log(`Using config:
    TIME_ZONE=${TIME_ZONE}
    LANGUAGE=${LANGUAGE}
    WIDTH=${WIDTH}
    HEIGHT=${HEIGHT}
    CRF=${VIDEO_CRF}
    FRAMERATE=${FRAMERATE}
    AUDIO_BITRATE=${AUDIO_BITRATE}
    WEBEX_NAME=${WEBEX_NAME}
    WEBEX_MAIL=${WEBEX_MAIL}
    MAX_MEETING_DURATION_MINUTES=${MAX_MEETING_DURATION_MINUTES}
    ALLOWED_CHANNELS=${ALLOWED_CHANNELS}
    RECORDING_READY_URL_FORMAT=${RECORDING_READY_URL_FORMAT}
    MS_TEAMS_EMAIL=${MS_TEAMS_CREDENTIALS_LOGIN}
    MS_TEAMS_PASSWORD=${MS_TEAMS_CREDENTIALS_PASSWORD ? '*preset*' : '*none*'}
    MS_TEAMS_ORIGINS=${MS_TEAMS_CREDENTIALS_ORIGINS}
`);


try {
    await fs.writeFile(`${RECORDINGS_PATH}/access-test`, '')
    await fs.unlink(`${RECORDINGS_PATH}/access-test`)
} catch (e) {
    console.error('Access test to ', RECORDINGS_PATH, 'failed', e?.message)
    process.exit(1)
}