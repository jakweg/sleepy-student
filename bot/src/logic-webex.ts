import cp from "child_process";
import { ElementHandle, Page } from "puppeteer";
import { RECORDINGS_PATH, WEBEX_MAIL, WEBEX_NAME } from "./config";
import { WebexSession } from "./session";
import { clearInput, randomizeLettersCase, sleep } from "./utils";

export const createWebexSession = async (
  page: Page,
  url: string
): Promise<{ captchaImage: Buffer | "not-needed" }> => {
  url = url.replace("launchApp=true", "");
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36"
  );
  await page
    .browserContext()
    .overridePermissions(url, ["microphone", "camera"]);
  await page.goto(url, { waitUntil: "domcontentloaded" });

  await sleep(100)
    .then(() =>
      page.waitForSelector(".cookie-banner-btnContainer button", {
        timeout: 1000,
      })
    )
    .then((e) => e.click())
    .catch((e) => void e);

  try {
    await (
      await page.waitForSelector("#push_download_join_by_browser", {
        timeout: 5000,
      })
    ).click();
  } catch (e) {}

  try {
    const handle = await page.waitForXPath(
      `//a[@id="push_download_detect_link"][contains(., 'Join from your browser')]`,
      {
        timeout: 100,
      }
    );
    await (handle as any).click();
    await sleep(1000);

    await page.evaluate((e: any) => {
      (e as any).click();
      return (e as any).textContent;
    }, handle);
  } catch (e) {
    console.error(e);
  }

  try {
    const btn = await (
      await page.waitForFrame((f) =>
        f.url().startsWith("https://web.webex.com/meeting")
      )
    ).waitForSelector(
      `[data-test="auth-crosslaunch-meeting-start-guest-join-button"]`,
      {
        timeout: 10000,
      }
    );
    await btn.evaluateHandle((e) => (e as any).click());
  } catch (e) {
    console.error(e);
  }

  const getCaptchaImage = async (): Promise<Buffer | "not-needed"> => {
    for (let i = 0; i < 10; ++i) {
      const img = (
        await Promise.all(
          page.frames().map((e) => e.$(`[alt="Captcha image"]`))
        )
      ).find((e) => e);
      if (img) {
        await sleep(1000);
        return (await img.screenshot({
          captureBeyondViewport: true,
          type: "png",
        })) as Buffer;
      }

      const nameInput = (
        await Promise.all(
          page.frames().map((e) => e.$('[placeholder="Email address"]'))
        )
      ).find((e) => e);
      if (nameInput) return "not-needed";

      await sleep(1000);
    }
    await page.screenshot({
      captureBeyondViewport: true,
      path: `${RECORDINGS_PATH}/debug.png`,
    });
    throw new Error("Failed to get verification image");
  };

  await sleep(1000);
  const buffer = await getCaptchaImage();
  return { captchaImage: buffer };
};

