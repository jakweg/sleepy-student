import { ActionRowBuilder, AttachmentBuilder, AutocompleteInteraction, BaseMessageOptions, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction, Client, Interaction, MessagePayload, ModalBuilder, REST, Routes, SlashCommandBuilder, SlashCommandStringOption, TextInputBuilder, TextInputStyle } from "discord.js";
import { ALLOWED_CHANNELS, LOCALE, MAX_MEETING_DURATION_MINUTES, MS_TEAMS_CREDENTIALS_LOGIN, MS_TEAMS_CREDENTIALS_PASSWORD, RECORDINGS_PATH, RECORDING_READY_MESSAGE_FORMAT } from "./config";
import { assertActiveSession, currentState, updateState } from "./current-state";
import { deleteById, findById, getAll, ScheduledRecording, scheduleNewRecording } from "./db";
import { startTeamsSession } from "./logic-teams";
import { createWebexSession, fillCaptchaAndJoin } from "./logic-webex";
import { DISCORD } from "./main";
import { startRecording, stopRecording } from "./recorder";
import { sleep } from "./utils";

const startWebex = async (sessionId: string, interaction: ChatInputCommandInteraction<CacheType>) => {
    assertActiveSession(sessionId)

    const webex = await createWebexSession(currentState.page, currentState.options!.url)

    assertActiveSession(sessionId)

    if (webex.captchaImage !== 'not-needed') {
        updateState({
            type: 'waiting-for-solution-for-webex-captcha',
        })

        const attachment = new AttachmentBuilder(webex.captchaImage);

        await interaction.followUp({
            content: 'Please solve this captcha',
            files: [attachment],
            components: [new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`solve-captcha-button#${sessionId}`)
                        .setLabel(`I'm ready`)
                        .setStyle(ButtonStyle.Primary),
                ) as any],
            ephemeral: true
        });
    } else {
        console.log('Looks like captcha is not needed for this webex');

        await advanceWebexAndJoin(sessionId, null, async (options) => {
            return [interaction.channelId, (await interaction.followUp({ ephemeral: true, ...options } as any)).id]
        })
    }
}

const handleRequestWebexStart = async (interaction: ChatInputCommandInteraction<CacheType>) => {
    if (currentState.type !== 'idle') {
        await interaction.reply({
            content: `Sorry, but I'm busy now`,
            ephemeral: true,
        })
        return
    }

    const session = `${Date.now()}`
    const url = interaction.options.getString('link')!
    const showChat = !!interaction.options.getBoolean('show-chat')

    updateState({
        type: "preparing-for-webex-captcha",
        options: { sessionId: session, showChat, url },
    })


    await interaction.reply({
        content: `I'm joining...`,
        ephemeral: true,
    })

    try {
        await startWebex(session, interaction)
    } catch (e) {
        console.error(e)
        interaction.followUp({
            content: 'Something went wrong',
            ephemeral: true
        });
        assertActiveSession(session)
        updateState({
            type: "idle",
        })
    }
}

