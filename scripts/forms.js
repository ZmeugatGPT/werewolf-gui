/**
 * Form registry.
 *
 * Knows how to answer a single question: "which shapeshifting form is this
 * actor currently in, and which icon represents it?".
 *
 * Two data layouts are supported:
 *
 *  1. Legacy shifter sheets ("Werewolf", "Changing Breed", ...)
 *     The active form lives in `actor.system.shapes.<key>.isactive` where the
 *     key is one of homid/glabro/crinos/hispo/lupus (even for Changing Breeds;
 *     the *label* differs, the key does not).
 *
 *  2. PC Actor (Foundry v10+ style)
 *     The forms are `Trait` items with `system.type === "wod.types.shapeform"`.
 *     The active one has `system.isactive === true`, and the form key can be
 *     derived from `system.label` (e.g. "wod.shapes.crinos") or from its own
 *     `system.icon` texture.
 *
 * The icon artwork ships with the worldofdarkness system, so no assets are
 * duplicated by this module.
 */

import { MODULE_ID, getSettings } from "./settings.js";

/** Canonical werewolf form keys, in display order. */
export const FORM_KEYS = Object.freeze(["homid", "glabro", "crinos", "hispo", "lupus"]);

/** Primary icon location shipped by the system. */
export const ICON_BASE = "systems/worldofdarkness/assets/img/werewolf/form/";

/** Alternate icon location shipped by the system (identical files). */
export const ICON_BASE_ALT = "systems/worldofdarkness/assets/img/shapes/";

/** Placeholder textures that should never be treated as a real form icon. */
const PLACEHOLDER_ICONS = new Set([
  "",
  "icons/svg/mystery-man.svg",
  "icons/svg/item-bag.svg"
]);

const SHAPEFORM_TYPE = "wod.types.shapeform";

/**
 * Build the canonical system icon URL for a form key.
 * @param {string|null|undefined} key
 * @returns {string|null}
 */
export function canonicalIcon(key) {
  if (!key || !FORM_KEYS.includes(key)) return null;
  return `${ICON_BASE}form_${key}.svg`;
}

/**
 * Extract a canonical form key from a label / name / path.
 * Accepts "wod.shapes.crinos", "crinos", "Crinos" or an icon path.
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function keyFromLabel(value) {
  if (!value || typeof value !== "string") return null;
  const lower = value.trim().toLowerCase();
  for (const key of FORM_KEYS) {
    if (lower === key) return key;
    if (lower.endsWith(`.${key}`)) return key;
    if (lower.endsWith(`form_${key}.svg`)) return key;
  }
  return null;
}

/**
 * Is this a usable (non-placeholder) icon path?
 * @param {string|null|undefined} url
 * @returns {string|null}
 */
export function validIcon(url) {
  const trimmed = (url ?? "").trim();
  if (!trimmed || PLACEHOLDER_ICONS.has(trimmed)) return null;
  return trimmed;
}

/**
 * Localize a system label key ("wod.shapes.crinos" -> "Crinos" / "Кринос").
 * Falls back to a capitalized last segment when no translation exists.
 * @param {string|null|undefined} label
 * @param {string} [fallback]
 * @returns {string}
 */
export function localizeLabel(label, fallback = "") {
  if (!label || typeof label !== "string") return fallback;
  if (label.startsWith("wod.")) {
    const localized = game.i18n?.localize(label);
    if (localized && localized !== label) return localized;
    const segment = label.split(".").pop() ?? "";
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  }
  return label;
}

/**
 * Collect the shapeshifting-form items of a PC actor, in display order.
 * @param {Actor} actor
 * @returns {Item[]}
 */
function getShapeformItems(actor) {
  const items = actor?.items;
  if (!items) return [];
  const list = Array.isArray(items) ? items : Array.from(items);
  return list
    .filter(item => item?.type === "Trait" && item.system?.type === SHAPEFORM_TYPE)
    .sort((a, b) => Number(a.system?.order ?? 0) - Number(b.system?.order ?? 0));
}

