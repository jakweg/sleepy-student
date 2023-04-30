import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageCreateOptions,
} from "discord.js";
import { RECORDING_READY_URL_FORMAT } from "./config";
import { ScheduledRecording } from "./db";
import intl from "./intl";
import { RecordingState } from "./session";

const fatalError = (
  entry: ScheduledRecording,
  error: string
): MessageCreateOptions => {
  return {
    content: intl.failedJoining(entry.type, error),
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setURL(entry.url)
          .setLabel(intl.ENTER_MEETING_YOURSELF)
          .setStyle(ButtonStyle.Link),
        new ButtonBuilder()
          .setCustomId(`retry-recording#${entry.id}`)
          .setLabel(intl.RETRY_FAILED_RECORDING)
          .setStyle(ButtonStyle.Secondary)
      ) as any,
    ],
  };
};

const fromState = (
  entry: ScheduledRecording,
  sessionId: string,
  recording: RecordingState
): MessageCreateOptions => {
  let contentLines: string[] = [];
  const buttons: ButtonBuilder[] = [];

  if (!recording) {
    contentLines.push(
      intl.joiningMessage(entry.scheduledBy, entry.type, entry.name)
    );
  } else if (recording.status === "running") {
    contentLines.push(intl.currentlyRecording(entry.name));
  } else {
    contentLines.push(intl.recordingFinished(entry.name));
  }

  if (!recording || recording.status === "running") {
    buttons.push(
      new ButtonBuilder()
        .setURL(entry.url)
        .setLabel(intl.ENTER_MEETING_YOURSELF)
        .setStyle(ButtonStyle.Link)
    );
  }

  if (!recording && entry.type === "webex")
    contentLines.push(intl.MAY_NEED_YOUR_HELP_WITH_CAPTCHA);

  if (recording && recording.status === "running") {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`stop-recording#${sessionId}`)
        .setLabel(intl.STOP_RECORDING)
        .setStyle(ButtonStyle.Danger)
    );
  }

  if (recording && recording.stopped && recording.status !== "running") {
    switch (recording.stopped.type) {
      case "by":
        contentLines.push(intl.recordingFinishedBy(recording.stopped.by));
        break;
      case "timeout":
        contentLines.push(
          intl.recordingFinishedTimeout(recording.stopped.afterMinutes)
        );
        break;
      case "meeting-closed":
        contentLines.push(intl.recordingFinishedClosed());
        break;
      case "lost-participants":
        contentLines.push(intl.recordingFinishedLostParticipants());
        break;
      default:
        contentLines.push(intl.recordingFinishedOther());
        break;
    }
  }

  if (recording && recording.stopped && recording.status === "stopped") {
    contentLines.push(intl.PROCESSING_RECORDING);
  }

  if (recording && recording.readyFilename && recording.status === "ready") {
    contentLines.push(intl.RECORDING_READY);
    if (RECORDING_READY_URL_FORMAT)
      buttons.push(
        new ButtonBuilder()
          .setURL(
            `${RECORDING_READY_URL_FORMAT.replace(
              "%name%",
              encodeURIComponent(recording.readyFilename)
            )}`
          )
          .setLabel(intl.WATCH_RECORDING_BUTTON)
          .setStyle(ButtonStyle.Link)
      );
  }

  if (recording && recording.status === "ready") {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`schedule-next-week#${entry.id}`)
        .setLabel(intl.SCHEDULE_NEXT_WEEK_BUTTON)
        .setStyle(ButtonStyle.Success)
    );
  }

  return {
    content: contentLines.join("\n"),
    components:
      buttons.length > 0
        ? [new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)]
        : [],
  };
};

const captcha = (
  sessionId: string,
  imageData: Buffer
): MessageCreateOptions => {
  const attachment = new AttachmentBuilder(imageData);

  return {
    content: intl.CAPTCHA_SOLVE_REQUEST,
    files: [attachment],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`solve-captcha-scheduled-button#${sessionId}`)
          .setLabel(intl.CAPTCHA_SOLVE_BUTTON)
          .setStyle(ButtonStyle.Primary)
      ) as any,
    ],
  };
};

export default { fatalError, fromState, captcha };