const handleSolveButtonClicked = async (interaction: ButtonInteraction<CacheType>, session: string, isScheduled: boolean) => {
    if (session && session !== currentState.options?.sessionId) {
        await interaction.reply({
            content: `You should have not clicked this button`,
            ephemeral: true,
        })
        return
    }
    if (!session || currentState.type !== 'waiting-for-solution-for-webex-captcha') {
        await interaction.reply({
            content: `Sorry, but I'm busy now`,
            ephemeral: true,
        })
        return
    }

    const modal = new ModalBuilder()
        .setCustomId(`captcha-modal#${session}`)
        .setTitle('Solve the captcha');

    const resultInput = new TextInputBuilder()
        .setCustomId('captcha-result')
        .setLabel("What does it say?")
        .setStyle(TextInputStyle.Short)
        .setMinLength(6)
        .setMaxLength(6)
        .setPlaceholder('Captcha')
        .setRequired(true)

    modal.addComponents(
        new ActionRowBuilder().addComponents(resultInput) as any,
    )

    await interaction.showModal(modal);
    const result = await interaction.awaitModalSubmit({ time: 0 });

    const captcha = result.fields.getTextInputValue('captcha-result')
    if (!captcha) {
        interaction.reply({
            content: `What?`,
            ephemeral: true,
        }).catch(e => void (e))
    }

    if (isScheduled)
        await interaction.message.delete().catch(e => void (e))
    try { assertActiveSession(session) }
    catch (_) {
        interaction.reply({
            content: `To late :(`,
            ephemeral: true,
        })
        return
    }


    if (currentState.type !== 'waiting-for-solution-for-webex-captcha')
        return
    if (isScheduled) {
        result.reply({ ephemeral: true, content: 'Thanks, it really means a lot for me' })?.catch(e => void (e))
        result.channel?.send({
            content: `Thank you <@${interaction.user.id}> :heart: You are truly my hero of the day`,
        })
    }
    else
        result.reply({
            ephemeral: true,
            content: 'Thanks!',
        })?.catch(e => void (e))

    if (currentState.type !== 'waiting-for-solution-for-webex-captcha')
        return

    updateState({
        type: 'joining-webex'
    })

    await advanceWebexAndJoin(session, captcha, async (options) => {
        if (isScheduled) {
            const id = (await result.channel?.send(options) ?? null).id
            if (id)
                return [result.channelId, id]
        }
        else
            return [interaction.channelId, (await result.followUp({ ephemeral: true, ...options } as any)).id]
    })
}

export const publishRecordingReadyMessage = (scheduled: ScheduledRecording, interaction: null | ButtonInteraction | ChatInputCommandInteraction) => async (name: string) => {
    try {
        if (scheduled) {
            const channel = await DISCORD.channels.fetch(scheduled.channel)
            if (channel?.isTextBased()) {
                channel.send({
                    content: RECORDING_READY_MESSAGE_FORMAT.replace('%name%', name),
                })
                return
            }
        }
        interaction?.followUp({
            content: RECORDING_READY_MESSAGE_FORMAT.replace('%name%', name),
            ephemeral: true,
        })
    } catch (e) { }
}

const handleStopRecordingClicked = async (interaction: ButtonInteraction | ChatInputCommandInteraction, session: string | null) => {
    if (currentState.type !== 'recording-webex' && currentState.type !== 'recording-teams') {
        await interaction.reply({
            content: `Wasn't even recording`,
            ephemeral: true,
        })
        return
    }

    if (session !== null && currentState.options?.sessionId !== session) {
        await interaction.reply({
            content: `Outdated button`,
            ephemeral: true,
        })
        return
    }
    const scheduled = currentState.options?.scheduled

    if (scheduled)
        await interaction.channel?.send({
            content: `Recording of ${scheduled.name || 'unnamed session'} stopped by <@${interaction.user.id}>`,
        })?.catch(e => void (e))

    await interaction.reply({
        content: `Stopped recording by your command`,
        ephemeral: true,
    })?.catch(e => void (e))

    stopRecording(publishRecordingReadyMessage(scheduled, interaction))
}

const handleScreenshotRequest = async (interaction: ChatInputCommandInteraction<CacheType>) => {
    await interaction.deferReply({ ephemeral: true })

    const screenshotData = await currentState.page.screenshot({ captureBeyondViewport: true, fullPage: true, type: 'jpeg' })

    const attachment = new AttachmentBuilder(screenshotData);

    await interaction.followUp({
        content: 'Here you are',
        files: [attachment],
        ephemeral: true
    });
}

