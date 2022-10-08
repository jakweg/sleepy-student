import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction, Client, Interaction, ModalBuilder, REST, Routes, SlashCommandBooleanOption, SlashCommandBuilder, SlashCommandStringOption, TextInputBuilder, TextInputStyle } from "discord.js";
import { ALLOWED_CHANNELS, MS_TEAMS_CREDENTIALS_LOGIN, MS_TEAMS_CREDENTIALS_PASSWORD, RECORDINGS_PATH, RECORDING_READY_MESSAGE_FORMAT } from "./config";
import { assertActiveSession, currentState, updateState } from "./current-state";
import { startTeamsSession } from "./logic-teams";
import { createWebexSession, fillCaptchaAndJoin } from "./logic-webex";
import { startRecording } from "./recorder";

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

const handleSolveButtonClicked = async (interaction: ButtonInteraction<CacheType>, session: string) => {
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
        .setRequired(true)

    modal.addComponents(
        new ActionRowBuilder().addComponents(resultInput) as any,
    )

    await interaction.showModal(modal);
    const result = await interaction.awaitModalSubmit({ time: 0 });

    const captcha = result.fields.getTextInputValue('captcha-result')

    try { assertActiveSession(session) }
    catch (_) {
        interaction.reply({
            content: `To late :(`,
            ephemeral: true,
        })
        return
    }

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
        stopRecordingCallback: runningWebex.stop,
    })

    result.followUp({
        ephemeral: true,
        content: 'Recording started',
        components: [new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`stop-recording#${session}`)
                    .setLabel(`Stop recording`)
                    .setStyle(ButtonStyle.Primary),
            ) as any],
    })
}

const handleStopRecordingClicked = async (interaction: ButtonInteraction<CacheType> | ChatInputCommandInteraction<CacheType>, session: string | null) => {
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

    const stopCallback = currentState.stopRecordingCallback
    updateState({
        type: "idle",
        stopRecordingCallback: () => { }
    })
    await interaction.reply({
        content: `Stopped recording`,
        ephemeral: true,
    })

    stopCallback(name => {
        interaction.followUp({
            content: RECORDING_READY_MESSAGE_FORMAT.replace('%name%', name),
            ephemeral: true,
        })
    })
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
            showChat: false, url
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
        content: 'Recording started!',
        ephemeral: true,
        components: [new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`stop-recording#${session}`)
                    .setLabel(`Stop recording`)
                    .setStyle(ButtonStyle.Primary),
            ) as any],
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
        }
    } else if (interaction.isButton()) {
        const [customId, session] = interaction.customId.split('#')
        if (customId === 'solve-captcha-button') {
            handleSolveButtonClicked(interaction, session)
        } else if (customId === 'stop-recording') {
            handleStopRecordingClicked(interaction, session)
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
            .setDescription('Takes screenshot of current page')
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

