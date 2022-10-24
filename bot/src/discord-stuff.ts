import { ActionRowBuilder, AttachmentBuilder, AutocompleteInteraction, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction, Client, Interaction, ModalBuilder, REST, Routes, SlashCommandBuilder, SlashCommandStringOption, TextInputBuilder, TextInputStyle } from "discord.js";
import { readFile } from 'fs/promises';
import { ALLOWED_CHANNELS, LANGUAGE, MAX_MEETING_DURATION_MINUTES } from "./config";
import { currentState, updateState } from "./current-state";
import { deleteById, findById, findInPastIfNotUsedById, findInPastIfNotUsedByIdAndMarkUsed, getAll, scheduleNewRecording } from "./db";
import intl, { en } from "./intl";
import { fillCaptchaAndJoin } from "./logic-webex";
import Session, { WebexSession } from "./session";

const verifyValidSession = async (interaction: ButtonInteraction<CacheType>, sessionId: string): Promise<Session> => {
    if (!currentState.session || sessionId !== currentState.session?.sessionId) {
        await interaction.reply({
            content: intl.OUTDATED_BUTTON_CLICKED_MESSAGE,
            ephemeral: true,
        })
        return await new Promise(resolve => void (resolve))
    }
    return currentState.session
}

const handleSolveButtonClicked = async (interaction: ButtonInteraction<CacheType>, sessionId: string) => {
    const session = await verifyValidSession(interaction, sessionId) as WebexSession

    if (session.entry.type !== 'webex') {
        interaction.reply({ content: 'Captcha responses are only for webex', ephemeral: true }).catch(e => void (e))
        return
    }
    if (!session.isWaitingForCaptcha()) {
        interaction.reply({ content: intl.CAPTCHA_TOO_LATE_SUBMITTED, ephemeral: true, }).catch(e => void (e))
        return
    }

    const modal = new ModalBuilder()
        .setCustomId(`captcha-modal#${sessionId}`)
        .setTitle(intl.CAPTCHA_MODAL_TITLE);

    const resultInput = new TextInputBuilder()
        .setCustomId('captcha-result')
        .setLabel(intl.CAPTCHA_MODAL_INPUT_TITLE)
        .setStyle(TextInputStyle.Short)
        .setMinLength(6)
        .setMaxLength(6)
        .setPlaceholder('Captcha')
        .setRequired(true)

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(resultInput),
    )

    await interaction.showModal(modal);
    const result = await interaction.awaitModalSubmit({ time: 0 });

    const captcha = result.fields.getTextInputValue('captcha-result')
    if (!captcha) {
        interaction.reply({
            content: `What?`,
            ephemeral: true,
        }).catch(e => void (e))
        return
    }

    if (!session.isWaitingForCaptcha()) {
        interaction.reply({ content: intl.CAPTCHA_TOO_LATE_SUBMITTED, ephemeral: true, }).catch(e => void (e))
        return
    }

    await interaction.message?.delete?.()?.catch(e => void (e))

    result.reply({ ephemeral: true, content: intl.CAPTCHA_SUBMIT_CONFIRMATION })?.catch(e => void (e))

    await session.do(async () => {
        if (session.isWaitingForCaptcha()) {
            advanceWebexAndJoin(session, captcha)
        }
    })
}

const handleStopRecordingClicked = async (interaction: ButtonInteraction | ChatInputCommandInteraction, sessionId: string | null) => {
    if (!currentState.session) {
        await interaction.reply({
            content: intl.STOP_FAILED_NO_RECORDING,
            ephemeral: true,
        })
        return
    }

    await interaction.reply({
        content: intl.STOP_RECORDING_CONFIRM_TITLE,
        components: [new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`stop-recording-confirmed#${sessionId ?? currentState.session?.sessionId ?? 'any'}`)
                    .setLabel(intl.YES)
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`stop-recording-cancel#any`)
                    .setLabel(intl.NO)
                    .setStyle(ButtonStyle.Secondary)
            )],
        ephemeral: true,
    })
}

const handleStopRecordingCancelClicked = async (interaction: ButtonInteraction | ChatInputCommandInteraction) => {
    await interaction.reply({ content: intl.STOP_RECORDING_CANCELLED, ephemeral: true })
}


