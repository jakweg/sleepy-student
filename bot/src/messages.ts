import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, MessageCreateOptions } from "discord.js";
import { RECORDING_READY_URL_FORMAT } from "./config";
import { ScheduledRecording } from "./db";
import { RecordingState } from "./session";

const fatalError = (entry: ScheduledRecording, error: string): MessageCreateOptions => {
    return {
        content: `Tried joining ${entry.type} \`${entry.id}\`, but failed: ${error}`,
        components: [new ActionRowBuilder()
            .addComponents(new ButtonBuilder()
                .setURL(entry.url)
                .setLabel(`Enter the meeting yourself`)
                .setStyle(ButtonStyle.Link)) as any
        ],
    }
}

const fromState = (entry: ScheduledRecording, sessionId: string, recording: RecordingState): MessageCreateOptions => {
    let content = ``
    const buttons: ButtonBuilder[] = []

    if (!recording) {
        content += `Hey <@${entry.scheduledBy}>! Joining ${entry.type} for scheduled meeting ${entry.name || 'unnamed'} (\`${entry.id}\`)\n`
    } else if (recording.status === 'running') {
        content += `I'm currently recording ${entry.name || 'unnamed'} (\`${entry.id}\`)\n`
    } else {
        content += `Meeting \`${entry.name || 'unnamed'}\` has finished\n`
    }

    if (!recording || recording.status === 'running') {
        buttons.push(new ButtonBuilder()
            .setURL(entry.url)
            .setLabel(`Enter the meeting yourself`)
            .setStyle(ButtonStyle.Link))
    }

    if (!recording && entry.type === 'webex')
        content += 'May need your help with captcha\n'

    if (recording && recording.status === 'running') {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`stop-recording#${sessionId}`)
                .setLabel(`Stop the recording`)
                .setStyle(ButtonStyle.Danger)
        )
    }

    if (recording && recording.stopped && recording.status !== 'running') {
        switch (recording.stopped.type) {
            case 'by':
                content += `Recording has been stopped by <@${recording.stopped.by}>\n`
                break
            case 'timeout':
                content += `Recording has been stopped automatically after ${recording.stopped.afterMinutes} minutes\n`
                break
            case 'meeting-closed':
                content += `Recording was stopped, because meeting also closed\n`
                break
            default:
                content += `Recording was stopped for no reason\n`
                break
        }
    }

    if (recording && recording.stopped && recording.status === 'stopped') {
        content += `File will be available soon, as it's now being processed\n`
    }

    if (recording && recording.readyFilename && recording.status === 'ready') {
        content += 'You can watch the recording now'
        if (RECORDING_READY_URL_FORMAT)
            buttons.push(new ButtonBuilder()
                .setURL(`${RECORDING_READY_URL_FORMAT.replace('%name%', encodeURIComponent(recording.readyFilename))}`)
                .setLabel(`Watch the recording`)
                .setStyle(ButtonStyle.Link))
    }


    if (recording && recording.status === 'ready') {
        buttons.push(new ButtonBuilder()
            .setCustomId(`schedule-next-week#${entry.id}`)
            .setLabel(`Schedule the same meeting next week`)
            .setStyle(ButtonStyle.Success))
    }

    return {
        content,
        components: [
            buttons.length && new ActionRowBuilder<ButtonBuilder>()
                .addComponents(...buttons),
        ].filter(e => typeof e !== 'boolean'),
    }
}

const captcha = (sessionId: string, imageData: Buffer): MessageCreateOptions => {
    const attachment = new AttachmentBuilder(imageData)

    return {
        content: 'Please anyone, help me with this!',
        files: [attachment],
        components: [new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`solve-captcha-scheduled-button#${sessionId}`)
                    .setLabel(`I'm the hero today`)
                    .setStyle(ButtonStyle.Primary),
            ) as any],
    }
}

export default { fatalError, fromState, captcha }