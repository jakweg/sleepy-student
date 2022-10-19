import { ActionRowBuilder, AttachmentBuilder, AutocompleteInteraction, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction, Client, Interaction, ModalBuilder, REST, Routes, SlashCommandBuilder, SlashCommandStringOption, TextInputBuilder, TextInputStyle } from "discord.js";
import { ALLOWED_CHANNELS, LOCALE, MAX_MEETING_DURATION_MINUTES } from "./config";
import { currentState, updateState } from "./current-state";
import { deleteById, findById, getAll, scheduleNewRecording } from "./db";
import { fillCaptchaAndJoin } from "./logic-webex";
import Session, { WebexSession } from "./session";

const verifyValidSession = async (interaction: ButtonInteraction<CacheType>, sessionId: string): Promise<Session> => {
    if (!currentState.session || sessionId !== currentState.session?.sessionId) {
        await interaction.reply({
            content: `You should have not clicked this button`,
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
        interaction.reply({ content: 'Too late', ephemeral: true, }).catch(e => void (e))
        return
    }

    const modal = new ModalBuilder()
        .setCustomId(`captcha-modal#${sessionId}`)
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
        interaction.reply({ content: 'Too late', ephemeral: true, }).catch(e => void (e))
        return
    }

    await interaction.message.delete().catch(e => void (e))

    result.reply({ ephemeral: true, content: 'Thanks, it really means a lot for me' })?.catch(e => void (e))

    await session.do(() => advanceWebexAndJoin(session, captcha))
}

const handleStopRecordingClicked = async (interaction: ButtonInteraction | ChatInputCommandInteraction, sessionId: string | null) => {
    if (!currentState.session) {
        await interaction.reply({
            content: `There is no recording going on`,
            ephemeral: true,
        })
        return
    }
    // await interaction.showModal(new ModalBuilder()
    //     .setCustomId(`captcha-modal#${sessionId}`)
    //     .setTitle('Solve the captcha'))

    // const modalResult = await interaction.awaitModalSubmit({ time: 0 })
    // await handleStopRecordingConfirmedClicked(modalResult, sessionId)

    await interaction.reply({
        content: `**Really stop the recording?**`,
        components: [new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`stop-recording-confirmed#${sessionId ?? currentState.session?.sessionId ?? 'any'}`)
                    .setLabel(`YES`)
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`stop-recording-cancel#any`)
                    .setLabel(`Maybe no`)
                    .setStyle(ButtonStyle.Secondary)
            )],
        ephemeral: true,
    })
}

const handleStopRecordingCancelClicked = async (interaction: ButtonInteraction | ChatInputCommandInteraction) => {
    await interaction.reply({ content: 'Cancelled!', ephemeral: true })
}


const handleStopRecordingConfirmedClicked = async (interaction: ButtonInteraction | ChatInputCommandInteraction, sessionId: string | null) => {
    if (currentState.session) {
        if (sessionId !== null && currentState.session.sessionId !== sessionId) {
            await interaction.reply({
                content: `Outdated button`,
                ephemeral: true,
            })

            return
        }
        await currentState.session.do(async () => {
            currentState.session.stopRecordingByUser(interaction.user.id)

            await interaction.reply({
                content: `Stopped by your command`,
                ephemeral: true,
            })

            updateState({ session: null })
        })
        return
    }

    await interaction.reply({
        content: `I think I wasn't recording, but might be wrong`,
        ephemeral: true,
    })
}

const handleScreenshotRequest = async (interaction: ChatInputCommandInteraction<CacheType>) => {
    await interaction.deferReply({ ephemeral: true })
    const page = currentState.session?.page
    if (!page) {
        await interaction.followUp({
            content: 'No session is running',
            ephemeral: true
        });
        return
    }

    const screenshotData = await page.screenshot({ captureBeyondViewport: true, fullPage: true, type: 'jpeg' })


    const attachment = new AttachmentBuilder(screenshotData);

    await interaction.followUp({
        content: 'Here you are',
        files: [attachment],
        ephemeral: true
    });
}

const handleRecordRequest = async (interaction: ChatInputCommandInteraction<CacheType>) => {
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

    const runningWebex = await fillCaptchaAndJoin(session, captcha)
    session.assertActive()
    await session.startRecording()
    session.setRecordingTimeout(MAX_MEETING_DURATION_MINUTES)

    session.addMeetingClosedMonitor(async () => await runningWebex.isMeetingStopped() ? 'closed' : null)
}

