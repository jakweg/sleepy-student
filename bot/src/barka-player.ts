import {
  NoSubscriberBehavior,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
} from "@discordjs/voice";
import { VoiceBasedChannel } from "discord.js";
import { BARKA_CHANNEL_ID, BARKA_DURATION } from "./config";
import { DISCORD } from "./main";

const scheduleNextBarka = (channel: VoiceBasedChannel) => {
  const now = new Date();
  const target = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    21,
    37
  );
  let millisToSleep = target.getTime() - now.getTime();
  if (millisToSleep < 0) {
    millisToSleep += 24 * 60 * 60 * 1000;
  }

  setTimeout(() => {
    const resource = createAudioResource("./assets/barka.mp3");
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guildId,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    connection.once(VoiceConnectionStatus.Ready, () => {
      const player = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Play,
        },
      });
      resource.audioPlayer?.stop(true);
      player.play(resource);
      connection.subscribe(player);
      setTimeout(() => {
        try {
          player.stop(true);
          resource?.audioPlayer?.stop(true);
        } catch (_) {}
        try {
          connection.disconnect();
          connection.destroy();
        } catch (_) {}
        scheduleNextBarka(channel);
      }, BARKA_DURATION * 1000);
    });
  }, millisToSleep);
};

export const initPlayer = async () => {
  if (!BARKA_CHANNEL_ID) return;
  const channel = await DISCORD.channels.fetch(BARKA_CHANNEL_ID);
  if (channel.isVoiceBased() && channel.joinable) {
    scheduleNextBarka(channel);
  }
};
