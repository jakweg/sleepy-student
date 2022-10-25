import { MAX_MEETING_DURATION_MINUTES, RECORDINGS_PATH, SCHEDULER_INTERVAL_MS } from "./config";
import { currentState, updateState } from "./current-state";
import { addToPast, popFromThePast, ScheduledRecording } from "./db";
import { advanceWebexAndJoin } from "./discord-stuff";
import { startTeamsSession } from "./logic-teams";
import { createWebexSession } from "./logic-webex";
import { DISCORD } from "./main";
import Session, { WebexSession } from "./session";

const startWebex = async (entry: ScheduledRecording) => {
    const channel = await DISCORD.channels.fetch(entry.channel)
    if (!channel?.isTextBased()) return

    const session = currentState.session as WebexSession

    try {
        const webex = await createWebexSession(session.page, entry.url)
        session.assertActive()

        if (webex.captchaImage !== 'not-needed') {
            session.enableWaitingForCaptcha(webex.captchaImage)
        } else {
            console.log('Captcha not needed with this webex meeting');

            await advanceWebexAndJoin(session, null)
        }
    } catch (e) {
        console.error(e)
        session.setFatalErrorAndStop(e.message)
        updateState({ session: null })
    }
}

const startTeams = async (session: Session, entry: ScheduledRecording) => {
    session.assertActive()

    try {
        await startTeamsSession(entry.url, session)
    } catch (e) {
        console.error('Failed to join teams', e)

        await session.page.screenshot({ captureBeyondViewport: true, fullPage: true, path: `${RECORDINGS_PATH}/debug-failed-teams.png` })
        await session.page.goto('about:blank', { waitUntil: 'networkidle2' })

        session.setFatalErrorAndStop(e.message || 'Failed to join teams')
        return
    }

    session.assertActive()

    await session.startRecording()

    session.setRecordingTimeout(MAX_MEETING_DURATION_MINUTES)
    const originalUrl = session.page.url()
    session.addMeetingClosedMonitor(async page => (await page.$('form[name="retryForm"]') || originalUrl !== page.url()) ? 'closed' : null)
}

const doCheck = async () => {
    if (currentState.session?.isActive() === true) return

    const now = Date.now()
    const fromPast = (await popFromThePast()).filter(e => Math.abs(e.timestamp - now) < 10 * 60 * 1_000)
    if (fromPast.length === 0) return
    if (fromPast.length > 1)
        console.warn('Multiple events in past found, taking only first one!', fromPast);

    const entry = fromPast[0]

    await addToPast(entry)

    const session = await Session.createWithNewScheduledMessage(entry)
    updateState({
        session,
    })

    console.log(entry);

    session.do(async () => {
        if (entry.type === 'webex') {
            await startWebex(entry)
        } else if (entry.type === 'teams') {
            await startTeams(session, entry)
        }
    })
}


export const initScheduler = () => void setInterval(doCheck, SCHEDULER_INTERVAL_MS)