export const fillCaptchaAndJoin = async (
  session: WebexSession,
  captcha: string | null
): Promise<{ isMeetingStopped: () => Promise<boolean> } | Buffer> => {
  session.assertActive();
  const page = session.page;
  let frameIndex = (
    await Promise.all(page.frames().map((e) => e.$(`[aria-label="Next"]`)))
  ).findIndex((e) => e);
  let frame = page.frames()[frameIndex];
  if (!frame) throw new Error("missing inputs frame");

  session.assertActive();
  const results = (await frame.$$(
    ".login-layout-body input"
  )) as ElementHandle<HTMLInputElement>[];
  if (!results) throw new Error("missing inputs");
  const placeholders = await Promise.all(
    results.map((i) => i.getProperty("placeholder").then((e) => e.jsonValue()))
  );
  for (let i = 0; i < 10; ++i) {
    cp.execSync("xdotool key Escape", {
      env: { DISPLAY: ":1" },
    });
    await sleep(100);
  }

  await page.focus("body");
  await sleep(300);
  const name = results.find((e, i) => placeholders[i].includes("name"));
  if (!name) throw new Error("missing name input");

  await name.focus();
  await clearInput(name);
  for (const c of randomizeLettersCase(WEBEX_NAME)) {
    await sleep(Math.random() * 300 + 300);
    await page.keyboard.type(c);
    // cp.execSync("xdotool key " + c.substring(0, 1), { env: { DISPLAY: ":1" } });
    // await name.type(c);
  }

  const mail = results.find((e, i) => placeholders[i].includes("mail"));
  //   if (!mail) throw new Error("missing mail input");
  if (!mail) console.warn("missing mail input");
  else {
    session.assertActive();
    await sleep(Math.random() * 500 + 100);
    await mail.focus();
    await clearInput(mail);

    for (const c of WEBEX_MAIL) {
      await sleep(Math.random() * 300 + 300);
      await page.keyboard.type(c);
      //   cp.execSync("xdotool key " + c.substring(0, 1), {
      //     env: { DISPLAY: ":1" },
      //   });
      //   await mail.type(c);
    }
  }

  const characters = results.find((e, i) =>
    placeholders[i].includes("text in the image")
  );
  if (!characters) throw new Error("missing captcha input");
  if (characters && captcha) {
    await characters.focus();
    await clearInput(characters);
    await sleep(Math.random() * 500 + 100);
    for (const c of captcha) {
      await sleep(Math.random() * 300 + 300);
      await page.keyboard.type(c);
      //   cp.execSync("xdotool key " + c.substring(0, 1), {
      //     env: { DISPLAY: ":1" },
      //   });
      //   await characters.type(c);
    }
  }
  await sleep(300);
  session.assertActive();
  await frame.click(`[aria-label="Next"]`);
  const parentFrame = frame;

  for (let i = 0; i < 20; ++i) {
    frameIndex = (
      await Promise.all(
        page.frames().map((e) => e.$('[aria-label="Join meeting"]'))
      )
    ).findIndex((e) => e);
    frame = page.frames()[frameIndex];
    if (frame) break;

    if (await parentFrame.$('[aria-label="Next"][aria-disabled="true"]')) {
      const img = (
        await Promise.all(
          page.frames().map((e) => e.$(`[alt="Captcha image"]`))
        )
      ).find((e) => e);
      if (img) {
        await sleep(3000);
        try {
          return (await img.screenshot({
            captureBeyondViewport: true,
            type: "png",
          })) as Buffer;
        } catch (e) {
          // ignore
        }
      }
    }

    await sleep(1000);
  }
  session.assertActive();
  if (!frame) throw new Error("missing join button");

  await frame.click('[aria-label="Join meeting"]');
  await sleep(500);
  session.assertActive();
  try {
    await frame.click('[aria-label="Join meeting"]');
  } catch (e) {}

  const waitToBeJoined = async () => {
    while (true) {
      const isWaiting = await frame.evaluate(
        () => !!document.getElementById(`remote_stream_placeholder_message`)
      );
      if (!isWaiting) return;

      session.assertActive();
      await sleep(1000);
    }
  };

  await waitToBeJoined();

  session.assertActive();

  frame
    .waitForSelector('[title="Got it"]', { timeout: 5000 })
    .then((e) => e.click())
    .catch((e) => void e);

  sleep(6000)
    .then(() => frame.waitForSelector('[title="Got it"]', { timeout: 0 }))
    .then((e) => e.click())
    .catch((e) => void e);

  sleep(10000)
    .then(() =>
      Promise.all(
        page.frames().map((e) => e.$('[aria-label="Hide control bar"]'))
      )
    )
    .then((e) => e.find((e) => !!e).click())
    .catch((e) => void e);

  sleep(10000)
    .then(() =>
      Promise.all(
        page
          .frames()
          .map((e) =>
            e.evaluate(() =>
              [...document.querySelectorAll("button")]
                .find((e) => e.textContent.includes("Reject"))
                ?.click()
            )
          )
      )
    )
    .catch((e) => void e);

  sleep(10000)
    .then(() =>
      Promise.all(
        page
          .frames()
          .map((e) =>
            e.evaluate(() =>
              document
                .querySelector(`[data-test="call_controls_wrap"]`)
                ?.remove()
            )
          )
      )
    )
    .catch((e) => void e);
  //   sleep(10000)
  //     .then(() =>
  //       Promise.all(
  //         page
  //           .frames()
  //           .map((e) =>
  //             e.evaluate(() =>
  //               document
  //                 .querySelector(`[data-test="grid-layout"]`)
  //                 ?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.remove()
  //             )
  //           )
  //       )
  //     )
  //     .catch((e) => void e);

  sleep(10000)
    .then(() =>
      frame.waitForSelector('[aria-label*="close"]', { timeout: 5000 })
    )
    .then((e) => e.click())
    .catch((e) => void e);

  return {
    isMeetingStopped: async () =>
      !!(await frame.evaluate(() =>
        document.body.textContent.includes("The meeting has ended.")
      )),
  };
};
