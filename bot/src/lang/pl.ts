import { formatRelativeTime } from "../lang-utils";

export const LOCALE = "pl";
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  weekday: "long",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
});
const relativeTimeFormat = new Intl.RelativeTimeFormat(LOCALE, {
  style: "long",
});
const pluralRules = new Intl.PluralRules(LOCALE);

export const MEETING_UNNAMED = "bez nazwy";
export const formatMeetingName = (name: string | null) =>
  `\`${name || MEETING_UNNAMED}\``;

export const joiningMessage = (
  scheduledBy: string,
  type: string,
  meetingName: string | null
) => `Cześć <@${scheduledBy}>! Wchodzę na ${formatMeetingName(meetingName)}`;

export const currentlyRecording = (name: string) =>
  `Obecnie nagrywam ${formatMeetingName(name)}`;

export const recordingFinished = (name: string) =>
  `Nagrałem ${formatMeetingName(name)} pomyślnie`;

export const ENTER_MEETING_YOURSELF = `Dołącz do spotkania`;

export const MAY_NEED_YOUR_HELP_WITH_CAPTCHA =
  "Mogę potrzebować Twojej pomocy z Captcha";

export const STOP_RECORDING = `Zakończ nagrywanie`;

export const RETRY_FAILED_RECORDING = `Spróbuj ponownie dołączyć`;

export const failedJoining = (entryType: string, error: string) =>
  `Spadłem z rowerka dołączając do ${entryType}, bo \`${error}\``;

export const recordingFinishedBy = (by: string) =>
  `Nagrywanie zatrzymane przez <@${by}>`;
export const recordingFinishedTimeout = (afterMinutes: number) =>
  `Nagrywanie zatrzymane automatycznie po ${afterMinutes} minutach`;
export const recordingFinishedClosed = () => `Spotkanie zakończyło się`;
export const recordingFinishedLostParticipants = () =>
  `Opuściłem spotkanie, bo inni też wychodzili`;
export const recordingFinishedOther = () => `Nagrywanie zatrzymane`;

export const PROCESSING_RECORDING = `Przetwarzanie nagrania...`;
export const RECORDING_READY = `Nagranie jest już dostępne`;
export const WATCH_RECORDING_BUTTON = `Oglądnij nagranie`;
export const SCHEDULE_NEXT_WEEK_BUTTON = `Za tydzień o tej samej porze?`;

export const CAPTCHA_SOLVE_REQUEST = `Potrzebuję pomocy z Captcha?`;
export const CAPTCHA_SOLVE_BUTTON = `Zostanę bohaterem`;

export const OUTDATED_BUTTON_CLICKED_MESSAGE = `Naprawdę nie powinnaś/eś tego kliknąć`;
export const CAPTCHA_SUBMIT_CONFIRMATION = `Dziękuję, to dużo dla mnie znaczy`;
export const CAPTCHA_TOO_LATE_SUBMITTED = `Dziękuję`;

export const CAPTCHA_MODAL_TITLE = `Co tutaj jest napisane`;
export const CAPTCHA_MODAL_INPUT_TITLE = `Przepisz litery i cyfry z obrazka`;

export const STOP_FAILED_NO_RECORDING = `Nie ma żadnego nagrania`;
export const STOP_RECORDING_CONFIRM_TITLE = `**Zakończyć nagrywanie i wyjść ze spotkania?**`;

export const YES = `Tak, zakończ`;
export const NO = `Nie`;
export const UNDO = `Cofnij`;
export const STOP_RECORDING_CANCELLED = `Anulowano!`;
export const STOP_RECORDING_EXECUTED = `Zatrzymane na Twój rozkaz`;

export const SCREENSHOT_DELIVERED_TEXT = `Proszę cię bardzo`;

export const RECORD_COMMAND_INVALID_URL = `Nieprawidłowy adres`;
export const RECORD_COMMAND_INVALID_DATE = `Nieprawidłowy format daty, musi być yyyy.MM.dd hh:mm`;
export const RECORD_COMMAND_DATE_IN_PAST = `Ta data jest w przeszłości`;
export const RECORD_COMMAND_INVALID_PLATFORM = `Nieprawidłowa platforma`;
export const RECORD_COMMAND_SOON = `wkrótce`;

export const recordingCommandAccepted = (
  name: string,
  date: Date,
  msDifference: number
) =>
  `Zaplanowano nagrywanie spotkania ${formatMeetingName(
    name
  )} na \`${dateTimeFormat.format(date)}\` (\`${formatRelativeTime(
    msDifference,
    relativeTimeFormat
  )}\`)`;

export const DELETE_COMMAND_NOT_FOUND = `Nie znaleziono takiego`;
export const deleteCommandConfirmation = (name: string, timestamp: number) =>
  `Usunięto zaplanowane spotkanie ${formatMeetingName(
    name
  )} na ${dateTimeFormat.format(new Date(timestamp))}`;

