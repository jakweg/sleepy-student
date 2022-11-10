import { formatRelativeTime } from "../lang-utils"

const LOCALE = 'pl'
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })
const relativeTimeFormat = new Intl.RelativeTimeFormat(LOCALE, { style: 'long' })
const pluralRules = new Intl.PluralRules(LOCALE)

export const MEETING_UNNAMED = 'bez nazwy'
export const formatMeetingName = (name: string | null) => `\`${name || MEETING_UNNAMED}\``

export const joiningMessage = (scheduledBy: string, type: string, meetingName: string | null) =>
    `Cześć <@${scheduledBy}>! Wchodzę na ${formatMeetingName(meetingName)} jak świnia w trufle`

export const currentlyRecording = (name: string) => `Leżę w kapitolu z 25-ma studentami, ${formatMeetingName(name)} leci 10 slajdy się psują? I UJ . Jakiś chyba?? wykładowca zabrania nagrywać ??! Warun idzie dostać. Trzymajcie się na tym wykładzie !!!`

export const recordingFinished = (name: string) => `Wykładu ${formatMeetingName(name)} już z nami nie ma, miał piękny pogrzeb`

export const ENTER_MEETING_YOURSELF = `Dołącz do wesołego kółeczka samemu`

export const MAY_NEED_YOUR_HELP_WITH_CAPTCHA = 'Mogę potrzebować Twojej pomocy z kapczą'

export const STOP_RECORDING = `Fajrant`

export const recordingFinishedBy = (by: string) => `Nagrywanie zatrzymane przez naszego kompana niedoli <@${by}>`
export const recordingFinishedTimeout = (afterMinutes: number) => `Koszmar studentów trwał ${afterMinutes} minut. Wykładowca nie chciał nas puścić. Donosił tylko slajdy od których studentom robiły się wielkie oczy`
export const recordingFinishedClosed = () => `Naje… khem, nagrany to do domu`
export const recordingFinishedLostParticipants = () => `Opuściłem spotkanie, bo inni też wychodzili`
export const recordingFinishedOther = () => `Nagrywanie zatrzymane, bo tak`

export const PROCESSING_RECORDING = `Nagrania jeszcze nie ma, ale też jest zajebiście`
export const RECORDING_READY = `Film ze słoikiem dostępny jest w sieci`
export const WATCH_RECORDING_BUTTON = `Odpalaj kawalerze`
export const SCHEDULE_NEXT_WEEK_BUTTON = `Za tydzień o tej samej porze?`

export const CAPTCHA_SOLVE_REQUEST = `Jest tu jakiś cwaniak?`
export const CAPTCHA_SOLVE_BUTTON = `Tak!`

export const OUTDATED_BUTTON_CLICKED_MESSAGE = `Naprawdę niepowinienaś/eś tego kliknąć`
export const CAPTCHA_SUBMIT_CONFIRMATION = `Wiszę ci piwo`
export const CAPTCHA_TOO_LATE_SUBMITTED = `Może i nie byłeś najszybszy, za to ktoś Cię wyprzedził, coś za coś`

export const CAPTCHA_MODAL_TITLE = `To rozwiąż kapcze`
export const CAPTCHA_MODAL_INPUT_TITLE = `Co tu pisze… khem, jest napisane?`

export const STOP_FAILED_NO_RECORDING = `Nie ma żadnego nagrania`
export const STOP_RECORDING_CONFIRM_TITLE = `**Pewny, że chcesz zatrzymać?**`

export const YES = `To śmiało`
export const NO = `Trochę się cykam`
export const UNDO = `Cofnij`
export const STOP_RECORDING_CANCELLED = `Anulowano!`
export const STOP_RECORDING_EXECUTED = `Zatrzymane na Twój rozkaz`

export const SCREENSHOT_DELIVERED_TEXT = `Proszę cię bardzo`

export const RECORD_COMMAND_INVALID_URL = `Coś nie tak z tym linkiem`
export const RECORD_COMMAND_INVALID_DATE = `Format daty jest nie tak, na pewno yyyy.MM.dd hh:mm?`
export const RECORD_COMMAND_DATE_IN_PAST = `Ta data jest w przeszłości`
export const RECORD_COMMAND_INVALID_PLATFORM = `Nie ogarniam, to webex czy teams?`
export const RECORD_COMMAND_SOON = `wkrótce`

export const recordingCommandAccepted = (name: string, date: Date, msDifference: number) => `Zaplanowano nagrywanie spotkania ${formatMeetingName(name)} na \`${dateTimeFormat.format(date)}\` (\`${formatRelativeTime(msDifference, relativeTimeFormat)}\`)`

