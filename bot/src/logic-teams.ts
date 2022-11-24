import { Page } from "puppeteer";
import {
  MS_TEAMS_CREDENTIALS_LOGIN,
  MS_TEAMS_CREDENTIALS_ORIGINS,
  MS_TEAMS_CREDENTIALS_PASSWORD,
} from "./config";
import Session from "./session";
import { sleep } from "./utils";

const requireOriginForCredentials = (page: Page) => {
  const url = page.url();
  const origin = new URL(url).origin;
  if (!MS_TEAMS_CREDENTIALS_ORIGINS.includes(origin))
    throw new Error(`Origin ${origin} not permitted to enter credentials`);
};

export const startTeamsSession = async (url: string, session: Session) => {
  const page = session.page;

  session.assertActive();
  await page
    .browserContext()
    .overridePermissions(url, ["microphone", "camera"]);
  await page.goto(url, { waitUntil: "networkidle2" });
  session.assertActive();

  let willLogin = true;
  try {
    await page.waitForSelector("input[type=email]");
  } catch (e) {
    willLogin = false;
    await page.waitForSelector("#ts-waffle-button");
  }
  if (willLogin) {
    await page.waitForSelector("input[type=email]");
    requireOriginForCredentials(page);
    await page.type("input[type=email]", MS_TEAMS_CREDENTIALS_LOGIN!, {
      delay: 20,
    });
    await page.keyboard.press("Enter", { delay: 100 });
    await page.waitForSelector("input[type=password]", {
      timeout: 20_000,
      hidden: true,
    });
    await page.waitForSelector("input[type=password]", { timeout: 20_000 });
    await page.waitForSelector("input[type=text]", { timeout: 20_000 });

    session.assertActive();
    await page.evaluate(
      () =>
        ((
          (document.querySelector("input[type=email]") as HTMLInputElement) || {
            value: "",
          }
        ).value = "")
    );
    requireOriginForCredentials(page);
    try {
      await page.type("input[type=email]", MS_TEAMS_CREDENTIALS_LOGIN!, {
        delay: 20,
      });
    } catch (e) {}
    requireOriginForCredentials(page);
    try {
      await page.type("input[type=text]", MS_TEAMS_CREDENTIALS_LOGIN!, {
        delay: 20,
      });
    } catch (e) {}
    requireOriginForCredentials(page);
    await page.type("input[type=password]", MS_TEAMS_CREDENTIALS_PASSWORD!, {
      delay: 20,
    });
    await page.keyboard.press("Enter", { delay: 100 });
    await page.waitForSelector("input[type=submit]", { hidden: true });
    await page.waitForSelector("input[type=submit]", { timeout: 20_000 });
    requireOriginForCredentials(page);
    await page.click("input[type=submit]");
    await sleep(10_000);
    session.assertActive();
  }

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await sleep(3_000);

  session.assertActive();
  try {
    await page.waitForSelector("button[type=button].icons-call-jump-in", {
      timeout: 60_000,
    });
  } catch (e) {
    console.warn("Failed to find join button, trying loading page again");

    await page.goto("about:blank", { waitUntil: "domcontentloaded" });
    await sleep(500);
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // await page.click('.btn-group.app-tabs-list-item:not(.app-tabs-selected)')
    // await sleep(2000)
    // await page.click('.btn-group.app-tabs-list-item:not(.app-tabs-selected)')
    // await sleep(2000)
    // await page.click('.start-meetup')
    // await sleep(5000)
    // await page.waitForSelector('#leave-calling-pre-join')
    // await page.click('#leave-calling-pre-join')
    // page.screenshot({ path: '/recordings/debug2.png', })

    try {
      await page.waitForSelector("button[type=button].icons-call-jump-in", {
        timeout: 60_000,
      });
    } catch (e) {
      console.warn("Failed to find join button, trying loading page again");

      await page.goto("about:blank", { waitUntil: "domcontentloaded" });
      await sleep(500);
      await page.goto(url, { waitUntil: "domcontentloaded" });

      await page.waitForSelector("button[type=button].icons-call-jump-in", {
        timeout: 60_000,
      });
    }
  }
  await page.click("button[type=button].icons-call-jump-in");

  let frame = page.frames().find((e) => e.name().includes("experience"));
  while (!frame) {
    await sleep(1000);
    frame = page.frames().find((e) => e.name().includes("experience"));
  }

  await frame.waitForSelector("#prejoin-join-button", {
    timeout: 10_000,
  });
  session.assertActive();
  await frame.click("#prejoin-join-button");

  try {
    await frame.waitForSelector("#prejoin-join-button", {
      timeout: 10_000,
      hidden: true,
    });
  } catch (e) {
    await frame.click("#prejoin-join-button");
  }

  const micButton = await frame.waitForSelector("#microphone-button", {
    timeout: 60_000,
  });
  const needsMute = await micButton.evaluate(
    (element) => !element.getAttribute("aria-label")?.includes("Unmute")
  );
  session.assertActive();
  if (needsMute) await frame.click("#microphone-button");

  sleep(18_000)
    .then(() =>
      frame.waitForSelector(
        '[data-tid="callingAlertDismissButton_DeviceCaptureMute"]',
        {
          timeout: 0,
        }
      )
    )
    .then((e) => e.click())
    .catch((e) => void e);

  sleep(15_000)
    .then(() =>
      frame.waitForSelector(
        '[data-tid="callingAlertDismissButton_JoinersOngoingRecording"]',
        {
          timeout: 0,
        }
      )
    )
    .then((e) => e.click())
    .catch((e) => void e);

  sleep(19_000)
    .then(() =>
      frame.waitForSelector(
        '[data-tid="callingAlertDismissButton_NoAvailableMicrophone"]',
        {
          timeout: 0,
        }
      )
    )
    .then((e) => e.click())
    .catch((e) => void e);
};