const handleScheduleRequest = async (interaction: ChatInputCommandInteraction<CacheType>) => {
    await interaction.deferReply({ ephemeral: true })

    const url = interaction.options.getString('link')
    const name = interaction.options.getString('name', false)?.replace(/@/g, '') ?? null
    const whenString = interaction.options.getString('when') ?? ''
    const date = new Date(whenString === 'now' ? (Date.now() + 1_100) : whenString)

    if (isNaN(date.getTime())) {
        await interaction.followUp({
            content: 'This date is invalid',
            ephemeral: true
        })
        return
    }
    if (date.getTime() < Date.now()) {
        await interaction.followUp({
            content: 'This date is in the past',
            ephemeral: true
        })
        return
    }

    const type = (url?.includes('webex') ? 'webex' : (url?.includes('teams') ? 'teams' : 'invalid'))
    if (type === 'invalid') {
        await interaction.followUp({
            content: 'Couldn\'t determine platform',
            ephemeral: true
        })
        return
    }

    const timeDiff = date.getTime() - Date.now()
    const diff = {
        totalSeconds: timeDiff / 1000 | 0,
        totalMinutes: timeDiff / 1000 / 60 | 0,
        totalHours: timeDiff / 1000 / 60 / 60 | 0,
        totalDays: timeDiff / 1000 / 60 / 60 / 24 | 0,
    }
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "always" });

    let inText = ''
    if (diff.totalDays > 0)
        inText += rtf.format(diff.totalDays, 'day')
    else if (diff.totalHours > 0)
        inText += rtf.format(diff.totalHours, 'hour')
    else if (diff.totalMinutes > 0)
        inText += rtf.format(diff.totalMinutes, 'minute')
    else
        inText += rtf.format(diff.totalSeconds, 'second')

    const scheduled = await scheduleNewRecording({
        url: url!,
        type,
        name,
        timestamp: date.getTime(),
        scheduledBy: interaction.user.id,
        channel: interaction.channelId,
    })

    await interaction.followUp({
        content: `Scheduled recording \`${name || '(unnamed)'}\` for \`${date.toLocaleString(LOCALE)}\` (\`${inText}\`) with id \`${scheduled.id}\``,
        ephemeral: true,
        components: [new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`delete-scheduled#${scheduled.id}`)
                    .setLabel(`Undo`)
                    .setStyle(ButtonStyle.Secondary),
            ) as any],
    });
}

const handleRequestTeamsStart = async (interaction: ChatInputCommandInteraction<CacheType>) => {
    if (currentState.type !== 'idle') {
        await interaction.reply({
            content: `I'm busy`,
            ephemeral: true,
        })
        return
    }

    if (!MS_TEAMS_CREDENTIALS_LOGIN || !MS_TEAMS_CREDENTIALS_PASSWORD) {
        await interaction.reply({
            content: `teams are disabled`,
            ephemeral: true,
        })
        return
    }

    const page = currentState.page
    const url = interaction.options.getString('link')!

    const session = `${Date.now()}`
    updateState({
        type: 'joining-teams',
        options: {
            sessionId: session,
            showChat: false, url,
        },
    })

    await interaction.reply({
        content: 'Joining teams!',
        ephemeral: true,
    })

    try {
        await startTeamsSession(url, page)
    } catch (e) {
        console.error('Failed to join teams', e)

        await page.screenshot({ captureBeyondViewport: true, fullPage: true, path: `${RECORDINGS_PATH}/debug-failed-teams.png` })
        await page.goto('about:blank', { waitUntil: 'networkidle2' })
        updateState({
            type: 'idle',
        })

        await interaction.followUp({
            content: 'Failed to join teams',
            ephemeral: true,
        })
        return
    }
    assertActiveSession(session)

    const recording = await startRecording(page, session, `unnamed-teams-${new Date().toJSON()}`)

    updateState({
        type: 'recording-teams',
        stopRecordingCallback: recording.stop
    })

    await interaction.followUp({
        content: 'Recording started',
        ephemeral: true,
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

                await interaction.reply({
                    content: `Scheduled recording stopped after ${MAX_MEETING_DURATION_MINUTES} minutes`,
                })?.catch(e => void (e))
            } catch (e) { }
        },);
}

const handleDeleteScheduledClicked = async (interaction: ButtonInteraction<CacheType>, id: string | null) => {
    const entry = await deleteById(id || '')
    if (!entry) {
        await interaction.reply({
            content: `Not found meeting with this ID`,
            ephemeral: true
        })
        return
    }

    await interaction.reply({
        content: `Deleted scheduled ${entry.name || 'unnamed'} for day ${new Date(entry.timestamp).toLocaleString(LOCALE)}`,
        ephemeral: true
    });
}

