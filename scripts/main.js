/**
 * Werewolf GUI - точка входа модуля.
 *
 * Модуль рисует под токеном актора-оборотня (или сменного вида) иконку текущей
 * формы: хомид / глабро / кринос / хиспо / люпус.
 *
 * Поддерживаются обе схемы данных системы worldofdarkness:
 *   - старые листы (актор типа "Werewolf" / "Changing Breed") -> actor.system.shapes
 *   - новый лист PC -> предметы Trait с system.type === "wod.types.shapeform"
 */

import { MODULE_ID, registerSettings, getSettings } from "./settings.js";
import { FormBadge } from "./form-badge.js";
import { getActiveForm, FORM_KEYS } from "./forms.js";
import { FormBar } from "./form-bar.js";

/** Идентификаторы статусов формы, которые создаёт сама система. */
const SHAPEFORM_STATUS_PREFIX = "wod_shapeform_";

/** Единый обработчик перерисовки для настроек. */
const redrawAll = () => FormBadge.refreshAll();

/** Реакция на изменение настроек модуля. */
function onSettingsChange() {
  FormBadge.refreshAll();
  void FormBar.update();
}

/** Обновить плашки токенов и панель форм для одного актора. */
function refreshActorUI(actor) {
  FormBadge.refreshActor(actor);
  FormBar.scheduleUpdate();
}

/* -------------------------------------------- */
/*  Инициализация                               */
/* -------------------------------------------- */

Hooks.once("init", () => {
  registerSettings(onSettingsChange);

  // Горячая клавиша для быстрого включения/выключения панели форм.
  game.keybindings.register(MODULE_ID, "toggleFormBar", {
    name: "werewolf-gui.keybindings.toggleFormBar.name",
    hint: "werewolf-gui.keybindings.toggleFormBar.hint",
    editable: [{ key: "KeyG" }],
    onDown: () => {
      void FormBar.toggle();
      return true;
    }
  });

  console.log(`${MODULE_ID} | Инициализация модуля`);
});

Hooks.once("ready", () => {
  // Скрываем "родные" иконки форм на токене, если включена соответствующая
  // настройка: модуль рисует свою плашку под токеном.
  if (getSettings().hideSystemIcon) {
    for (const actor of game.actors ?? []) {
      for (const effect of actor.effects ?? []) {
        void hideSystemShapeformIcon(effect);
      }
    }
  }

  // Небольшой публичный API для макросов и других модулей.
  const module = game.modules.get(MODULE_ID);
  if (module) {
    module.api = {
      refresh: redrawAll,
      refreshActor: actor => FormBadge.refreshActor(actor),
      getActiveForm,
      linkTokens: (actor, link = true) => setActorTokensLinked(actor, link),
      showFormBar: () => FormBar.show(),
      hideFormBar: () => FormBar.hide(),
      toggleFormBar: () => FormBar.toggle()
    };
  }

  // Панель форм: показать, если она включена и есть подходящий актор.
  FormBar.scheduleUpdate(0);
});

/* -------------------------------------------- */
/*  Хуки канваса                                */
/* -------------------------------------------- */

Hooks.on("canvasReady", () => {
  FormBadge.refreshAll();
  FormBar.scheduleUpdate();
});

Hooks.on("controlToken", () => FormBar.scheduleUpdate());

Hooks.on("drawToken", token => FormBadge.attach(token));

Hooks.on("refreshToken", token => FormBadge.refresh(token));

Hooks.on("destroyToken", token => FormBadge.detach(token));

Hooks.on("updateToken", document => {
  // Смена скрытости, текстур, размера и т.п. - обновляем плашку.
  if (document?.object) FormBadge.refresh(document.object);
  FormBar.scheduleUpdate();
});

/* -------------------------------------------- */
/*  Хуки данных                                 */
/* -------------------------------------------- */

Hooks.on("updateActor", (actor, changes) => {
  refreshActorUI(actor);
  // Несвязанные токены хранят собственную копию форм в delta, поэтому правка
  // базового актора (лист из списка персонажей) до них не доходит - переносим.
  // Пишет в мир только ГМ (см. syncUnlinkedTokenForms).
  void syncUnlinkedTokenForms(actor, changes);
});

for (const hook of ["createItem", "updateItem", "deleteItem"]) {
  Hooks.on(hook, item => {
    // Предметы актора: перерисовываем все токены этого актора.
    if (item?.parent?.documentName === "Actor") refreshActorUI(item.parent);
  });
}

Hooks.on("createActiveEffect", effect => {
  void hideSystemShapeformIcon(effect);
  if (effect?.parent?.documentName === "Actor") refreshActorUI(effect.parent);
});

Hooks.on("updateActiveEffect", effect => {
  void hideSystemShapeformIcon(effect);
  if (effect?.parent?.documentName === "Actor") refreshActorUI(effect.parent);
});

Hooks.on("deleteActiveEffect", effect => {
  if (effect?.parent?.documentName === "Actor") refreshActorUI(effect.parent);
});

/* -------------------------------------------- */
/*  Синхронизация формы с несвязанными токенами */
/* -------------------------------------------- */

/**
 * Ключ активной формы по объекту `system.shapes`.
 * @param {object|null|undefined} shapes
 * @returns {string|null}
 */