const handleStopRecordingConfirmedClicked = async (interaction: ButtonInteraction | ChatInputCommandInteraction, sessionId: string | null) => {
    if (currentState.session) {
        if (sessionId !== null && currentState.session.sessionId !== sessionId) {
            await interaction.reply({
                content: intl.OUTDATED_BUTTON_CLICKED_MESSAGE,
                ephemeral: true,
            })

            return
        }
        await currentState.session.do(async () => {
            currentState.session.stopRecordingByUser(interaction.user.id)

            await interaction.deferReply({ ephemeral: true })
            try {
                const imgData = await readFile('./assets/yes-chad.png')
                const attachment = new AttachmentBuilder(imgData);
                await interaction.followUp({
                    content: intl.STOP_RECORDING_EXECUTED,
                    files: [attachment],
                    ephemeral: true,
                })
            } catch (e) {
                await interaction.followUp({
                    content: intl.STOP_RECORDING_EXECUTED,
                    ephemeral: true,
                })
            }

            updateState({ session: null })
        })
        return
    }

    await interaction.reply({
        content: intl.STOP_FAILED_NO_RECORDING,
        ephemeral: true,
    })
}

const handleScreenshotRequest = async (interaction: ChatInputCommandInteraction<CacheType>) => {
    await interaction.deferReply({ ephemeral: true })
    const page = currentState.session?.page
    if (!page) {
        await interaction.followUp({
            content: intl.STOP_FAILED_NO_RECORDING,
            ephemeral: true
        });
        return
    }

    const screenshotData = await page.screenshot({ captureBeyondViewport: true, fullPage: true, type: 'jpeg' })


    const attachment = new AttachmentBuilder(screenshotData);

    await interaction.followUp({
        content: intl.SCREENSHOT_DELIVERED_TEXT,
        files: [attachment],
        ephemeral: true
    });
}

const handleRecordRequest = async (interaction: ChatInputCommandInteraction<CacheType>) => {
    await interaction.deferReply({ ephemeral: true })

    let url = interaction.options.getString('link')
    const name = interaction.options.getString('name', false)?.replace(/@/g, '') ?? null
    const whenString = interaction.options.getString('when') ?? ''
    const date = new Date(whenString === 'now' ? (Date.now() + 1_100) : whenString)

    try {
        url = new URL(url).href
    } catch (e) {
        await interaction.followUp({
            content: intl.RECORD_COMMAND_INVALID_URL,
            ephemeral: true
        })
        return
    }
    if (isNaN(date.getTime())) {
        await interaction.followUp({
            content: intl.RECORD_COMMAND_INVALID_DATE,
            ephemeral: true
        })
        return
    }
    if (date.getTime() < Date.now()) {
        await interaction.followUp({
            content: intl.RECORD_COMMAND_DATE_IN_PAST,
            ephemeral: true
        })
        return
    }

    const type = (url?.includes('webex') ? 'webex' : (url?.includes('teams') ? 'teams' : 'invalid'))
    if (type === 'invalid') {
        await interaction.followUp({
            content: intl.RECORD_COMMAND_INVALID_PLATFORM,
            ephemeral: true
        })
        return
    }

    const timeDiff = date.getTime() - Date.now()

    const scheduled = await scheduleNewRecording({
        url: url!,
        type,
        name,
        timestamp: date.getTime(),
        scheduledBy: interaction.user.id,
        channel: interaction.channelId,
    })

    await interaction.followUp({
        content: intl.recordingCommandAccepted(name, date, timeDiff),
        ephemeral: true,
        components: [new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`delete-scheduled#${scheduled.id}`)
                    .setLabel(intl.UNDO)
                    .setStyle(ButtonStyle.Secondary),
            )],
    });
}

const handleDeleteScheduledClicked = async (interaction: ButtonInteraction<CacheType>, id: string | null) => {
    const entry = await deleteById(id || '')
    if (!entry) {
        await interaction.reply({
            content: intl.DELETE_COMMAND_NOT_FOUND,
            ephemeral: true
        })
        return
    }

    await interaction.reply({
        content: intl.deleteCommandConfirmation(entry.name, entry.timestamp),
        ephemeral: true
    });
}

