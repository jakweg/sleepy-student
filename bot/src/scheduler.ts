import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { MAX_MEETING_DURATION_MINUTES, RECORDINGS_PATH, SCHEDULER_INTERVAL_MS } from "./config";
import { assertActiveSession, currentState, updateState } from "./current-state";
import { popFromThePast, ScheduledRecording } from "./db";
import { advanceWebexAndJoin, publishRecordingReadyMessage } from "./discord-stuff";
import { startTeamsSession } from "./logic-teams";
import { createWebexSession } from "./logic-webex";
import { DISCORD } from "./main";
import { startRecording, stopRecording } from "./recorder";
import { sleep } from "./utils";

const startWebex = async (entry: ScheduledRecording) => {
    const channel = await DISCORD.channels.fetch(entry.channel)
    if (!channel?.isTextBased()) return

    const session = `${Date.now()}`

    updateState({
        type: "preparing-for-webex-captcha",
        options: { sessionId: session, showChat: false, url: entry.url, scheduled: entry },
    })

    const initialMessage = await channel.send({
        content: `Hey <@${entry.scheduledBy}>! Joining webex for scheduled meeting ${entry.name || 'unnamed'} (\`${entry.id}\`), may need your help with captcha`,
        components: [new ActionRowBuilder()
            .addComponents(new ButtonBuilder()
                .setURL(entry.url)
                .setLabel(`Enter the meeting yourself`)
                .setStyle(ButtonStyle.Link)) as any
        ],
    })

    try {
        const webex = await createWebexSession(currentState.page, currentState.options!.url)

        assertActiveSession(session)

        if (webex.captchaImage !== 'not-needed') {

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
        } else {
            console.log('Captcha not needed with this webex meeting');

            await advanceWebexAndJoin(session, null, async (options) => {
                return [initialMessage.channelId, (await initialMessage.reply({ ...options } as any)).id]
            })
        }
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
        components: [new ActionRowBuilder()
            .addComponents(new ButtonBuilder()
                .setURL(entry.url)
                .setLabel(`Enter the meeting yourself`)
                .setStyle(ButtonStyle.Link)) as any
        ],
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

    const recording = await startRecording(page, session, currentState.options?.scheduled?.name || `unnamed-teams-${new Date().toJSON()}`)

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
                    .setStyle(ButtonStyle.Danger),
            ) as any],
    })

    const scheduled = currentState.options?.scheduled
    sleep(MAX_MEETING_DURATION_MINUTES * 60 * 1000)
        .then(async () => {
            try {
                assertActiveSession(session)
                await stopRecording(publishRecordingReadyMessage(scheduled, null))

                await initialMessage.reply({
                    content: `Scheduled recording stopped after ${MAX_MEETING_DURATION_MINUTES} minutes`,
                })
            } catch (e) { }
        },);
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