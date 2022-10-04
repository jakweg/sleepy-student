import { spawn, spawnSync } from 'child_process';
import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, Client, ModalBuilder, REST, Routes, SlashCommandBuilder, SlashCommandStringOption, TextInputBuilder, TextInputStyle } from 'discord.js';
import * as dotenv from 'dotenv';
import * as puppeteer from 'puppeteer';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';
dotenv.config()

try { spawnSync('pulseaudio', ['-D']) } catch (e) { void e }
const client = new Client({
    intents: [
        'DirectMessages', 'Guilds', 'GuildMessages'
    ]
})

await client.login(process.env.DISCORD_TOKEN)

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
rest.put(Routes.applicationCommands(process.env.APPLICATION_ID!), {
    body: [
        new SlashCommandBuilder()
            .setName('record')
            .setDescription('Requests the bot to record a session')
            .addStringOption(new SlashCommandStringOption()
                .setName('url')
                .setDescription('Link to meeting')
                .setRequired(true)),
        new SlashCommandBuilder()
            .setName('stop')
            .setDescription('Requests the bot to stop the recording')
    ].map(e => e.toJSON())
})

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration))

const RECORDINGS_PATH = '/recordings/'
const WIDTH = 1280
const HEIGHT = 720

const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome-stable',
    product: 'chrome',
    defaultViewport: {
        width: WIDTH,
        height: HEIGHT,
    },
    ignoreDefaultArgs: [
        "--mute-audio",
    ],
    args: [
        '--no-sandbox',
        "--autoplay-policy=no-user-gesture-required",
    ],
});
const page = (await browser.pages())[0] ?? await browser.newPage()

const joinWebexMeetingAndGetCaptcha = async (url: string) => {
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36')
    await page.browserContext().overridePermissions(url, ['microphone', 'camera'])
    await page.goto(url, { waitUntil: 'domcontentloaded' })

    try {
        await page.waitForSelector('#push_download_join_by_browser')
        await page.click('#push_download_join_by_browser')
    } catch (e) {
    }

    const getCaptchaImage = async () => {
        for (let i = 0; i < 10; ++i) {
            const img = (await Promise.all((page.frames()).map(e => e.$('#verificationImage')))).find(e => e)
            if (img) return await img.screenshot({ captureBeyondViewport: true, type: 'png' })
            await sleep(1000)
        } throw new Error('Failed to get verification image')
    }

    await sleep(1000)
    const buffer = await getCaptchaImage()
    return buffer
}

let recordingStopper: (() => void) | null = null

const followWithCaptchaForWebex = async (captcha: string) => {
    let frameIndex = (await Promise.all(page.frames().map(e => e.$('#guest_next-btn')))).findIndex(e => e)
    let frame = page.frames()[frameIndex]
    if (!frame) return console.warn('missing inputs frame')

    const results = await frame.$$('#meetingSimpleContainer input')
    if (!results) return console.warn('missing inputs')

    await page.focus('body')
    await sleep(1000)
    const [name, _, characters] = results
    for (const c of 'Andrzej') {
        await sleep(Math.random() * 300 + 300)
        await name.type(c)
    }

    await sleep(Math.random() * 500 + 500)
    for (const c of captcha) {
        await sleep(Math.random() * 300 + 300)
        await characters.type(c)
    }
    await sleep(1000)
    await frame.click('#guest_next-btn')

    await sleep(5000)

    frameIndex = (await Promise.all(page.frames().map(e => e.$('[data-doi="MEETING:JOIN_MEETING:MEETSIMPLE_INTERSTITIAL"]')))).findIndex(e => e)
    frame = page.frames()[frameIndex]
    if (!frame) return console.warn('missing join button')
    try { await frame.click('[data-doi="AUDIO:MUTE_SELF:MEETSIMPLE_INTERSTITIAL"]'); await sleep(500) } catch (e) { }
    try { await frame.click('[data-doi="VIDEO:STOP_VIDEO:MEETSIMPLE_INTERSTITIAL"]'); await sleep(500) } catch (e) { }
    await sleep(1000)
    await frame.click('[data-doi="MEETING:JOIN_MEETING:MEETSIMPLE_INTERSTITIAL"]'); await sleep(500)
    try { await frame.click('[data-doi="VIDEO:JOIN_MEETING:MEETSIMPLE_INTERSTITIAL"]'); } catch (e) { }

    const waitToBeJoined = async () => {
        for (let i = 0; i < 120; ++i) {
            if (await frame.$('[data-doi="PARTICIPANT:OPEN_PARTICIPANT_PANEL:MENU_CONTROL_BAR"]')) {
                await sleep(1000)
                return
            }
            await sleep(1000)
        }
        throw new Error('timeout waitToBeJoined')
    }

    await waitToBeJoined()

    try {
        await frame.waitForSelector('[title="Got it"]')
        await frame.click('[title="Got it"]')
    } catch (e) {
    }

    const recorder = new PuppeteerScreenRecorder(page, {
        followNewTab: false,
        fps: 60,
        ffmpeg_Path: null,
        videoFrame: {
            width: WIDTH,
            height: HEIGHT,
        },
        autopad: {
            color: 'black',
        },
        aspectRatio: '16:9',
    })

    console.log('starting recording');

    await recorder.start(RECORDINGS_PATH + '/current-video.mp4')
    const audioRecording = spawn('ffmpeg', ['-f', 'pulse', '-i', 'auto_null.monitor', '-y', RECORDINGS_PATH + '/current-audio.m4a'])

    recordingStopper = async () => {
        await recorder.stop()
        audioRecording.kill(15)

        const finalPath = RECORDINGS_PATH + `/combined-${new Date().toJSON().replace(':', '-')}.mp4`

        const merger = spawn('ffmpeg', ['-i',
            RECORDINGS_PATH + '/current-video.mp4',
            '-i', RECORDINGS_PATH + '/current-audio.m4a', '-c:v', 'copy', '-y', '-c:a', 'aac',
            finalPath])

        merger.once('close', () => {
            console.log('recording merged!', finalPath);
        })
        await page.goto('about:blank', { waitUntil: 'networkidle2' })
    }
}

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'stop') {
            recordingStopper?.()

            interaction.reply({
                content: 'Stopped!',
                ephemeral: true,
            })

        } else if (commandName === 'record') {
            const url = interaction.options.getString('url')!

            await interaction.reply({
                content: 'OK, I am joining!',
                ephemeral: true,
            })

            const image = await joinWebexMeetingAndGetCaptcha(url)
            const attachment = new AttachmentBuilder(image);

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('solve-captcha-button')
                        .setLabel(`I'm ready`)
                        .setStyle(ButtonStyle.Primary),
                );

            interaction.followUp({
                content: 'Please solve this captcha',
                files: [attachment],
                components: [row as any],
                ephemeral: true
            });
        }
    } else if (interaction.isButton()) {
        const { customId } = interaction
        if (customId === 'solve-captcha-button') {
            const modal = new ModalBuilder()
                .setCustomId('captcha-modal')
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

            result.reply({
                ephemeral: true,
                content: 'Thanks!',
            })

            followWithCaptchaForWebex(captcha)
        }
    }
});