const handleNextRecordingsRequest = async (interaction: ChatInputCommandInteraction<CacheType>) => {

    const all = getAll();
    if (all.length > 0) {
        const detailsString = all.map(e => `\`${e.id}\` ${e.name || 'unnamed'} (${e.type}) \`${new Date(e.timestamp).toLocaleString(LOCALE)}\` `)

        await interaction.reply({
            content: `Scheduled recordings: (${detailsString.length})\n${detailsString.join('\n')}`,
            allowedMentions: { users: [], parse: [] },
            ephemeral: true
        });
    } else {
        await interaction.reply({
            content: `No upcoming recordings`,
            ephemeral: true
        });
    }
}

const handleDetailsRequest = async (interaction: ChatInputCommandInteraction<CacheType>) => {
    const id = interaction.options.getString('id')

    const entry = findById(id || '')
    if (!entry) {
        await interaction.reply({
            content: `Not found meeting with this ID`,
            ephemeral: true
        })
        return
    }

    await interaction.reply({
        content: `Meeting details:
Name: ${entry.name || 'unnamed'}
Date: ${new Date(entry.timestamp).toLocaleString(LOCALE)}
Link: \`${entry.url}\`
Scheduled by <@${entry.scheduledBy}> in <#${entry.channel}> on ${new Date(entry.creationTimestamp).toLocaleString(LOCALE)}
`,
        components: [new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`delete-scheduled#${entry.id}`)
                    .setLabel(`Delete it`)
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setURL(entry.url)
                    .setLabel(`Enter meeting yourself`)
                    .setStyle(ButtonStyle.Link),
            ) as any],
        allowedMentions: { users: [] },
        ephemeral: true
    })
}

const handleDetailsAutocomplete = (interaction: AutocompleteInteraction) => {
    const { name, value } = interaction.options.getFocused(true);

    interaction
        .respond(getAll()
            .filter(e => e.id.startsWith(value) || e.name.toLocaleLowerCase().includes(name.toLocaleLowerCase()))
            .map(e => ({ name: e.name, value: e.id })))
        .catch(e => void (e))
}

const handleInteraction = async (interaction: Interaction<CacheType>) => {
    if (!ALLOWED_CHANNELS.includes(interaction.channelId!)) {
        console.warn('Not permitted invocation in channel', interaction.channelId, 'by', interaction.user?.username, interaction.user?.id);
        if (interaction.isRepliable())
            interaction.reply({ content: `This channel (${interaction.channelId}) is not allowed to use this bot`, ephemeral: true })
        return
    }

    console.log(`Invoked ${interaction.type} ${interaction.toString()} by ${interaction.user.username} (${interaction.user.id}) in ${interaction.channelId}`)

    if (interaction.isAutocomplete()) {
        switch (interaction.commandName) {
            case 'details': handleDetailsAutocomplete(interaction); break
        }

    } else if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        switch (commandName) {
            case 'stop': handleStopRecordingClicked(interaction, null); break
            case 'webex': await handleRequestWebexStart(interaction); break
            case 'teams': await handleRequestTeamsStart(interaction); break
            case 'ss': await handleScreenshotRequest(interaction); break
            case 'schedule': await handleScheduleRequest(interaction); break
            case 'details': await handleDetailsRequest(interaction); break
            case 'upcoming': await handleNextRecordingsRequest(interaction); break
        }
    } else if (interaction.isButton()) {
        const [customId, session] = interaction.customId.split('#')
        switch (customId) {
            case 'solve-captcha-button': handleSolveButtonClicked(interaction, session, false); break
            case 'solve-captcha-scheduled-button': handleSolveButtonClicked(interaction, session, true); break
            case 'stop-recording': handleStopRecordingClicked(interaction, session); break
            case 'delete-scheduled': handleDeleteScheduledClicked(interaction, session); break
        }
    }
}