export const observeMeetingClosedState = (page: Page) => {
  const frame = page.frames().find((e) => e.name().includes("experience"));
  let finished = false;
  let shouldBeClosed = false;

  sleep(1_000)
    .then(async () => {
      (await frame.waitForSelector("#roster-button", { timeout: 0 })).click();
      await sleep(100);

      (await frame.waitForSelector("#roster-button", { timeout: 0 })).click();

      await frame.waitForSelector("#roster-title-section-2", { timeout: 0 });

      const getParticipantsCount = () =>
        frame.evaluate(() => {
          const text =
            document
              .querySelector("#roster-title-section-2")
              ?.textContent?.replace("(", "")
              ?.replace(")", "") ?? "";
          return parseInt(text.substring(1 + text.lastIndexOf(" ")), 10);
        });

      let top = 0;
      const LEAVE_WHEN_TOP_COUNT_BELOW = 0.4;
      const MIN_TOP_PARTICIPANTS_TO_LEAVE = 5;

      while (true) {
        const participantsCount = await getParticipantsCount();

        if (participantsCount > top) {
          top = participantsCount;
        } else if (
          top >= MIN_TOP_PARTICIPANTS_TO_LEAVE &&
          participantsCount < top * LEAVE_WHEN_TOP_COUNT_BELOW
        ) {
          // should leave
          shouldBeClosed = true;
          return;
        }
        if (finished || shouldBeClosed) return;
        await sleep(5_000);
      }
    })
    .catch((e) => console.error(e));

  const originalUrl = page.url();
  return {
    checkStatus: async (page: Page) => {
      if (shouldBeClosed) return "lost-participants";

      if (
        (await page.$('form[name="retryForm"]')) ||
        (await frame.$('form[name="retryForm"]')) ||
        originalUrl !== page.url()
      ) {
        finished = true;
        return "closed";
      }

      return null;
    },
  };
};
