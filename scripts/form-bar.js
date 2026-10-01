/**
 * Панель быстрого переключения форм.
 *
 * Небольшое перемещаемое окно (ApplicationV2) с кнопками-формами текущего
 * актора. Цель определяется так:
 *   1. выбранный (controlled) токен, если его актор - оборотень;
 *   2. иначе назначенный персонаж пользователя (game.user.character), если он оборотень;
 *   3. иначе панель скрывается.
 *
 * Позиция окна запоминается в клиентской настройке `formBarPosition`.
 */

import { MODULE_ID, KEYS, getSettings } from "./settings.js";
import { getFormOptions, isShifter, setForm } from "./forms.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Актор, для которого сейчас показывать панель.
 * @returns {Actor|null}
 */
function resolveTargetActor() {
  const controlled = (canvas?.tokens?.controlled ?? [])
    .map(token => token.actor)
    .filter(Boolean);

  const controlledShifter = controlled.find(actor => isShifter(actor));
  if (controlledShifter) return controlledShifter;

  const character = game.user?.character;
  if (character && isShifter(character)) return character;

  return null;
}

/**
 * Позиция по умолчанию: справа внизу, левее развёрнутого сайдбара.
 * @param {DOMRect} rect
 * @returns {{left:number, top:number}}
 */
function defaultPosition(rect) {
  const sidebarVisible = ui?.sidebar?.expanded === true;
  const sidebarWidth = sidebarVisible ? (ui?.sidebar?.element?.offsetWidth ?? 300) : 0;
  const left = Math.max(8, window.innerWidth - rect.width - 20 - sidebarWidth);
  const top = Math.max(8, window.innerHeight - rect.height - 20 - 110);
  return { left, top };
}

export class FormBar extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "werewolf-gui-form-bar",
    classes: ["werewolf-gui", "wg-form-bar"],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "werewolf-gui.formBar.title",
      icon: "fa-solid fa-paw",
      resizable: false,
      minimizable: true
    },
    position: { width: 300, height: "auto" },
    actions: {
      setForm: FormBar.#onSetForm
    }
  };

  static PARTS = {
    body: { template: "modules/werewolf-gui/templates/form-bar.hbs" }
  };

  /** @type {FormBar|null} */
  static instance = null;

  /** @type {number|null} */
  static #refreshTimer = null;

  #actor = null;
  #programmaticClose = false;
  #saveTimer = null;

  /* -------------------------------------------- */
  /*  Жизненный цикл                              */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const actor = resolveTargetActor();
    this.#actor = actor;
    const settings = getSettings();
    return {
      hasActor: !!actor,
      actorName: actor?.name ?? "",
      forms: actor ? getFormOptions(actor) : [],
      showLabels: settings.formBarShowLabels,
      locked: !(actor?.isOwner || game.user?.isGM)
    };
  }

  /** @override */
  async _onFirstRender(context, options) {
    await super._onFirstRender?.(context, options);

    const saved = getSettings().formBarPosition ?? {};
    const hasSaved = Number.isFinite(saved.left) && Number.isFinite(saved.top);
    const rect = this.element?.getBoundingClientRect();
    this.setPosition(hasSaved ? { left: saved.left, top: saved.top } : defaultPosition(rect ?? {width: 0, height: 0}));
  }

  /** @override */
  _onRender(context, options) {
    super._onRender?.(context, options);

    const title = this.element?.querySelector(".window-title");
    if (!title) return;
    const base = game.i18n.localize("werewolf-gui.formBar.title");
    title.textContent = context.actorName ? `${base}: ${context.actorName}` : base;
  }

  /** @override */
  _onPosition(position) {
    clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => {
      game.settings.set(MODULE_ID, KEYS.formBarPosition, { left: position.left, top: position.top })
        .catch(() => {});
    }, 400);
  }

  /** @override */
  _onClose(options) {
    super._onClose?.(options);
    clearTimeout(this.#saveTimer);
    if (!this.#programmaticClose) {
      // Закрытие пользователем = выключить панель (включается в настройках или по горячей клавише).
      game.settings.set(MODULE_ID, KEYS.formBarEnabled, false).catch(() => {});
    }
    this.#programmaticClose = false;
    if (FormBar.instance === this) FormBar.instance = null;
  }

  /* -------------------------------------------- */
  /*  Действия                                    */
  /* -------------------------------------------- */

  /**
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onSetForm(event, target) {
    event.preventDefault();
    event.stopPropagation();

    const key = target?.dataset?.form;
    const actor = this.#actor;
    if (!key || !actor) return;

    if (!(actor.isOwner || game.user?.isGM)) {
      ui.notifications.warn(game.i18n.localize("werewolf-gui.notifications.noPermission"));
      return;
    }

    target.classList.add("busy");
    try {
      await setForm(actor, key);
    } catch (error) {
      console.error(`${MODULE_ID} | Не удалось сменить форму:`, error);
      ui.notifications.error(game.i18n.localize("werewolf-gui.notifications.switchFailed"));
    } finally {
      target.classList.remove("busy");
    }
  }

  /* -------------------------------------------- */
  /*  Управление                                  */
  /* -------------------------------------------- */

  /** Перерисовать панель с небольшой задержкой (хуки приходят пачками). */
  static scheduleUpdate(delay = 60) {
    clearTimeout(FormBar.#refreshTimer);
    FormBar.#refreshTimer = setTimeout(() => {
      FormBar.#refreshTimer = null;
      void FormBar.update();
    }, delay);
  }

  /** Показать/скрыть панель в соответствии с настройками и текущей целью. */
  static async update() {
    const settings = getSettings();
    if (!settings.formBarEnabled) return FormBar.hide();

    const actor = resolveTargetActor();
    if (!actor) return FormBar.hide();
    if (!(actor.isOwner || game.user?.isGM)) return FormBar.hide();

    return FormBar.show();
  }

  /** Показать панель (создать при необходимости). */
  static async show() {
    let app = FormBar.instance;
    if (!app) {
      app = new FormBar();
      FormBar.instance = app;
    }
    if (app.rendered) await app.render();
    else await app.render({ force: true });
  }

  /** Скрыть панель без выключения настройки. */
  static async hide() {
    const app = FormBar.instance;
    if (!app) return;
    app.#programmaticClose = true;
    await app.close();
  }

  /** Переключить панель (горячая клавиша / настройка). */
  static async toggle() {
    const enabled = getSettings().formBarEnabled;
    await game.settings.set(MODULE_ID, KEYS.formBarEnabled, !enabled);
  }
}
