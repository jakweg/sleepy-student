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
  await page.goto("chrome://password-manager/passwords", {
    waitUntil: "networkidle2",
  });
  await page.evaluate(() => {
    (
      document
        .querySelector("password-manager-app")
        .shadowRoot.querySelector("password-manager-side-bar")
        .shadowRoot.querySelector("#settings") as any
    )?.click();
    const toggle = document
      .querySelector("body > password-manager-app")
      .shadowRoot.querySelector("#settings")
      .shadowRoot.querySelector("#passwordToggle")
      .shadowRoot.querySelector("#control");

    if (toggle.getAttribute("aria-pressed") !== "false") {
      (toggle as any).click();
    }
  });
  await sleep(500);
  await page.close();

  return browser;
};
//https://meet231.webex.com/meet/pr27415595744
