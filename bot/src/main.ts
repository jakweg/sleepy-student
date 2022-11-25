import {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import { launch as launchBrowser } from "./browser";
import { launch as launchDiscord } from "./discord-stuff";
import { initScheduler } from "./scheduler";

// try {
//   spawnSync("rm", ["/run/pulse", "-rf"], { stdio: "ignore" });
// } catch (e) {
//   void e;
// }
// try {
//   spawnSync("rm", ["/tmp/pulse-*", "-rf"], { stdio: "ignore" });
// } catch (e) {
//   void e;
// }
// await writeFile("/etc/pulse/daemon.conf", "use-pid-file=no");
// try {
//   spawnSync("pulseaudio", ["-k"], { stdio: "ignore" });
// } catch (e) {
//   void e;
// }
// spawn(["pulseaudio", "-D"]);

// try {
//   try {
//     await unlink("/tmp/.X1-lock");
//   } catch (_) {}
//   const displayProcess = nodeSpawn(
//     "Xvfb",
//     [":1", "-screen", "0", `${WIDTH}x${HEIGHT}x16`],
//     { stdio: "inherit" }
//   );
//   process.addListener("exit", () => {
//     displayProcess.kill(15);
//     unlink("/tmp/.X1-lock");
//   });
// } catch (e) {}

// await sleep(500);

export const [BROWSER, DISCORD] = await Promise.all([
  launchBrowser(),
  launchDiscord(),
]);

initScheduler();

const channel = await DISCORD.channels.fetch("992098813248553065");
if (channel.isVoiceBased() && channel.joinable) {
  const resource = createAudioResource("./assets/barka.mp3");

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guildId,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfMute: false,
    selfDeaf: true,
    debug: true,
  });
  console.log("before");

  connection.on(VoiceConnectionStatus.Destroyed, () =>
    console.log("destoryed")
  );
  connection.on(VoiceConnectionStatus.Connecting, () =>
    console.log("connecting")
  );
  connection.on(VoiceConnectionStatus.Signalling, () =>
    console.log("signalling")
  );
  connection.on(VoiceConnectionStatus.Disconnected, () =>
    console.log("disconnected")
  );
  connection.on(VoiceConnectionStatus.Ready, () => {
    console.log("ready");

    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
      },
    });
    player.play(resource);
    connection.subscribe(player);
    console.log("connected");
  });
}
