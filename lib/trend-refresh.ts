// Weekly automatic-trend refresh policy.
//
// The app bootstraps new trends whenever the user has fewer than `minCount`
// automatic trends from the current week. The home screen and the trends
// screen historically use different thresholds, so the minimum is a parameter
// and both call sites pin their own constant here.

/** Home screen bootstraps when the user has fewer than 3 weekly trends. */
export const HOME_MIN_WEEKLY_TRENDS = 3

/** Trends screen considers the week sparse below 1 weekly trend. */
export const TRENDS_SCREEN_MIN_WEEKLY_TRENDS = 1

export function shouldRefreshTrends(
  currentWeekTrends: { length: number },
  minCount: number,
): boolean {
  return currentWeekTrends.length < minCount
}