/**
 * @param {Item} item
 * @returns {{key:string|null, icon:string|null, label:string, source:any}}
 */
function fromShapeformItem(item) {
  const key = keyFromLabel(item.system?.label) ?? keyFromLabel(item.name);
  return {
    key,
    icon: canonicalIcon(key) ?? validIcon(item.system?.icon),
    label: localizeLabel(item.system?.label, item.name ?? ""),
    source: item
  };
}

/**
 * Resolve the active form of an actor.
 *
 * @param {Actor} actor
 * @returns {{key:string|null, icon:string|null, label:string, source:any}|null}
 *          `null` when the actor is not a shifter or has no active form.
 */
export function getActiveForm(actor) {
  if (!actor) return null;

  // --- New PC Actor sheet: Trait items with type "wod.types.shapeform" -------
  const shapeItems = getShapeformItems(actor);
  if (shapeItems.length > 0) {
    const active = shapeItems.find(item => item.system?.isactive === true);
    return active ? fromShapeformItem(active) : null;
  }

  // --- Legacy shifter sheets: actor.system.shapes ---------------------------
  const shapes = actor.system?.shapes;
  if (shapes && typeof shapes === "object") {
    for (const key of FORM_KEYS) {
      if (shapes[key]?.isactive) {
        return {
          key,
          icon: canonicalIcon(key),
          label: localizeLabel(shapes[key].label, key),
          source: shapes[key]
        };
      }
    }
    // Non-standard / homebrew form keys.
    for (const [key, shape] of Object.entries(shapes)) {
      if (shape?.isactive) {
        return {
          key,
          icon: canonicalIcon(key),
          label: localizeLabel(shape.label, key),
          source: shape
        };
      }
    }
  }

  return null;
}

/**
 * Does this actor use the shapeshifting system at all?
 * @param {Actor} actor
 * @returns {boolean}
 */
export function isShifter(actor) {
  if (!actor) return false;
  if (getShapeformItems(actor).length > 0) return true;
  const shapes = actor.system?.shapes;
  return !!shapes && typeof shapes === "object" && FORM_KEYS.some(key => key in shapes);
}

/**
 * Список доступных форм актора для панели переключения.
 *
 * @param {Actor} actor
 * @returns {Array<{key:string, label:string, icon:string, active:boolean, itemId?:string}>}
 */
export function getFormOptions(actor) {
  if (!actor) return [];

  // --- PC: предметы-формы ---------------------------------------------------
  const shapeItems = getShapeformItems(actor);
  if (shapeItems.length > 0) {
    return shapeItems
      .map(item => {
        const key = keyFromLabel(item.system?.label) ?? keyFromLabel(item.name) ?? item.id;
        return {
          key,
          label: localizeLabel(item.system?.label, item.name ?? ""),
          icon: canonicalIcon(keyFromLabel(item.system?.label) ?? keyFromLabel(item.name))
            ?? validIcon(item.system?.icon),
          active: item.system?.isactive === true,
          itemId: item.id
        };
      })
      .filter(form => !!form.icon);
  }

  // --- Старые листы: actor.system.shapes -----------------------------------
  const shapes = actor.system?.shapes;
  if (!shapes || typeof shapes !== "object") return [];

  const keys = Object.keys(shapes);
  const ordered = [
    ...FORM_KEYS.filter(key => keys.includes(key)),
    ...keys.filter(key => !FORM_KEYS.includes(key))
  ];

  return ordered
    .map(key => ({
      key,
      label: localizeLabel(shapes[key]?.label, key),
      icon: canonicalIcon(key),
      active: shapes[key]?.isactive === true
    }))
    .filter(form => !!form.icon);
}

