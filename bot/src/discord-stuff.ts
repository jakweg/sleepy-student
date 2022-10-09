import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction, Client, Interaction, ModalBuilder, REST, Routes, SlashCommandBooleanOption, SlashCommandBuilder, SlashCommandStringOption, TextInputBuilder, TextInputStyle } from "discord.js";
import { ALLOWED_CHANNELS, LOCALE, MAX_MEETING_LENGTH_MINUTES, MS_TEAMS_CREDENTIALS_LOGIN, MS_TEAMS_CREDENTIALS_PASSWORD, RECORDINGS_PATH, RECORDING_READY_MESSAGE_FORMAT } from "./config";
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
    const url = interaction.options.getString('url')!
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

    if (isScheduled)
        await interaction.message.delete()
    try { assertActiveSession(session) }
    catch (_) {
        interaction.reply({
            content: `To late :(`,
            ephemeral: true,
        })
        return
    }


    if (isScheduled) {
        result.reply({ ephemeral: true, content: 'Thanks, it really means a lot for me' })
        result.channel?.send({
            content: `Thank you <@${interaction.user.id}> :heart: You are truly my hero of the day`,
        })
    }
    else
        result.reply({
            ephemeral: true,
            content: 'Thanks!',
        })

    updateState({
        type: 'joining-webex'
    })

    const runningWebex = await fillCaptchaAndJoin(currentState.page, captcha, session)
    assertActiveSession(session)

    updateState({
        type: 'recording-webex',
        stopRecordingCallback: runningWebex.stop.stop,
    })


    let messageId: string | null = null
    if (isScheduled)
        messageId = (await result.channel?.send({
            content: `Scheduled recording \`${currentState.options?.scheduled?.name || 'unnamed'}\` started`,
            components: [new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`stop-recording#${session}`)
                        .setLabel(`Stop`)
                        .setStyle(ButtonStyle.Danger),
                ) as any],
        }))?.id ?? null
    else
        messageId = (await result.followUp({
            ephemeral: !isScheduled,
            content: 'Recording started',
            components: [new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`stop-recording#${session}`)
                        .setLabel(`Stop`)
                        .setStyle(ButtonStyle.Danger),
                ) as any],
        })).id

    updateState({
        stopRecordingButtonId: [result.channelId, messageId]
    })

    const scheduled = currentState.options?.scheduled

    setTimeout(async () => {
        try {
            assertActiveSession(session)
            await stopRecording(publishRecordingReadyMessage(scheduled, interaction))

            if (isScheduled)
                await result.channel?.send({
                    content: `Scheduled recording stopped after 90 minutes`,
                })
            else
                await result.followUp({
                    ephemeral: !isScheduled,
                    content: 'Recording stopped after 90 minutes',
                })
        } catch (e) { }
    }, MAX_MEETING_LENGTH_MINUTES * 60 * 1_000);

    Promise.resolve()
        .then(async () => {
            while (true) {
                assertActiveSession(session)
                if (await runningWebex.isMeetingStopped()) {
                    await stopRecording(publishRecordingReadyMessage(scheduled, interaction))

                    if (isScheduled)
                        await result.channel?.send({
                            content: `Scheduled recording stopped because meeting is closed`,
                        })
                    else
                        await result.followUp({
                            ephemeral: !isScheduled,
                            content: 'Recording stopped because meeting is closed',
                        })
                }
                await sleep(1000)
            }
        })
        .catch(e => void (e))
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
        })

    await interaction.reply({
        content: `Stopped recording by your command`,
        ephemeral: true,
    })

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

    const url = interaction.options.getString('url')
    const name = interaction.options.getString('name', false)?.replace(/@/g, '') ?? null
    const date = new Date(interaction.options.getString('date') ?? '')

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
    const url = interaction.options.getString('url')!

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

    const recording = await startRecording(page, session)

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
    sleep(MAX_MEETING_LENGTH_MINUTES * 60 * 1000)
        .then(async () => {
            try {
                assertActiveSession(session)
                await stopRecording(publishRecordingReadyMessage(scheduled, null))

                await interaction.reply({
                    content: `Scheduled recording stopped after 90 minutes`,
                })
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
    const detailsString = getAll().map(e => `\`${e.id}\` ${e.name || 'unnamed'} (${e.type}) \`${new Date(e.timestamp).toLocaleString(LOCALE)}\` `)

    await interaction.reply({
        content: `Scheduled recordings (${detailsString.length}):\n${detailsString.join('\n')}`,
        allowedMentions: { users: [], parse: [] },
        ephemeral: true
    });
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
ID: ${entry.id}
Name: ${entry.name || 'unnamed'}
Date: ${new Date(entry.timestamp).toLocaleString(LOCALE)}
Link: \`${entry.url}\`
Scheduled by <@${entry.scheduledBy}> in <#${entry.channel}>
`,
        components: [new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`delete-scheduled#${entry.id}`)
                    .setLabel(`Delete it`)
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setURL(entry.url)
                    .setLabel(`Enter meeting`)
                    .setStyle(ButtonStyle.Link),
            ) as any],
        allowedMentions: { users: [] },
        ephemeral: true
    })
}

