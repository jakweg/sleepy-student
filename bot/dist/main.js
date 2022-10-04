// src/main.ts
import * as puppeteer from "puppeteer";
import { PuppeteerScreenRecorder } from "puppeteer-screen-recorder";
var browser = await puppeteer.launch({
  headless: true,
  defaultViewport: {
    width: 1280,
    height: 720
  }
});
var page = (await browser.pages())[0] ?? await browser.newPage();
var recordPage = async (url) => {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const recorder = new PuppeteerScreenRecorder(page, {
    followNewTab: false,
    fps: 5,
    ffmpeg_Path: null,
    videoFrame: {
      width: 1280,
      height: 720
    },
    autopad: {
      color: "black"
    },
    aspectRatio: "16:9"
  });
  await recorder.start("hello.mp4");
  try {
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    await page.evaluate(async () => {
      for (let i = 0; i < 10; ++i) {
        const btn = [...document.querySelectorAll("a")].filter((e) => e?.textContent?.includes("Reject all"))[0];
        if (btn) {
          btn.click();
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1e3));
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 5e3));
  } finally {
    await recorder.stop();
  }
};
await recordPage("https://www.youtube.com/watch?v=Kf-fMjV7Tio");
await browser.close();
