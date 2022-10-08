import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { RECORDINGS_PATH, SCHEDULER_INTERVAL_MS } from "./config";
import { assertActiveSession, currentState, updateState } from "./current-state";
import { popFromThePast, ScheduledRecording } from "./db";
import { startTeamsSession } from "./logic-teams";
import { createWebexSession } from "./logic-webex";
import { DISCORD } from "./main";
import { startRecording } from "./recorder";

const startWebex = async (entry: ScheduledRecording) => {
    const channel = await DISCORD.channels.fetch(entry.channel)
    if (!channel?.isTextBased()) return

    const session = `${Date.now()}`

    updateState({
        type: "preparing-for-webex-captcha",
        options: { sessionId: session, showChat: false, url: entry.url, scheduled: entry },
    })

    const initialMessage = await channel.send({
        content: `Hey <@${entry.scheduledBy}>! Joining webex for scheduled meeting ${entry.name || 'unnamed'} (\`${entry.id}\`), will need your help with captcha`,
    })

    try {
        const webex = await createWebexSession(currentState.page, currentState.options!.url)

        assertActiveSession(session)
        updateState({
            type: 'waiting-for-solution-for-webex-captcha',
        })

        const attachment = new AttachmentBuilder(webex.captchaImage);

        await initialMessage.reply({
            content: 'Please anyone, help me with this!',
            files: [attachment],
            components: [new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`solve-captcha-scheduled-button#${session}`)
                        .setLabel(`I'm the hero today`)
                        .setStyle(ButtonStyle.Primary),
                ) as any],
        });
    } catch (e) {
        console.error(e)
        initialMessage.reply({
            content: 'Something went wrong',
        });

        assertActiveSession(session)
        updateState({
            type: "idle",
        })
    }
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
            showChat: false, url: entry.url,
            scheduled: entry,
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
    if (currentState.type !== 'idle') return

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


export const initScheduler = () => void setInterval(doCheck, SCHEDULER_INTERVAL_MS)