import { stat } from 'fs/promises';

export const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration))

const ALLOWED_CHARS_IN_FILE_NAME = new Set('qwertyuiopasdfghjklzxcvbnmąśęółźćńĘÓŁĄŚŻŹĆŃQWERTYUIOPASDFGHJKLZXCVBNM1234567890.-'.split(''))
const REPLACEMENT_CHARACTER = '_'
export const sanitizeFileName = (name: string) => [...name].map(e => ALLOWED_CHARS_IN_FILE_NAME.has(e) ? e : REPLACEMENT_CHARACTER).join('')

export const fileExists = (name: string) => stat(name).then(() => true).catch(() => false)