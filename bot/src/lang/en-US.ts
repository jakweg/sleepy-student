import { formatRelativeTime } from "../lang-utils"

const LOCALE = 'en-US'
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })
const relativeTimeFormat = new Intl.RelativeTimeFormat(LOCALE, { style: 'long' })

export const formatMeetingName = (name: string | null) => name || 'unnamed'

export const joiningMessage = (scheduledBy: string, type: string, meetingName: string | null) =>
    `Hey <@${scheduledBy}>! Joining ${type} for scheduled meeting ${formatMeetingName(meetingName)}`

export const currentlyRecording = (name: string) => `I'm currently recording ${formatMeetingName(name)}`

export const recordingFinished = (name: string) => `Meeting ${formatMeetingName(name)} has finished`

export const ENTER_MEETING_YOURSELF = `Enter the meeting yourself`

export const MAY_NEED_YOUR_HELP_WITH_CAPTCHA = 'May need your help with captcha'

export const STOP_RECORDING = `Stop the recording`

export const recordingFinishedBy = (by: string) => `Recording has been stopped by <@${by}>`
export const recordingFinishedTimeout = (afterMinutes: number) => `Recording has been stopped automatically after ${afterMinutes} minutes`
export const recordingFinishedClosed = () => `Recording was stopped, because meeting also closed`
export const recordingFinishedOther = () => `Recording was stopped for no reason`

export const PROCESSING_RECORDING = `File will be available soon, as it's now being processed`
export const RECORDING_READY = `You can watch the recording now`
export const WATCH_RECORDING_BUTTON = `Watch the recording`
export const SCHEDULE_NEXT_WEEK_BUTTON = `Schedule the same meeting next week`

export const CAPTCHA_SOLVE_REQUEST = `Please anyone, help me with this!`
export const CAPTCHA_SOLVE_BUTTON = `I'm the hero today`

export const OUTDATED_BUTTON_CLICKED_MESSAGE = `You should have not clicked this button`
export const CAPTCHA_SUBMIT_CONFIRMATION = `Thanks, it really means a lot for me`
export const CAPTCHA_TOO_LATE_SUBMITTED = `Too late, but thank you anyway`

export const CAPTCHA_MODAL_TITLE = `Solve the captcha`
export const CAPTCHA_MODAL_INPUT_TITLE = `What does it say?`

export const STOP_FAILED_NO_RECORDING = `There is no recording going on`
export const STOP_RECORDING_CONFIRM_TITLE = `**Really stop the recording?**`

export const YES = `YES`
export const NO = `Maybe no`
export const UNDO = `Undo`
export const STOP_RECORDING_CANCELLED = `Cancelled!`
export const STOP_RECORDING_EXECUTED = `Stopped by your command`

export const SCREENSHOT_DELIVERED_TEXT = `Here you are`

export const RECORD_COMMAND_INVALID_URL = `This url is invalid`
export const RECORD_COMMAND_INVALID_DATE = `This date is invalid`
export const RECORD_COMMAND_DATE_IN_PAST = `This date is in the past`
export const RECORD_COMMAND_INVALID_PLATFORM = `Couldn\'t determine platform`
export const RECORD_COMMAND_SOON = `soon`

export const recordingCommandAccepted = (name: string, date: Date, msDifference: number) => `Scheduled recording \`${formatMeetingName(name)}\` for \`${dateTimeFormat.format(date)}\` (\`${formatRelativeTime(msDifference, relativeTimeFormat)}\`)`

export const DELETE_COMMAND_NOT_FOUND = `Not found meeting with this ID`
export const deleteCommandConfirmation = (name: string, timestamp: number) => `Deleted scheduled ${formatMeetingName(name)} for day ${dateTimeFormat.format(new Date(timestamp))}`

export const SCHEDULE_NEXT_WEEK_COMMAND_MODAL_TITLE = `Reschedule it for next week?`
export const SCHEDULE_NEXT_WEEK_COMMAND_NAME_INPUT_PROMPT = `New name for it?`
export const SCHEDULE_NEXT_WEEK_COMMAND_NAME_INPUT_PLACEHOLDER = `Meeting name`
export const SCHEDULE_NEXT_WEEK_COMMAND_SCHEDULED_BUTTON_DISABLED = `Scheduled for next week`
export const scheduleNextWeekCommandConfirmation = (name: string, timestamp: number) => `Scheduled ${formatMeetingName(name)} for day ${dateTimeFormat.format(new Date(timestamp))}`

export const commandUpcomingLineFormat = (name: string, type: string, timestamp: number) => `\`${dateTimeFormat.format(new Date(timestamp))}\` ${formatMeetingName(name)} (${type})`
export const commandUpcomingHeaderLine = (total: number) => `Scheduled recordings: (${total})`
export const COMMAND_UPCOMING_NONE_FOUND = `No upcoming recordings`

export const meetingDetails = (name: string, date: number, url: string, by: string, channel: string, created: number) => `Meeting details:
Name: ${formatMeetingName(name)}
Date: ${dateTimeFormat.format(new Date(date))} (\`${formatRelativeTime(date - Date.now(), relativeTimeFormat)}\`)
Link: \`${url}\`
Scheduled by <@${by}> in <#${channel}> on ${dateTimeFormat.format(new Date(created))}
`
export const MEETING_DETAILS_DELETE_IT = `Delete it`

export const channelNotPermitted = (id: string) => `This channel (${id}) is not allowed to use this bot`

export const COMMAND_RECORD_NAME = 'record'
export const COMMAND_RECORD_DESCRIPTION = 'Record session'
export const COMMAND_RECORD_LINK_NAME = 'link'
export const COMMAND_RECORD_LINK_DESCRIPTION = 'Link to join'
export const COMMAND_RECORD_DATE_NAME = 'date'
export const COMMAND_RECORD_DATE_DESCRIPTION = 'When to join yyyy.MM.dd hh:mm:ss or "now"'
export const COMMAND_RECORD_NAME_NAME = 'name'
export const COMMAND_RECORD_NAME_DESCRIPTION = 'Name this meeting'

export const COMMAND_STOP_NAME = 'stop'
export const COMMAND_STOP_DESCRIPTION = 'Immediately stop current recording'

export const COMMAND_UPCOMING_NAME = 'upcoming'
export const COMMAND_UPCOMING_DESCRIPTION = 'View upcoming scheduled recordings'

export const COMMAND_DETAILS_NAME = 'details'
export const COMMAND_DETAILS_DESCRIPTION = 'View details of upcoming recording'
export const COMMAND_DETAILS_ID_NAME = 'meeting'
export const COMMAND_DETAILS_ID_DESCRIPTION = 'Which meeting to peek?'

export const COMMAND_SS_DESCRIPTION = 'Takes screenshot of current page'