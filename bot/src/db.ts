import { readFile, writeFile } from 'fs/promises';
import { DB_PATH } from './config';


export type ScheduledRecording = Readonly<{
    url: string
    name: string | null
    type: string
    timestamp: number
    scheduledBy: string
    channel: string
}>

export type ScheduledRecordingWithId = Readonly<{
    id: string
} & ScheduledRecording>

interface Database {
    scheduledRecordings: { [key: string]: ScheduledRecording }
}

const initDb = async (): Promise<Database> => {
    const object: Database = { scheduledRecordings: {} }
    await writeFile(DB_PATH, JSON.stringify(object, undefined, 1), { encoding: 'utf8' })
    return object
}

const loadDb = async (): Promise<Database> => {
    try {
        const parsed = JSON.parse(await readFile(DB_PATH, { encoding: 'utf8' }))
        return parsed
    } catch (e) {
        if (e.code === 'ENOENT') {
            console.warn('Database load failed, attempt to initialize empty');
            return await initDb()
        }

        console.error('Database load failed', e.message)
        process.exit(1)
    }
}

const instance = await loadDb()

const saveDb = async () => {
    await writeFile(DB_PATH, JSON.stringify(instance, undefined, 1), { encoding: 'utf8' })
}

export const scheduleNewRecording = async (data: ScheduledRecording): Promise<ScheduledRecordingWithId> => {
    if (data.timestamp < Date.now())
        throw new Error(`Attempt to schedule recording in the past`)

    const id = (Math.random() * 0xFFFFFF | 0).toString(16).padStart(6, '0')

    const object: ScheduledRecording = Object.freeze({
        ...data
    })

    if (instance.scheduledRecordings[id] !== undefined)
        return scheduleNewRecording(data)

    instance.scheduledRecordings[id] = object
    await saveDb()

    return { id, ...object }
}

export const popFromThePast = async (): Promise<ReadonlyArray<ScheduledRecordingWithId>> => {
    const now = Date.now()
    const toReturn = Object
        .entries(instance.scheduledRecordings)
        .filter(e => e[1].timestamp < now)
        .map(e => ({ id: e[0], ...e[1] }))

    if (toReturn.length > 0) {
        for (const e of toReturn)
            delete instance.scheduledRecordings[e.id]
        await saveDb()
    }

    return toReturn
}

export const getAll = (): ReadonlyArray<ScheduledRecordingWithId> => {
    const toReturn = Object
        .entries(instance.scheduledRecordings)
        .map(e => ({ id: e[0], ...e[1] }))

    return toReturn
}


export const findById = (id: string): ScheduledRecordingWithId | null => {
    const found = instance.scheduledRecordings[id]
    if (found)
        return { id, ...found }
    return null
}


export const deleteById = async (id: string): Promise<ScheduledRecordingWithId | null> => {
    const found = instance.scheduledRecordings[id]
    if (found) {
        delete instance.scheduledRecordings[id]
        await saveDb()
        return { id, ...found }
    }
    return null
}
