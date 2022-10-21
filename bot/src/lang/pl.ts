import { LOCALE } from "../config"

export const formatMeetingName = (name: string | null) => name || 'bez nazwy'

export const joiningMessage = (scheduledBy: string, type: string, meetingName: string | null) =>
    `Cześć <@${scheduledBy}>! Wbijam na ${type} na spotkanie ${formatMeetingName(meetingName)}`

export const currentlyRecording = (name: string) => `Obecnie nagrywam ${formatMeetingName(name)}`

export const recordingFinished = (name: string) => `Spotkanie ${formatMeetingName(name)} zakończyło się`

export const ENTER_MEETING_YOURSELF = `Wejdź na spotkanie samemu`

export const MAY_NEED_YOUR_HELP_WITH_CAPTCHA = 'Mogę potrzebować Twojej pomocy z kapczą'

export const STOP_RECORDING = `Zatrzymaj nagrywanie`

export const recordingFinishedBy = (by: string) => `Nagrywanie zatrzymane przez <@${by}>`
export const recordingFinishedTimeout = (afterMinutes: number) => `Nagrywanie zatrzymane autoamtycznie po ${afterMinutes} minutach`
export const recordingFinishedClosed = () => `Nagrywanie zatrzymane, bo spotkanie się zakończyło`
export const recordingFinishedOther = () => `Nagrywanie zatrzymane, bo tak`

export const PROCESSING_RECORDING = `Plik będzie wkrótce dostępny, jeszcze się gotuje`
export const RECORDING_READY = `Nagranie jest gotowe i dostępne`
export const WATCH_RECORDING_BUTTON = `Oglądnij teraz`
export const SCHEDULE_NEXT_WEEK_BUTTON = `Za tydzień o tej samej porze?`

export const CAPTCHA_SOLVE_REQUEST = `Pomoże mi ktoś z tym?`
export const CAPTCHA_SOLVE_BUTTON = `Dziś to ja zostanę bohaterem dnia!`

export const OUTDATED_BUTTON_CLICKED_MESSAGE = `Naprawdę niepowinienaś/eś tego kliknąć`
export const CAPTCHA_SUBMIT_CONFIRMATION = `Wiszę ci piwo`
export const CAPTCHA_TOO_LATE_SUBMITTED = `Już, ale i tak dzięki`

export const CAPTCHA_MODAL_TITLE = `Rozwiąż kapcze`
export const CAPTCHA_MODAL_INPUT_TITLE = `Co tutaj jest napisane?`

export const STOP_FAILED_NO_RECORDING = `Nie ma żadnego nagrania`
export const STOP_RECORDING_CONFIRM_TITLE = `**Naprawdę mam przestać nagrywać?**`

export const YES = `TAK`
export const NO = `Jednak nie`
export const UNDO = `Cofnij`
export const STOP_RECORDING_CANCELLED = `Anulowano!`
export const STOP_RECORDING_EXECUTED = `Zatrzymane na Twój rozkaz`

export const SCREENSHOT_DELIVERED_TEXT = `Proszę cię bardzo`

export const RECORD_COMMAND_INVALID_URL = `Coś nie tak z tym linkiem`
export const RECORD_COMMAND_INVALID_DATE = `Format daty jest nie tak, na pewno yyyy.MM.dd hh:mm:ss?`
export const RECORD_COMMAND_DATE_IN_PAST = `Ta data jest w przeszłości`
export const RECORD_COMMAND_INVALID_PLATFORM = `Nie ogarniam, to webex czy teams?`
export const RECORD_COMMAND_SOON = `wkrótce`

export const recordingCommandAccepted = (name: string, date: Date, inText: string) => `Zaplanowano nagrywanie spotkania \`${formatMeetingName(name)}\` na \`${date.toLocaleString(LOCALE)}\` (\`${inText}\`)`

export const DELETE_COMMAND_NOT_FOUND = `Nie znaleziono takiego`
export const deleteCommandConfirmation = (name: string, timestamp: number) => `Usunięto zaplanowane spotkanie ${formatMeetingName(name)} na dzień ${new Date(timestamp).toLocaleString(LOCALE)}`

export const SCHEDULE_NEXT_WEEK_COMMAND_MODAL_TITLE = `Wbijać za tydzień tak samo?`
export const SCHEDULE_NEXT_WEEK_COMMAND_NAME_INPUT_PROMPT = `Jak to nowe spotkanie nazwać?`
export const SCHEDULE_NEXT_WEEK_COMMAND_NAME_INPUT_PLACEHOLDER = `Nazwa spotkania`
export const SCHEDULE_NEXT_WEEK_COMMAND_SCHEDULED_BUTTON_DISABLED = `Za tydzień o tej samej`
export const scheduleNextWeekCommandConfirmation = (name: string, timestamp: number) => `Zaplanowano ${formatMeetingName(name)} na dzień ${new Date(timestamp).toLocaleString(LOCALE)}`

export const commandUpcomingLineFormat = (name: string, type: string, timestamp: number) => `\`${new Date(timestamp).toLocaleString(LOCALE)}\` ${formatMeetingName(name)} (${type})`
export const commandUpcomingHeaderLine = (total: number) => `Zaplanowane spotkania do nagrania: (${total})`
export const COMMAND_UPCOMING_NONE_FOUND = `Jeszcze nic nie zaplanowano`

export const meetingDetails = (name: string, date: number, url: string, by: string, channel: string, created: number) => `Szczegóły spotkania:
Nazwa: ${formatMeetingName(name)}
Kiedy: ${new Date(date).toLocaleString(LOCALE)}
Link: \`${url}\`
Dodane przez <@${by}> w <#${channel}> w dniu ${new Date(created).toLocaleString(LOCALE)}
`
export const MEETING_DETAILS_DELETE_IT = `Usuń je`

export const channelNotPermitted = (id: string) => `Ten kanał (${id}) nie jest do mnie uprawniony`

export const COMMAND_RECORD_NAME = 'wbijaj'
export const COMMAND_RECORD_DESCRIPTION = 'Wbij na spotkanie i nagraj je'
export const COMMAND_RECORD_LINK_NAME = 'link'
export const COMMAND_RECORD_LINK_DESCRIPTION = 'Kolega prosi o link'
export const COMMAND_RECORD_DATE_NAME = 'kiedy'
export const COMMAND_RECORD_DATE_DESCRIPTION = 'Kiedy wbijać, w formacie yyyy.MM.dd hh:mm:ss lub "now"'
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