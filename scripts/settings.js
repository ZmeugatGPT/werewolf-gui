/**
 * Module settings for werewolf-gui.
 *
 * Kept in its own file so that both the canvas renderer (form-badge.js) and the
 * bootstrapping code (main.js) can read settings without creating import cycles.
 */

export const MODULE_ID = "werewolf-gui";

export const KEYS = Object.freeze({
  enabled: "enabled",
  hideSystemIcon: "hideSystemIcon",
  showLabel: "showLabel",
  badgeSize: "badgeSize",
  position: "position",
  hideHomid: "hideHomid",
  opacity: "opacity",
  syncUnlinkedTokens: "syncUnlinkedTokens",
  showOnlyObservable: "showOnlyObservable",
  formBarEnabled: "formBarEnabled",
  formBarShowLabels: "formBarShowLabels",
  formBarPosition: "formBarPosition"
});

/** Default values, also exported for tests / documentation. */
export const DEFAULTS = Object.freeze({
  enabled: true,
  hideSystemIcon: true,
  showLabel: true,
  badgeSize: 0.45,
  position: "bottom-center",
  hideHomid: false,
  opacity: 0.85,
  syncUnlinkedTokens: true,
  showOnlyObservable: false,
  formBarEnabled: true,
  formBarShowLabels: true,
  formBarPosition: {}
});

/**
 * Register every client-scoped setting.
 * @param {() => void} [onChange]  Callback invoked whenever a setting changes.
 */
export function registerSettings(onChange = () => {}) {
  const register = game.settings.register.bind(game.settings);
  const localize = key => `${MODULE_ID}.settings.${key}`;

  register(MODULE_ID, KEYS.enabled, {
    name: localize("enabled.name"),
    hint: localize("enabled.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: DEFAULTS.enabled,
    onChange
  });

  register(MODULE_ID, KEYS.hideSystemIcon, {
    name: localize("hideSystemIcon.name"),
    hint: localize("hideSystemIcon.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: DEFAULTS.hideSystemIcon,
    onChange
  });

  register(MODULE_ID, KEYS.showLabel, {
    name: localize("showLabel.name"),
    hint: localize("showLabel.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: DEFAULTS.showLabel,
    onChange
  });

  register(MODULE_ID, KEYS.hideHomid, {
    name: localize("hideHomid.name"),
    hint: localize("hideHomid.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: DEFAULTS.hideHomid,
    onChange
  });

  register(MODULE_ID, KEYS.syncUnlinkedTokens, {
    name: localize("syncUnlinkedTokens.name"),
    hint: localize("syncUnlinkedTokens.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: DEFAULTS.syncUnlinkedTokens,
    onChange
  });

  register(MODULE_ID, KEYS.showOnlyObservable, {
    name: localize("showOnlyObservable.name"),
    hint: localize("showOnlyObservable.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: DEFAULTS.showOnlyObservable,
    onChange
  });

  register(MODULE_ID, KEYS.formBarEnabled, {
    name: localize("formBarEnabled.name"),
    hint: localize("formBarEnabled.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: DEFAULTS.formBarEnabled,
    onChange
  });

  register(MODULE_ID, KEYS.formBarShowLabels, {
    name: localize("formBarShowLabels.name"),
    hint: localize("formBarShowLabels.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: DEFAULTS.formBarShowLabels,
    onChange
  });

  // Позиция панели сохраняется автоматически, в меню настроек не показывается.
  register(MODULE_ID, KEYS.formBarPosition, {
    scope: "client",
    config: false,
    type: Object,
    default: DEFAULTS.formBarPosition
  });

  register(MODULE_ID, KEYS.badgeSize, {
    name: localize("badgeSize.name"),
    hint: localize("badgeSize.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0.2, max: 0.9, step: 0.05 },
    default: DEFAULTS.badgeSize,
    onChange
  });

  register(MODULE_ID, KEYS.opacity, {
    name: localize("opacity.name"),
    hint: localize("opacity.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0.2, max: 1, step: 0.05 },
    default: DEFAULTS.opacity,
    onChange
  });

  register(MODULE_ID, KEYS.position, {
    name: localize("position.name"),
    hint: localize("position.hint"),
    scope: "client",
    config: true,
    type: String,
    choices: {
      "bottom-center": localize("position.choices.bottomCenter"),
      "bottom-right": localize("position.choices.bottomRight"),
      "bottom-left": localize("position.choices.bottomLeft"),
      "top-center": localize("position.choices.topCenter")
    },
    default: DEFAULTS.position,
    onChange
  });
}

/**
 * Read all settings into a plain object.
 * @returns {{enabled:boolean, hideSystemIcon:boolean, showLabel:boolean,
 *            badgeSize:number, position:string, hideHomid:boolean, opacity:number}}
 */
export function getSettings() {
  const read = (key, fallback) => {
    try {
      const value = game.settings.get(MODULE_ID, key);
      return value === undefined ? fallback : value;
    } catch {
      return fallback;
    }
  };

  return {
    enabled: read(KEYS.enabled, DEFAULTS.enabled),
    hideSystemIcon: read(KEYS.hideSystemIcon, DEFAULTS.hideSystemIcon),
    showLabel: read(KEYS.showLabel, DEFAULTS.showLabel),
    badgeSize: read(KEYS.badgeSize, DEFAULTS.badgeSize),
    position: read(KEYS.position, DEFAULTS.position),
    hideHomid: read(KEYS.hideHomid, DEFAULTS.hideHomid),
    opacity: read(KEYS.opacity, DEFAULTS.opacity),
    syncUnlinkedTokens: read(KEYS.syncUnlinkedTokens, DEFAULTS.syncUnlinkedTokens),
    showOnlyObservable: read(KEYS.showOnlyObservable, DEFAULTS.showOnlyObservable),
    formBarEnabled: read(KEYS.formBarEnabled, DEFAULTS.formBarEnabled),
    formBarShowLabels: read(KEYS.formBarShowLabels, DEFAULTS.formBarShowLabels),
    formBarPosition: read(KEYS.formBarPosition, DEFAULTS.formBarPosition)
  };
}