const createCommands = () => {
    return [
        new SlashCommandBuilder()
            .setName('record')
            .setDescription('Record session')
            .addStringOption(new SlashCommandStringOption()
                .setName('link')
                .setDescription('Link to join')
                .setRequired(true))
            .addStringOption(new SlashCommandStringOption()
                .setName('when')
                .setDescription('When to join yyyy.MM.dd hh:mm:ss or "now"')
                .setRequired(true))
            .addStringOption(new SlashCommandStringOption()
                .setName('name')
                .setDescription('Name this meeting')
                .setMaxLength(60)
                .setRequired(false)),
        new SlashCommandBuilder()
            .setName('stop')
            .setDescription('Immediately stop current recording'),
        // new SlashCommandBuilder()
        //     .setName('webex')
        //     .setDescription('Record webex session now')
        //     .addStringOption(new SlashCommandStringOption()
        //         .setName('link')
        //         .setDescription('Link to meeting')
        //         .setRequired(true))
        //     .addBooleanOption(new SlashCommandBooleanOption()
        //         .setName('show-chat')
        //         .setDescription('Show chat in the recording')
        //         .setRequired(false)),
        // new SlashCommandBuilder()
        //     .setName('teams')
        //     .setDescription('Record ms teams session now')
        //     .addStringOption(new SlashCommandStringOption()
        //         .setName('link')
        //         .setDescription('Link to channel or meeting')
        //         .setRequired(true)),
        new SlashCommandBuilder()
            .setName('upcoming')
            .setDescription('View upcoming scheduled recordings'),
        new SlashCommandBuilder()
            .setName('details')
            .setDescription('View details of upcoming recording')
            .addStringOption(new SlashCommandStringOption()
                .setName('id')
                .setDescription('ID of the meeting')
                .setRequired(true)
                .setAutocomplete(true)),
        new SlashCommandBuilder()
            .setName('ss')
            .setDescription('Takes screenshot of current page'),
    ]
}

export const launch = async () => {
    const client = new Client({
        intents: [
            'DirectMessages', 'Guilds', 'GuildMessages'
        ]
    })


    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    rest.put(Routes.applicationCommands(process.env.APPLICATION_ID!), {
        body: createCommands().map(e => e.toJSON())
    })

    await client.login(process.env.DISCORD_TOKEN)

    client.on('interactionCreate', interaction => {
        try {
            handleInteraction(interaction)
        } catch (e) {
            console.error('Failed to response to interaction', e);
        }
    });

    return client
}

export async function advanceWebexAndJoin(session: string,
    captcha: string,
    postMessage: (options: MessagePayload | BaseMessageOptions) => Promise<[string, string]>) {


    const runningWebex = await fillCaptchaAndJoin(currentState.page, captcha, session,
        currentState.options?.scheduled?.name ? currentState.options?.scheduled?.name : `unnamed-webex-${new Date().toJSON()}`)
    assertActiveSession(session)

    updateState({
        type: 'recording-webex',
        stopRecordingCallback: runningWebex.stop.stop,
    })


    const stopRecordingButtonId = await postMessage({
        content: `Recording \`${currentState.options?.scheduled?.name || 'unnamed'}\` started`,
        components: [new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`stop-recording#${session}`)
                    .setLabel(`Stop`)
                    .setStyle(ButtonStyle.Danger),
            ) as any],
    }) ?? null

    updateState({
        stopRecordingButtonId
    })

    const scheduled = currentState.options?.scheduled

    setTimeout(async () => {
        try {
            assertActiveSession(session)
            await stopRecording((name) => {
                postMessage({ content: RECORDING_READY_MESSAGE_FORMAT.replace('%name%', name), })
            })

            await postMessage({
                content: `Recording stopped after ${MAX_MEETING_DURATION_MINUTES} minutes`,
            })
        } catch (e) { }
    }, MAX_MEETING_DURATION_MINUTES * 60 * 1_000);

    Promise.resolve()
        .then(async () => {
            while (true) {
                assertActiveSession(session)
                if (await runningWebex.isMeetingStopped()) {
                    await stopRecording((name) => {
                        postMessage({ content: RECORDING_READY_MESSAGE_FORMAT.replace('%name%', name), })
                    })

                    await postMessage({
                        content: `Recording stopped because meeting is closed`,
                    })
                }
                await sleep(1000)
            }
        })
        .catch(e => void (e))
}