const handleInteraction = async (interaction: Interaction<CacheType>) => {
    if (!ALLOWED_CHANNELS.includes(interaction.channelId!)) {
        console.warn('Not permitted invocation in channel', interaction.channelId);
        if (interaction.isRepliable())
            interaction.reply({ content: `This channel (${interaction.channelId}) is not allowed to use this bot`, ephemeral: true })
        return
    }

    console.log(`Invoked ${interaction.toString()} by ${interaction.user.username} (${interaction.user.id}) in ${interaction.channelId}`)

    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'stop') {
            handleStopRecordingClicked(interaction, null)
        } else if (commandName === 'webex') {
            await handleRequestWebexStart(interaction)
        } else if (commandName === 'teams') {
            await handleRequestTeamsStart(interaction)
        } else if (commandName === 'ss') {
            await handleScreenshotRequest(interaction)
        } else if (commandName === 'schedule') {
            await handleScheduleRequest(interaction)
        } else if (commandName === 'next-recordings') {
            await handleNextRecordingsRequest(interaction)
        } else if (commandName === 'scheduled-details') {
            await handleDetailsRequest(interaction)
        }
    } else if (interaction.isButton()) {
        const [customId, session] = interaction.customId.split('#')
        if (customId === 'solve-captcha-button') {
            handleSolveButtonClicked(interaction, session, false)
        } else if (customId === 'solve-captcha-scheduled-button') {
            handleSolveButtonClicked(interaction, session, true)
        } else if (customId === 'stop-recording') {
            handleStopRecordingClicked(interaction, session)
        } else if (customId === 'delete-scheduled') {
            handleDeleteScheduledClicked(interaction, session)
        }
    }
}

const createCommands = () => {
    return [
        new SlashCommandBuilder()
            .setName('webex')
            .setDescription('Requests the bot to record a webex session')
            .addStringOption(new SlashCommandStringOption()
                .setName('url')
                .setDescription('Link to meeting')
                .setRequired(true))
            .addBooleanOption(new SlashCommandBooleanOption()
                .setName('show-chat')
                .setDescription('Show chat in the recording')
                .setRequired(false)),
        new SlashCommandBuilder()
            .setName('teams')
            .setDescription('Requests the bot to record a ms teams session')
            .addStringOption(new SlashCommandStringOption()
                .setName('url')
                .setDescription('Link to meeting')
                .setRequired(true)),
        new SlashCommandBuilder()
            .setName('stop')
            .setDescription('Requests the bot to stop the recording'),
        new SlashCommandBuilder()
            .setName('ss')
            .setDescription('Takes screenshot of current page'),
        new SlashCommandBuilder()
            .setName('schedule')
            .setDescription('Schedules request to record page')
            .addStringOption(new SlashCommandStringOption()
                .setName('url')
                .setDescription('Link to meeting')
                .setRequired(true))
            .addStringOption(new SlashCommandStringOption()
                .setName('date')
                .setDescription('Date and time of the meeting')
                .setRequired(true))
            .addStringOption(new SlashCommandStringOption()
                .setName('name')
                .setDescription('Name of this meeting')
                .setMaxLength(40)
                .setRequired(false)),
        new SlashCommandBuilder()
            .setName('next-recordings')
            .setDescription('See next scheduled recordings'),
        new SlashCommandBuilder()
            .setName('scheduled-details')
            .setDescription('See details of scheduled recordings')
            .addStringOption(new SlashCommandStringOption()
                .setName('id')
                .setDescription('ID of the meeting')
                .setRequired(true)),
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

