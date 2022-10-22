export const formatRelativeTime = (msDifference: number, rtf: Intl.RelativeTimeFormat) => {

    const diff = {
        totalSeconds: msDifference / 1000 | 0,
        totalMinutes: msDifference / 1000 / 60 | 0,
        totalHours: msDifference / 1000 / 60 / 60 | 0,
        totalDays: msDifference / 1000 / 60 / 60 / 24 | 0,
    }

    if (diff.totalDays > 0)
        return rtf.format(diff.totalDays, 'day')
    else if (diff.totalHours > 0)
        return rtf.format(diff.totalHours, 'hour')
    else if (diff.totalMinutes > 0)
        return rtf.format(diff.totalMinutes, 'minute')
    else
        return rtf.format(diff.totalMinutes, 'second')
}