function activeShapeKey(shapes) {
  if (!shapes || typeof shapes !== "object") return null;
  for (const key of FORM_KEYS) {
    if (shapes[key]?.isactive) return key;
  }
  for (const [key, value] of Object.entries(shapes)) {
    if (value?.isactive) return key;
  }
  return null;
}

/**
 * Несвязанный токен (`actorLink: false`) держит собственную копию
 * `system.shapes` в своём delta, поэтому смена формы на базовом акторе
 * (лист, открытый из списка персонажей) его не затрагивает.
 *
 * Здесь мы переносим выбранную форму базового актора в delta таких токенов,
 * чтобы плашка на карте обновлялась из любого места.
 *
 * @param {Actor} actor          Базовый (мировой) актор
 * @param {object} changes       Дифф изменений
 */
async function syncUnlinkedTokenForms(actor, changes) {
  try {
    if (!game.user?.isGM) return;                              // мир меняет только ГМ
    if (!getSettings().syncUnlinkedTokens) return;
    if (!actor || actor.isToken) return;                       // только базовый актор
    if (!("shapes" in (changes?.system ?? {}))) return;        // менялись не формы

    const baseShapes = actor.system?.shapes;
    if (!baseShapes) return;

    const baseActive = activeShapeKey(baseShapes);
    if (!baseActive) return;

    for (const scene of game.scenes ?? []) {
      const updates = [];

      for (const tokenDoc of scene.tokens ?? []) {
        if (tokenDoc.actorId !== actor.id || tokenDoc.actorLink) continue;

        // Если токен уже показывает нужную форму - ничего не трогаем.
        const effective = activeShapeKey(tokenDoc.actor?.system?.shapes);
        if (effective === baseActive) continue;

        // Переносим только флаги isactive, остальные поля пусть наследуются.
        const shapes = {};
        for (const [key, value] of Object.entries(baseShapes)) {
          shapes[key] = { isactive: value?.isactive === true };
        }

        updates.push({ _id: tokenDoc.id, "delta.system.shapes": shapes });
      }

      if (updates.length > 0) {
        await scene.updateEmbeddedDocuments("Token", updates);
      }
    }
  } catch (error) {
    console.warn(`${MODULE_ID} | Не удалось синхронизировать форму с несвязанным токеном:`, error);
  }
}

/* -------------------------------------------- */
/*  Служебные операции                          */
/* -------------------------------------------- */

/**
 * Включить/выключить связь данных актора ("Link Actor Data") у всех токенов
 * этого актора на всех сценах.
 *
 * ВНИМАНИЕ: при включении связи Foundry отбрасывает собственные изменения
 * токена (ActorDelta), поэтому вызывать осознанно.
 *
 * @param {Actor} actor
 * @param {boolean} [link=true]
 * @returns {Promise<number>} Количество изменённых токенов
 */
async function setActorTokensLinked(actor, link = true) {
  if (!game.user?.isGM) {
    ui.notifications?.warn(game.i18n.localize("werewolf-gui.notifications.gmOnly"));
    return 0;
  }
  if (!actor) return 0;

  if (link) {
    console.warn(`${MODULE_ID} | Включение "Link Actor Data" отбросит собственные `
      + `изменения токенов актора "${actor.name}" (ActorDelta).`);
  }

  let changed = 0;
  for (const scene of game.scenes ?? []) {
    const updates = [];
    for (const tokenDoc of scene.tokens ?? []) {
      if (tokenDoc.actorId !== actor.id) continue;
      if (!!tokenDoc.actorLink === link) continue;
      updates.push({ _id: tokenDoc.id, actorLink: link });
    }
    if (updates.length > 0) {
      await scene.updateEmbeddedDocuments("Token", updates);
      changed += updates.length;
    }
  }

  ui.notifications?.info(game.i18n.format("werewolf-gui.notifications.linked", { count: changed }));
  return changed;
}

/* -------------------------------------------- */
/*  Совместимость с системной иконкой формы     */
/* -------------------------------------------- */

/**
 * Определяет, является ли ActiveEffect служебной иконкой формы, которую
 * создаёт система worldofdarkness (`_updateShapeformTokenIcon`).
 * @param {ActiveEffect} effect
 * @returns {boolean}
 */
function isShapeformIconEffect(effect) {
  if (!effect) return false;
  if (effect.flags?.worldofdarkness?.shapeformIcon === true) return true;

  const statuses = effect.statuses;
  if (!statuses) return false;
  const keys = (statuses instanceof Set || Array.isArray(statuses))
    ? Array.from(statuses)
    : Object.keys(statuses);
  return keys.some(key => typeof key === "string" && key.startsWith(SHAPEFORM_STATUS_PREFIX));
}

/**
 * Прячет системную иконку формы на токене, чтобы не было дублирования с
 * собственной плашкой модуля. Само действие не удаляется - только скрывается.
 * @param {ActiveEffect} effect
 */
async function hideSystemShapeformIcon(effect) {
  try {
    if (!getSettings().hideSystemIcon) return;
    if (!isShapeformIconEffect(effect)) return;

    const never = CONST.ACTIVE_EFFECT_SHOW_ICON?.NEVER ?? 0;
    if (effect.showIcon === never) return;
    if (!(effect.isOwner || game.user?.isGM)) return;

    await effect.update({ showIcon: never }, { render: false });
  } catch {
    // Нет прав или документ уже удалён - не критично.
  }
}
