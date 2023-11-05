import { stat } from "fs/promises";
import { ElementHandle } from "puppeteer";

export const sleep = (duration: number) =>
  new Promise((resolve) => setTimeout(resolve, duration));

const ALLOWED_CHARS_IN_FILE_NAME = new Set(
  "qwertyuiopasdfghjklzxcvbnmąśęółźćńĘÓŁĄŚŻŹĆŃQWERTYUIOPASDFGHJKLZXCVBNM1234567890.-".split(
    ""
  )
);
const REPLACEMENT_CHARACTER = "_";
export const sanitizeFileName = (name: string) =>
  [...name]
    .map((e) => (ALLOWED_CHARS_IN_FILE_NAME.has(e) ? e : REPLACEMENT_CHARACTER))
    .join("");

export const fileExists = (name: string) =>
  stat(name)
    .then(() => true)
    .catch(() => false);

export const randomizeLettersCase = (
  text: string,
  upperProbability: number = 0.2
) => {
  return text
    .split("")
    .map((e) =>
      Math.random() < upperProbability
        ? e.toLocaleUpperCase()
        : e.toLocaleLowerCase()
    )
    .join("");
};

export const clearInput = async (input: ElementHandle<HTMLInputElement>) => {
  const content = await input.evaluate((element) => element.value, input);
  if (typeof content === "string") {
    const size = content.length;
    for (let i = 0; i < size; i++) {
      await sleep(100);
      await input.press("Backspace");
    }
  }
};
