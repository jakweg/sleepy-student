import { spawn as nodeSpawn, spawnSync } from "child_process";
import { unlinkSync, writeFileSync } from "fs";
import process from "process";
import { initPlayer } from "./barka-player";
import { launch as launchBrowser } from "./browser";
import { HEIGHT, WIDTH } from "./config";
import { launch as launchDiscord } from "./discord-stuff";
import { spawn } from "./process";
import { initScheduler } from "./scheduler";
import { sleep } from "./utils";``

try {
  spawnSync("rm", ["/run/pulse", "-rf"], { stdio: "ignore" });
} catch (e) {
  void e;
}
try {
  spawnSync("rm", ["/tmp/pulse-*", "-rf"], { stdio: "ignore" });
} catch (e) {
  void e;
}
// Dunno if its needed, but with this **** somehow works
try {
  spawnSync("rm", ["/var/run/pulse", "-rf"], { stdio: "ignore" });
} catch (e) {
  void e;
}
try {
  spawnSync("rm", ["/var/lib/pulse", "-rf"], { stdio: "ignore" });
} catch (e) {
  void e;
}
try {
  spawnSync("rm", ["/root/.config/pulse", "-rf"], { stdio: "ignore" });
} catch (e) {
  void e;
}
writeFileSync("/etc/pulse/daemon.conf", "use-pid-file=no");
try {
  spawnSync("pulseaudio", ["-k"], { stdio: "ignore" });
} catch (e) {
  void e;
}
spawn(["pulseaudio", "-D", "--exit-idle-time=-1"]);

try {
  try {
    unlinkSync("/tmp/.X1-lock");
  } catch (_) {}
  const displayProcess = nodeSpawn(
    "Xvfb",
    [":1", "-screen", "0", `${WIDTH}x${HEIGHT}x16`],
    { stdio: "inherit" }
  );
  process.addListener("exit", () => {
    displayProcess.kill(15);
    unlinkSync("/tmp/.X1-lock");
  });
} catch (e) {}

const load = () => Promise.all([launchBrowser(), launchDiscord()]);

export let [BROWSER, DISCORD]: Awaited<ReturnType<typeof load>> = [
  undefined,
  undefined,
];

load().then((r) => {
  BROWSER = r[0];
  DISCORD = r[1];
});

(async () => {
  while (!DISCORD) await sleep(500);
  initScheduler();
  initPlayer();
})();
