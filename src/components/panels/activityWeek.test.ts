import { describe, expect, it } from "vitest";
import { getActivityWeekStart } from "./activityWeek";

function expectLocalDate(
    timestamp: number,
    year: number,
    month: number,
    date: number,
    hour: number,
) {
    const result = new Date(timestamp);
    expect([
        result.getFullYear(),
        result.getMonth(),
        result.getDate(),
        result.getHours(),
        result.getMinutes(),
    ]).toEqual([year, month, date, hour, 0]);
}

describe("getActivityWeekStart", () => {
    it("starts a midweek activity window on Monday at 06:00", () => {
        const timestamp = new Date(2026, 6, 29, 14, 30).getTime();
        expectLocalDate(getActivityWeekStart(timestamp), 2026, 6, 27, 6);
    });

    it("keeps early Monday morning in the previous activity week", () => {
        const timestamp = new Date(2026, 6, 27, 5, 59).getTime();
        expectLocalDate(getActivityWeekStart(timestamp), 2026, 6, 20, 6);
    });

    it("switches to the new week at Monday 06:00", () => {
        const timestamp = new Date(2026, 6, 27, 6, 0).getTime();
        expectLocalDate(getActivityWeekStart(timestamp), 2026, 6, 27, 6);
    });
});