export const SCHEDULE_NEXT_WEEK_COMMAND_MODAL_TITLE = `Wejść na to samo spotkanie?`;
export const SCHEDULE_NEXT_WEEK_COMMAND_NAME_INPUT_PROMPT = `Jak to nowe spotkanie nazwać?`;
export const SCHEDULE_NEXT_WEEK_COMMAND_NAME_INPUT_PLACEHOLDER = `Nazwa spotkania`;
export const SCHEDULE_NEXT_WEEK_COMMAND_DATE_INPUT_PROMPT = `Data i godzina kolejnego spotkania?`;
export const SCHEDULE_NEXT_WEEK_COMMAND_DATE_INPUT_PLACEHOLDER = `yyyy.MM.dd hh:mm`;
export const SCHEDULE_NEXT_WEEK_COMMAND_SCHEDULED_BUTTON_DISABLED = `Ustawiono na przyszłość`;

export const scheduleNextWeekCommandConfirmation = (
  name: string,
  timestamp: number
) =>
  `Zaplanowano ${formatMeetingName(name)} na dzień ${dateTimeFormat.format(
    new Date(timestamp)
  )}`;

export const commandUpcomingLineFormat = (
  name: string,
  type: string,
  timestamp: number
) =>
  `\`${dateTimeFormat.format(new Date(timestamp))}\` ${formatMeetingName(
    name
  )} (${type})`;
const spotkanieOptions = {
  few: "spotkania",
  many: "spotkań",
  one: "spotkanie",
  other: "spotkania",
};
export const commandUpcomingHeaderLine = (total: number) =>
  `Zaplanowano ${total} ${
    spotkanieOptions[pluralRules.select(total)]
  } do nagrania:`;
export const COMMAND_UPCOMING_NONE_FOUND = `Jeszcze nic nie zaplanowano`;

export const meetingDetails = (
  name: string,
  date: number,
  url: string,
  by: string,
  channel: string,
  created: number
) => `Szczegóły spotkania:
Nazwa: ${formatMeetingName(name)}
Kiedy: ${dateTimeFormat.format(new Date(date))} (\`${formatRelativeTime(
  date - Date.now(),
  relativeTimeFormat
)}\`)
Link: \`${url}\`
Dodane przez <@${by}> w <#${channel}> w dniu ${dateTimeFormat.format(
  new Date(created)
)}
`;
export const MEETING_DETAILS_DELETE_IT = `Usuń je`;

export const channelNotPermitted = (id: string) =>
  `Ten kanał (${id}) nie jest do mnie uprawniony`;

export const COMMAND_RECORD_NAME = "nagraj";
export const COMMAND_RECORD_DESCRIPTION = "Wejdź na spotkanie i nagraj je";
export const COMMAND_RECORD_LINK_NAME = "link";
export const COMMAND_RECORD_LINK_DESCRIPTION = "Kolega prosi o link";
export const COMMAND_RECORD_DATE_NAME = "kiedy";
export const COMMAND_RECORD_DATE_NOW_MARKER = "teraz";
export const COMMAND_RECORD_DATE_DESCRIPTION = `Kiedy dołączyć i nagrać, w formacie yyyy.MM.dd hh:mm lub "${COMMAND_RECORD_DATE_NOW_MARKER}"`;
export const COMMAND_RECORD_NAME_NAME = "nazwa";
export const COMMAND_RECORD_NAME_DESCRIPTION = "Jak nazwać to spotkanie?";

export const COMMAND_STOP_NAME = "zatrzymaj";
export const COMMAND_STOP_DESCRIPTION =
  "Natychmiast zatrzymaj nagrywanie i opuść spotkanie";

export const COMMAND_UPCOMING_NAME = "wkrótce";
export const COMMAND_UPCOMING_DESCRIPTION =
  "Zobacz jakie spotkania będę wkrótce nagrywał";

export const COMMAND_DETAILS_NAME = "szczegóły";
export const COMMAND_DETAILS_DESCRIPTION = "Pokaż szczegóły spotkania";
export const COMMAND_DETAILS_ID_NAME = "spotkanie";
export const COMMAND_DETAILS_ID_DESCRIPTION = "Które chcesz zobaczyć?";

export const COMMAND_SS_DESCRIPTION = "Robi zrzut ekranu obecnej strony";

export const COMMAND_SAY_NAME = "napisz"
export const COMMAND_SAY_REFUSED = "Akurat ty to mnie tak nie możesz wykorzystywać!";
export const COMMAND_SAY_DESCRIPTION = "Wysyła wiadomość";
export const COMMAND_SAY_CHANNEL = "kanał";
export const COMMAND_SAY_CONTENT = "wiadomość";
export const COMMAND_SAY_MENTION = "tag";
export const COMMAND_SAY_REPLY = "odpowiedź";
export const COMMAND_SAY_CHANNEL_DESCRIPTION = "Kanał w którym wysłać wiadomość";
export const COMMAND_SAY_CONTENT_DESCRIPTION = "Treść wiadomości";
export const COMMAND_SAY_MENTION_DESCRIPTION = "Kogoś oznaczyć w niej?";
export const COMMAND_SAY_REPLY_DESCRIPTION = "Wiadomość na którą odpisać";