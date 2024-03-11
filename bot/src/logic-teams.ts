import { Page } from "puppeteer";
import {
  MS_TEAMS_CREDENTIALS_LOGIN,
  MS_TEAMS_CREDENTIALS_ORIGINS,
  MS_TEAMS_CREDENTIALS_PASSWORD,
  WEBEX_NAME,
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
    await page.waitForSelector("input[type=email]", { timeout: 10 * 1000 });
  } catch (e) {
    willLogin = false;
    try {
      const link = await page
        .waitForSelector('a[aria-label="Select to sign-in"],[data-tid="auth-sign-in-link"]', {
          timeout: 5 * 1000,
        })
        .catch(async () =>
        {
          const html = await page.evaluate(() => document.body.innerHTML)
          console.log({html})
          return Promise.any(
            page
              .frames()
              .map((frame) =>
                frame.waitForSelector(
                  'a[data-tid="prejoin-footer-sign-in"][data-track-action-outcome="signIn"]'
                )
              )
          )
          }
        );
      await link.click();
      // const nickInput = await page.waitForSelector('input[name="username"]#username', { timeout: 5 * 1000 })
      // await clearInput(nickInput)
      // for (const c of randomizeLettersCase(WEBEX_NAME)) {
      //   await sleep(Math.random() * 300 + 300)
      //   await nickInput.type(c)
      // }
      // page.keyboard.press('Enter');
      // nickJoined = true
      willLogin = true;
    } catch (_) {}
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
    try {
      await page.waitForSelector("input[type=submit]", { hidden: true });
      await page.waitForSelector("input[type=submit]", { timeout: 20_000 });
      requireOriginForCredentials(page);
      await page.click("input[type=submit]");
      await sleep(5_000);
    } catch (e) {
      await page.keyboard.press("Enter", { delay: 100 });
      await sleep(5_000);
    }
    session.assertActive();
  }

  await page.goto(url);
  await sleep(15_000);

  session.assertActive();
  try {
    if (!page.frames().find((e) => e.name().includes("experience")))
      await page.waitForSelector("button[type=button].icons-call-jump-in", {
        timeout: 5_000,
      });
  } catch (e) {
    if (!page.frames().find((e) => e.name().includes("experience"))) {
      console.warn("Failed to find join button, trying loading page again");

      // await page.goto("about:blank", { waitUntil: "domcontentloaded" });
      // await sleep(500);
      // await page.goto(url, { waitUntil: "domcontentloaded" });

      // // await page.click('.btn-group.app-tabs-list-item:not(.app-tabs-selected)')
      // // await sleep(2000)
      // // await page.click('.btn-group.app-tabs-list-item:not(.app-tabs-selected)')
      // // await sleep(2000)
      // // await page.click('.start-meetup')
      // // await sleep(5000)
      // // await page.waitForSelector('#leave-calling-pre-join')
      // // await page.click('#leave-calling-pre-join')
      // // page.screenshot({ path: '/recordings/debug2.png', })

      // try {
      //   await page.waitForSelector("button[type=button].icons-call-jump-in", {
      //     timeout: 60_000,
      //   });
      // } catch (e) {
      //   console.warn("Failed to find join button, trying loading page again");

      //   await page.goto("about:blank", { waitUntil: "domcontentloaded" });
      //   await sleep(500);
      //   await page.goto(url, { waitUntil: "domcontentloaded" });

      //   await page.waitForSelector("button[type=button].icons-call-jump-in", {
      //     timeout: 60_000,
      //   });
      // }
    }
  }

  try {
    await page.click("button[type=button].icons-call-jump-in");
  } catch (_) {}

  // let frame = page;
  // // .frames().find((e) => e.name().includes("experience"));
  // while (!frame) {
  //   console.log('jestem tu3');
  //   await sleep(1000); = page;
  // // .frames().find((e) => e.name().includes("experience"));
  // while (!frame) {
  //   console.log('jestem tu3');
  //   await sleep(1000);
  //   frame = page.frames().find((e) => e.name().includes("experience"));
  // }
  //   frame = page.frames().find((e) => e.name().includes("experience"));
  // }

  await page.type("input[type=text]", WEBEX_NAME!, {
    delay: 20,
  }).catch(() => void 0);

  // const micButton = await page.waitForSelector("div[title=microphone]", {
  //   timeout: 10_000,
  // });
  // const needsMute = await micButton.evaluate(
  //   (element) => !element.getAttribute("aria-checked")?.includes("true")
  // );
  // session.assertActive();
  // if (needsMute) await page.click("div[title=microphone]");

await page.waitForSelector("#prejoin-join-button", {
    timeout: 30_000,
  });
  session.assertActive();
  await page.click("#prejoin-join-button");

  try {
    await page.waitForSelector("#prejoin-join-button", {
      timeout: 31_000,
      hidden: true,
    });
  } catch (e) {
    await page.click("#prejoin-join-button");
  }

  sleep(18_000)
    .then(() =>
      page.waitForSelector(
        '[data-tid="callingAlertDismissButton_DeviceCaptureMute"]',
        {
          timeout: 0,
        }
      )
    )
    .then(async (e) => {
      e.click();
      await sleep(100);
      e.click();
    })
    .catch((e) => void e);

  sleep(26_000)
    .then(() =>
      page.waitForSelector(
        '[data-tid="callingAlertDismissButton_JoinersOngoingRecording"]',
        {
          timeout: 0,
        }
      )
    )
    .then(async (e) => {
      e.click();
      await sleep(100);
      e.click();
    })
    .catch((e) => void e);

  sleep(15_000)
    .then(() =>
      page.waitForSelector(
        '[data-tid="callingAlertDismissButton_InitiatorStartedRecording"]',
        {
          timeout: 0,
        }
      )
    )
    .then(async (e) => {
      e.click();
      await sleep(100);
      e.click();
    })
    .catch((e) => void e);

  sleep(19_000)
    .then(() =>
      page.waitForSelector(
        '[data-tid="callingAlertDismissButton_NoAvailableMicrophone"]',
        {
          timeout: 0,
        }
      )
    )
    .then(async (e) => {
      e.click();
      await sleep(100);
      e.click();
    })
    .catch((e) => void e);
};

export const observeMeetingClosedState = (page: Page) => {
  let finished = false;
  let shouldBeClosed = false;

  sleep(1_000)
    .then(async () => {
      (await page.waitForSelector("#roster-button", { timeout: 0 })).click();
      await sleep(20_000);
      (await page.waitForSelector("#roster-button", { timeout: 0 })).click();

      const getParticipantsCount = () =>
        page.evaluate(() => {
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
        originalUrl !== page.url()
      ) {
        finished = true;
        return "closed";
      }

      return null;
    },
  };
};
