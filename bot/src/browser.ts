import { stat } from "fs/promises";
import * as puppeteer from "puppeteer";
import { HEIGHT, WIDTH } from "./config";
import { sleep } from "./utils";

export const launch = async () => {
  let browserPath: string | undefined = "/usr/bin/google-chrome-stable";
  try {
    if (!(await stat(browserPath)).isFile()) browserPath = undefined;
  } catch (_) {
    browserPath = undefined;
  }
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: browserPath,
    product: "chrome",
    defaultViewport: null,
    ignoreDefaultArgs: ["--mute-audio", "--enable-automation"],
    env: {
      DISPLAY: ":1",
    },
    args: [
      "--kiosk",
      "--disable-remote-fonts",
      "--start-maximized",
      "--start-fullscreen",
      "--disable-infobars",
      `--window-size=${WIDTH},${HEIGHT}`,
      "--no-sandbox",
      "--autoplay-policy=no-user-gesture-required",
    ].filter((e) => typeof e === "string") as string[],
  });

  const page = await browser.newPage();
  await page.goto("chrome://settings/passwords", {
    waitUntil: "networkidle2",
  });
  await page.evaluate(() =>
    (
      document
        .querySelector("body > settings-ui")
        .shadowRoot.querySelector("#main")
        .shadowRoot.querySelector("settings-basic-page")
        .shadowRoot.querySelector(
          "#basicPage > settings-section.expanded > settings-autofill-page"
        )
        .shadowRoot.querySelector("#passwordSection")
        .shadowRoot.querySelector("#passwordToggle")
        .shadowRoot.querySelector("#control") as any
    )?.click()
  );
  await sleep(500);
  await page.close();

  return browser;
};
