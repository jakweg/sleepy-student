import { LANGUAGE } from "./config";
import * as en_ from "./lang/en-US";
import * as pl from "./lang/pl";
import * as plStudent from "./lang/pl-student";

const supportedLanguages = ["en-US", "pl", "pl-student"] as const;

const getLanguage = (code: typeof supportedLanguages[number]): typeof en_ => {
  switch (code) {
    case "en-US":
      return en_;
    case "pl":
      return pl as any;
    case "pl-student":
      return plStudent as any;
    default:
      throw new Error("Language not supported " + code);
  }
};

export default getLanguage(LANGUAGE as any);

export const en = en_;