const handleScheduleNextWeek = async (interaction: ButtonInteraction<CacheType>, id: string | null) => {

    const oldEntry = findInPastIfNotUsedById(id || '')
    if (!oldEntry) {
        await interaction.reply({
            content: `Not found this meeting`,
            ephemeral: true
        })
        return
    }

    await interaction.showModal(new ModalBuilder()
        .setCustomId(`reschedule-modal#any`)
        .setTitle(intl.SCHEDULE_NEXT_WEEK_COMMAND_MODAL_TITLE).addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder()
                .setCustomId('new-name')
                .setLabel(intl.SCHEDULE_NEXT_WEEK_COMMAND_NAME_INPUT_PROMPT)
                .setStyle(TextInputStyle.Short)
                .setMinLength(1)
                .setMaxLength(60)
                .setPlaceholder(intl.SCHEDULE_NEXT_WEEK_COMMAND_NAME_INPUT_PLACEHOLDER)
                .setRequired(true)
                .setValue(oldEntry.name)),
        ))

    const result = await interaction.awaitModalSubmit({ time: 0 })
    const newName = result.fields.getTextInputValue('new-name')

    try {
        const oldEntry = await findInPastIfNotUsedByIdAndMarkUsed(id || '')
        if (!oldEntry) throw new Error('Not found!')

        const newScheduled = await scheduleNewRecording({
            ...oldEntry,
            name: newName || oldEntry.name,
            timestamp: oldEntry.timestamp + 7 * 24 * 60 * 60 * 1000,
            scheduledBy: interaction.user.id
        })

        await result.reply({
            content: intl.scheduleNextWeekCommandConfirmation(newScheduled.name, newScheduled.timestamp),
            ephemeral: true
        });


        const originalMessage = await interaction.message.fetch(true)

        const row = originalMessage.components[0].toJSON()
        const scheduleButton = row.components.find(e => (e as any)['custom_id']?.startsWith('schedule-next-week#'))
        if (scheduleButton) {
            scheduleButton.disabled = true
            scheduleButton['label'] = intl.SCHEDULE_NEXT_WEEK_COMMAND_SCHEDULED_BUTTON_DISABLED
        }
        originalMessage.edit({ components: [row] }).catch(e => void (e))

    } catch (e) {
        console.error(e.message)
        await result.reply({
            content: `Too late`,
            ephemeral: true
        });
    }
}

const handleNextRecordingsRequest = async (interaction: ChatInputCommandInteraction<CacheType>) => {

    const all = getAll();
    if (all.length > 0) {
        const detailsString = all.map(e => intl.commandUpcomingLineFormat(e.name, e.type, e.timestamp))

        await interaction.reply({
            content: `${intl.commandUpcomingHeaderLine(all.length)}\n${detailsString.join('\n')}`,
            allowedMentions: { users: [], parse: [] },
            ephemeral: true
        });
    } else {
        await interaction.reply({
            content: intl.COMMAND_UPCOMING_NONE_FOUND,
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
        content: intl.meetingDetails(entry.name, entry.timestamp, entry.url, entry.scheduledBy, entry.channel, entry.creationTimestamp),
        components: [new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`delete-scheduled#${entry.id}`)
                    .setLabel(intl.MEETING_DETAILS_DELETE_IT)
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setURL(entry.url)
                    .setLabel(intl.ENTER_MEETING_YOURSELF)
                    .setStyle(ButtonStyle.Link),
            ) as any],
        allowedMentions: { users: [] },
        ephemeral: true
    })
}

const handleDetailsAutocomplete = async (interaction: AutocompleteInteraction) => {
    const { name, value = '' } = interaction.options.getFocused(true);
    if (name === 'id')
        await interaction.respond(getAll()
            .filter(e => e.id.startsWith(value) || e.name?.toLocaleLowerCase()?.includes(value.toLocaleLowerCase()))
            .map(e => ({ name: e.name || intl.MEETING_UNNAMED, value: e.id })))
    else await interaction.respond([])
}

const handleInteraction = async (interaction: Interaction<CacheType>) => {
    if (!ALLOWED_CHANNELS.includes(interaction.channelId!)) {
        console.warn('Not permitted invocation in channel', interaction.channelId, 'by', interaction.user?.username, interaction.user?.id);
        if (interaction.isRepliable())
            interaction.reply({ content: intl.channelNotPermitted(interaction.channelId), ephemeral: true })
        return
    }

    console.log(`Invoked ${interaction.type} ${interaction.toString()} by ${interaction.user.username} (${interaction.user.id}) in ${interaction.channelId}`)

    if (interaction.isAutocomplete()) {
        switch (interaction.commandName) {
            case 'details': await handleDetailsAutocomplete(interaction); break
        }

    } else if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        switch (commandName) {
            case 'stop': await handleStopRecordingClicked(interaction, null); break
            case 'ss': await handleScreenshotRequest(interaction); break
            case 'record': await handleRecordRequest(interaction); break
            case 'details': await handleDetailsRequest(interaction); break
            case 'upcoming': await handleNextRecordingsRequest(interaction); break
        }
    } else if (interaction.isButton()) {
        const [customId, sessionId] = interaction.customId.split('#')

        switch (customId) {
            case 'solve-captcha-scheduled-button': await handleSolveButtonClicked(interaction, sessionId); break
            case 'stop-recording': await handleStopRecordingClicked(interaction, sessionId); break
            case 'stop-recording-confirmed': await handleStopRecordingConfirmedClicked(interaction, sessionId); break
            case 'stop-recording-cancel': await handleStopRecordingCancelClicked(interaction); break
            case 'delete-scheduled': await handleDeleteScheduledClicked(interaction, sessionId); break
            case 'schedule-next-week': await handleScheduleNextWeek(interaction, sessionId); break
        }
    }
}

