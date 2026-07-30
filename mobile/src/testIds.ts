/**
 * Centralized testID/accessibilityLabel string builders. Extends the web app's
 * `{module}-{field}` / `{action}-{module}-btn` / `{page}-page` convention (see root
 * LOCATORS.md) to native. Every locatable element should set BOTH testID (read by the
 * Appium UiAutomator2 driver via content-desc/resource-id) and accessibilityLabel (also
 * read by XCUITest and by screen readers) to the same value via `locatorProps()`.
 *
 * Deliberately NOT used on: "+ New" buttons, list-screen search inputs, Kanban drag
 * handles, Tasks swipe actions, long-press action-sheet items, date-picker calendar days —
 * these must stay locatable only by text/role/gesture, mirroring the web app's
 * intentionally-mixed locator strategy. See mobile/LOCATORS.md.
 */

export const testIds = {
  page: (name: string) => `${name}-page`,
  field: (module: string, field: string) => `${module}-${field}`,
  action: (action: string, module: string) => `${action}-${module}-btn`,
  raw: (id: string) => id,
};

/** Spreads onto a component as both `testID` and `accessibilityLabel`. */
export function locatorProps(id: string) {
  return { testID: id, accessibilityLabel: id };
}