/**
 * Переключить форму актора (аналог клика по форме в листе).
 *
 * Для старых листов обновляет `system.shapes` и связанные предметы-бонусы
 * (лист оборотня делает это вручную), для PC - предметы-формы и их bonuslist.
 * После этого система сама пересчитывает тоталы (`system.settings.isupdated`).
 *
 * Если актор - несвязанный токен, выбор дополнительно переносится на базового
 * актора: иначе лист, открытый из списка персонажей, показывал бы старую форму.
 *
 * @param {Actor} actor
 * @param {string} key   Ключ формы (homid / glabro / crinos / hispo / lupus ...)
 * @returns {Promise<boolean>}
 */
export async function setForm(actor, key) {
  if (!actor || !key) return false;

  const applied = await applyForm(actor, key);
  if (!applied) return false;

  // Несвязанный токен хранит формы в своём delta и базового актора не трогает.
  // Дублируем выбор на базового актора, чтобы лист персонажа (из списка) и
  // остальные токены на других сценах тоже обновились.
  if (actor.isToken && getSettings().syncUnlinkedTokens !== false) {
    const base = actor.token?.baseActor ?? null;
    if (base && (base.isOwner || game.user?.isGM)) {
      try {
        await applyForm(base, key);
      } catch (error) {
        console.warn(`${MODULE_ID} | Не удалось обновить базового актора "${base.name}":`, error);
      }
    }
  }

  return true;
}

/**
 * @param {Actor} actor
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function applyForm(actor, key) {
  const shapeItems = getShapeformItems(actor);
  if (shapeItems.length > 0) return setShapeformItemForm(actor, shapeItems, key);
  return setLegacyForm(actor, key);
}

/** @param {Item} item @returns {string|null} */
function itemFormKey(item) {
  return keyFromLabel(item.system?.label) ?? keyFromLabel(item.name);
}

/**
 * @param {Actor} actor
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function setLegacyForm(actor, key) {
  const shapes = actor.system?.shapes;
  if (!shapes || typeof shapes !== "object") return false;
  if (!(key in shapes)) return false;

  // 1. Бонусы форм (у старых листов parentid - это ключ формы, не id предмета).
  const parentKeys = ["glabro", "crinos", "hispo", "lupus"];
  const bonuses = Array.from(actor.items ?? []).filter(item =>
    item.type === "Bonus" && parentKeys.includes(item.system?.parentid));
  const itemUpdates = [];
  for (const bonus of bonuses) {
    const shouldBeActive = bonus.system.parentid === key;
    if (bonus.system.isactive !== shouldBeActive) {
      itemUpdates.push({ _id: bonus.id, "system.isactive": shouldBeActive });
    }
  }
  if (itemUpdates.length > 0) await actor.updateEmbeddedDocuments("Item", itemUpdates);

  // 2. Сами формы + пересчёт тоталов системой.
  const updates = {};
  for (const shapeKey of Object.keys(shapes)) {
    updates[`system.shapes.${shapeKey}.isactive`] = shapeKey === key;
  }
  updates["system.settings.isupdated"] = false;
  await actor.update(updates);
  return true;
}

/**
 * @param {Actor} actor
 * @param {Item[]} items
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function setShapeformItemForm(actor, items, key) {
  const updates = [];

  for (const item of items) {
    const itemKey = itemFormKey(item) ?? item.id;
    const active = itemKey === key;
    if (item.system?.isactive === active) continue;

    const update = { _id: item.id, "system.isactive": active };

    const bonuslist = item.system?.bonuslist;
    if (Array.isArray(bonuslist)) {
      bonuslist.forEach((bonus, index) => {
        if (bonus) update[`system.bonuslist.${index}.isactive`] = active;
      });
    } else if (bonuslist && typeof bonuslist === "object") {
      for (const bonusKey of Object.keys(bonuslist)) {
        update[`system.bonuslist.${bonusKey}.isactive`] = active;
      }
    }

    updates.push(update);
  }

  if (updates.length > 0) await actor.updateEmbeddedDocuments("Item", updates);
  await actor.update({ "system.settings.isupdated": false });
  return true;
}
