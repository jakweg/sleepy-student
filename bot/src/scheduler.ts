import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { RECORDINGS_PATH } from "./config";
import { assertActiveSession, currentState, updateState } from "./current-state";
import { popFromThePast, ScheduledRecording } from "./db";
import { startTeamsSession } from "./logic-teams";
import { DISCORD } from "./main";
import { startRecording } from "./recorder";

const startWebex = (entry: ScheduledRecording) => {

}

const startTeams = async (entry: ScheduledRecording) => {
    const channel = await DISCORD.channels.fetch(entry.channel)
    if (!channel?.isTextBased()) return

    const page = currentState.page

    const session = `${Date.now()}`
    updateState({
        type: 'joining-teams',
        options: {
            sessionId: session,
            showChat: false, url: entry.url
        },
    })

    const initialMessage = await channel.send({
        content: `Hey <@${entry.scheduledBy}>! Joining teams for scheduled meeting ${entry.name || 'unnamed'} (\`${entry.id}\`)`,
    })

    try {
        await startTeamsSession(entry.url, page)
    } catch (e) {
        console.error('Failed to join teams', e)

        await page.screenshot({ captureBeyondViewport: true, fullPage: true, path: `${RECORDINGS_PATH}/debug-failed-teams.png` })
        await page.goto('about:blank', { waitUntil: 'networkidle2' })
        updateState({
            type: 'idle',
        })

        await initialMessage.reply({
            content: 'Failed to join teams',
        })
        return
    }
    assertActiveSession(session)

    const recording = await startRecording(page, session)

    updateState({
        type: 'recording-teams',
        stopRecordingCallback: recording.stop
    })

    await initialMessage.reply({
        content: 'Recording started!',
        components: [new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`stop-recording#${session}`)
                    .setLabel(`Stop recording`)
                    .setStyle(ButtonStyle.Primary),
            ) as any],
    })
}

const doCheck = async () => {
    const now = Date.now()
    const fromPast = (await popFromThePast()).filter(e => Math.abs(e.timestamp - now) < 10 * 60 * 1_000)
    if (fromPast.length === 0) return
    if (fromPast.length > 1)
        console.warn('Multiple events in past found, taking only first one!', fromPast);

    const entry = fromPast[0]

    if (entry.type === 'webex') {
        startWebex(entry)
    } else if (entry.type === 'teams') {
        startTeams(entry)
    }
    console.log(entry);
}


export const initScheduler = () => void setInterval(doCheck, 60_000)