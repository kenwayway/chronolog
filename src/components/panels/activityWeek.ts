const DAY_START_HOUR = 6;

/** Monday 06:00 for the activity week containing the supplied timestamp. */
export function getActivityWeekStart(timestamp: number): number {
    const activityDate = new Date(timestamp);
    if (activityDate.getHours() < DAY_START_HOUR) {
        activityDate.setDate(activityDate.getDate() - 1);
    }
    activityDate.setHours(DAY_START_HOUR, 0, 0, 0);
    const daysSinceMonday = (activityDate.getDay() + 6) % 7;
    activityDate.setDate(activityDate.getDate() - daysSinceMonday);
    return activityDate.getTime();
}
