import { LANGUAGE } from "./config";
import * as en_ from "./lang/en-US";
import * as pl from "./lang/pl";

const supportedLanguages = ["en-US", "pl"];
if (!supportedLanguages.includes(LANGUAGE))
  throw new Error("Language not supported " + LANGUAGE);

export default LANGUAGE === "pl" ? pl : en_;

export const en = en_;
