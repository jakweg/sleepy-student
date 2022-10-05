import * as dotenv from 'dotenv';
dotenv.config()

export const RECORDINGS_PATH = process.env.RECORDINGS_PATH || '/recordings'
export const WIDTH = parseInt(process.env.WIDTH!, 10) || 1280
export const HEIGHT = parseInt(process.env.HEIGHT!, 10) || 720
export const ALLOWED_CHANNELS = Object.freeze((process.env.ALLOWED_CHANNELS || '').split(',').map(e => e.trim()))

console.log(`Using config:
    RECORDINGS_PATH=${RECORDINGS_PATH}
    WIDTH=${WIDTH}
    HEIGHT=${HEIGHT}
    ALLOWED_CHANNELS=${ALLOWED_CHANNELS}
`);