export const DELETE_COMMAND_NOT_FOUND = `Nie znaleziono takiego`
export const deleteCommandConfirmation = (name: string, timestamp: number) => `Usunięto zaplanowane spotkanie ${formatMeetingName(name)} na ${dateTimeFormat.format(new Date(timestamp))}`

export const SCHEDULE_NEXT_WEEK_COMMAND_MODAL_TITLE = `Wbijać na to samo spotkanie?`;
export const SCHEDULE_NEXT_WEEK_COMMAND_NAME_INPUT_PROMPT = `Jak to nowe spotkanie nazwać?`;
export const SCHEDULE_NEXT_WEEK_COMMAND_NAME_INPUT_PLACEHOLDER = `Nazwa spotkania`;
export const SCHEDULE_NEXT_WEEK_COMMAND_DATE_INPUT_PROMPT = `Data i godzina kolejnego spotkania?`;
export const SCHEDULE_NEXT_WEEK_COMMAND_DATE_INPUT_PLACEHOLDER = `yyyy.MM.dd hh:mm`;
export const SCHEDULE_NEXT_WEEK_COMMAND_SCHEDULED_BUTTON_DISABLED = `Ustawiono na przyszłość`;

export const scheduleNextWeekCommandConfirmation = (name: string, timestamp: number) => `Zaplanowano ${formatMeetingName(name)} na dzień ${dateTimeFormat.format(new Date(timestamp))}`

export const commandUpcomingLineFormat = (name: string, type: string, timestamp: number) => `\`${dateTimeFormat.format(new Date(timestamp))}\` ${formatMeetingName(name)} (${type})`
const spotkanieOptions = { few: 'spotkania', many: 'spotkań', one: 'spotkanie', other: 'spotkania' }
export const commandUpcomingHeaderLine = (total: number) => `Zaplanowano ${total} ${spotkanieOptions[pluralRules.select(total)]} do nagrania:`
export const COMMAND_UPCOMING_NONE_FOUND = `Jeszcze nic nie zaplanowano`

export const meetingDetails = (name: string, date: number, url: string, by: string, channel: string, created: number) => `Szczegóły spotkania:
Nazwa: ${formatMeetingName(name)}
Kiedy: ${dateTimeFormat.format(new Date(date))} (\`${formatRelativeTime(date - Date.now(), relativeTimeFormat)}\`)
Link: \`${url}\`
Dodane przez <@${by}> w <#${channel}> w dniu ${dateTimeFormat.format(new Date(created))}
`
export const MEETING_DETAILS_DELETE_IT = `Usuń je`

export const channelNotPermitted = (id: string) => `Ten kanał (${id}) nie jest do mnie uprawniony`

export const COMMAND_RECORD_NAME = 'wbijaj'
export const COMMAND_RECORD_DESCRIPTION = 'Wbij na spotkanie i nagraj je'
export const COMMAND_RECORD_LINK_NAME = 'link'
export const COMMAND_RECORD_LINK_DESCRIPTION = 'Kolega prosi o link'
export const COMMAND_RECORD_DATE_NAME = 'kiedy'
export const COMMAND_RECORD_DATE_NOW_MARKER = 'teraz'
export const COMMAND_RECORD_DATE_DESCRIPTION = `Kiedy wbijać, w formacie yyyy.MM.dd hh:mm lub "${COMMAND_RECORD_DATE_NOW_MARKER}"`
export const COMMAND_RECORD_NAME_NAME = 'nazwa'
export const COMMAND_RECORD_NAME_DESCRIPTION = 'Jak nazwać to spotkanie?'

export const COMMAND_STOP_NAME = 'zatrzymaj'
export const COMMAND_STOP_DESCRIPTION = 'Natychmiast zatrzymaj nagrywanie i opuść spotkanie'

export const COMMAND_UPCOMING_NAME = 'wkrótce'
export const COMMAND_UPCOMING_DESCRIPTION = 'Zobacz na jakie spotkania będę wkrótce wbijał'

export const COMMAND_DETAILS_NAME = 'szczegóły'
export const COMMAND_DETAILS_DESCRIPTION = 'Pokaż szczegóły spotkania'
export const COMMAND_DETAILS_ID_NAME = 'spotkanie'
export const COMMAND_DETAILS_ID_DESCRIPTION = 'Które chcesz zobaczyć?'

export const COMMAND_SS_DESCRIPTION = 'Robi zrzut ekranu obecnej strony'