const createCommands = () => {
    return [
        new SlashCommandBuilder()
            .setName('record')
            .setNameLocalizations({ [LANGUAGE]: intl.COMMAND_RECORD_NAME })
            .setDescriptionLocalizations({ [LANGUAGE]: intl.COMMAND_RECORD_DESCRIPTION })
            .setDescription(en.COMMAND_RECORD_DESCRIPTION)
            .addStringOption(new SlashCommandStringOption()
                .setName('link')
                .setNameLocalizations({ [LANGUAGE]: intl.COMMAND_RECORD_LINK_NAME })
                .setDescription(en.COMMAND_RECORD_LINK_DESCRIPTION)
                .setDescriptionLocalizations({ [LANGUAGE]: intl.COMMAND_RECORD_LINK_DESCRIPTION })
                .setRequired(true))
            .addStringOption(new SlashCommandStringOption()
                .setName('when')
                .setNameLocalizations({ [LANGUAGE]: intl.COMMAND_RECORD_DATE_NAME })
                .setDescription(en.COMMAND_RECORD_DATE_DESCRIPTION)
                .setDescriptionLocalizations({ [LANGUAGE]: intl.COMMAND_RECORD_DATE_DESCRIPTION })
                .setRequired(true))
            .addStringOption(new SlashCommandStringOption()
                .setName('name')
                .setNameLocalizations({ [LANGUAGE]: intl.COMMAND_RECORD_NAME_NAME })
                .setDescription(en.COMMAND_RECORD_NAME_DESCRIPTION)
                .setDescriptionLocalizations({ [LANGUAGE]: intl.COMMAND_RECORD_NAME_DESCRIPTION })
                .setMaxLength(60)
                .setRequired(false)),
        new SlashCommandBuilder()
            .setName('stop')
            .setNameLocalizations({ [LANGUAGE]: intl.COMMAND_STOP_NAME })
            .setDescription(en.COMMAND_STOP_DESCRIPTION)
            .setDescriptionLocalizations({ [LANGUAGE]: intl.COMMAND_STOP_DESCRIPTION }),
        new SlashCommandBuilder()
            .setName('upcoming')
            .setNameLocalizations({ [LANGUAGE]: intl.COMMAND_UPCOMING_NAME })
            .setDescription(en.COMMAND_UPCOMING_DESCRIPTION)
            .setDescriptionLocalizations({ [LANGUAGE]: intl.COMMAND_UPCOMING_DESCRIPTION }),
        new SlashCommandBuilder()
            .setName('details')
            .setNameLocalizations({ [LANGUAGE]: intl.COMMAND_DETAILS_NAME })
            .setDescription(en.COMMAND_DETAILS_DESCRIPTION)
            .setDescriptionLocalizations({ [LANGUAGE]: intl.COMMAND_UPCOMING_DESCRIPTION })
            .addStringOption(new SlashCommandStringOption()
                .setName('id')
                .setNameLocalizations({ [LANGUAGE]: intl.COMMAND_DETAILS_ID_NAME })
                .setDescription(en.COMMAND_DETAILS_ID_DESCRIPTION)
                .setDescriptionLocalizations({ [LANGUAGE]: intl.COMMAND_DETAILS_ID_DESCRIPTION })
                .setRequired(true)
                .setAutocomplete(true)),
        new SlashCommandBuilder()
            .setName('ss')
            .setDescription(en.COMMAND_SS_DESCRIPTION)
            .setDescriptionLocalizations({ [LANGUAGE]: intl.COMMAND_SS_DESCRIPTION }),
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

    client.on('interactionCreate', async interaction => {
        try {
            await handleInteraction(interaction)
        } catch (e) {
            console.error('Failed to response to interaction', e);
        }
    });

    return client
}

export async function advanceWebexAndJoin(
    session: WebexSession,
    captcha: string | null,) {
    if (!session.isWaitingForCaptcha()) return
    session.disableWaitingForCaptcha()

    const runningWebex = await fillCaptchaAndJoin(session, captcha)
    if (Buffer.isBuffer(runningWebex)) {
        session.assertActive()
        session.enableWaitingForCaptcha(runningWebex)
        return
    }

    session.assertActive()
    await session.startRecording()
    session.setRecordingTimeout(MAX_MEETING_DURATION_MINUTES)

    session.addMeetingClosedMonitor(async () => await runningWebex.isMeetingStopped() ? 'closed' : null)
}

