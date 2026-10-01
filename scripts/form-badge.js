/**
 * Canvas badge renderer.
 *
 * Draws a small plate underneath a token that shows the icon (and optionally
 * the localized name) of the shapeshifting form the actor is currently in.
 *
 * The badge is attached as a child of the Token placeable, which means it
 * moves, hides and fades together with the token for free - we only need to
 * re-lay it out when the token is refreshed or the form changes.
 */

import { getActiveForm } from "./forms.js";
import { getSettings } from "./settings.js";

/** Property used to stash the badge container on a Token placeable. */
const BADGE_PROP = "werewolfFormBadge";

const BG_COLOR = 0x1c1108;
const BORDER_COLOR = 0x000000;

/** The nameplate font size used by core (`Token#_getTextStyle`). */
const NAMEPLATE_FONT_SIZE = 24;

export class FormBadge {

  /* -------------------------------------------- */
  /*  Public API                                  */
  /* -------------------------------------------- */

  /**
   * @param {Token} token
   * @returns {PIXI.Container|null}
   */
  static getBadge(token) {
    return token?.[BADGE_PROP] ?? null;
  }

  /**
   * Ensure the token has a badge and refresh it.
   * @param {Token} token
   * @returns {PIXI.Container|null}
   */
  static attach(token) {
    return this.refresh(token);
  }

  /**
   * Update the badge of a single token (creating it when necessary).
   * @param {Token} token
   * @returns {PIXI.Container|null}
   */
  static refresh(token) {
    if (!token || token.destroyed || !token.document) return null;

    let badge = token[BADGE_PROP];
    if (!badge || badge.destroyed) {
      badge = this.#create(token);
      token[BADGE_PROP] = badge;
    }

    const settings = getSettings();
    const actor = token.actor;

    // Для игроков: по умолчанию плашка видна на любом видимом токене,
    // но настройкой можно ограничить её только акторами, к которым есть доступ.
    const permitted = !settings.showOnlyObservable
      || game.user?.isGM
      || actor?.testUserPermission?.(game.user, "LIMITED") === true;

    const form = (settings.enabled && actor && permitted) ? getActiveForm(actor) : null;

    // Nothing to show: not a shifter, or the configured "hidden" form.
    if (!form || !form.icon || (settings.hideHomid && form.key === "homid")) {
      badge.visible = false;
      return badge;
    }

    this.#applyTexture(badge, form.icon);
    this.#layout(token, badge, form, settings);
    badge.visible = true;
    return badge;
  }

  /**
   * Refresh every token on the current scene.
   */
  static refreshAll() {
    for (const token of this.#tokens()) this.refresh(token);
  }

  /**
   * Refresh every token that belongs to the given actor.
   * @param {Actor|null|undefined} actor
   */
  static refreshActor(actor) {
    if (!actor?.id) return;
    for (const token of this.#tokens()) {
      if (token.document?.actorId === actor.id) this.refresh(token);
    }
  }

  /**
   * Remove and destroy the badge of a token.
   * @param {Token} token
   */
  static detach(token) {
    const badge = token?.[BADGE_PROP];
    if (!badge) return;
    try {
      badge.parent?.removeChild(badge);
      badge.destroy({ children: true });
    } catch {
      // The token may already be tearing down its children.
    }
    delete token[BADGE_PROP];
  }

  /* -------------------------------------------- */
  /*  Internals                                   */
  /* -------------------------------------------- */

  /** @returns {Token[]} */
  static #tokens() {
    return canvas?.tokens?.placeables ?? [];
  }

  /**
   * @param {Token} token
   * @returns {PIXI.Container}
   */
  static #create(token) {
    const container = new PIXI.Container();
    container.name = "werewolf-gui-badge";
    container.eventMode = "none";
    container.interactiveChildren = false;
    container.zIndex = 100; // Draw above the nameplate / core status icons.
    container.visible = false;

    container.bg = container.addChild(new PIXI.Graphics());

    container.icon = container.addChild(new PIXI.Sprite(PIXI.Texture.EMPTY));
    container.icon.anchor.set(0, 0.5);

    container.label = container.addChild(new PIXI.Text("", this.#textStyle(16)));
    container.label.anchor.set(0, 0.5);

    container._iconUrl = null;
    container._fontSize = 0;

    token.addChild(container);
    return container;
  }

  /**
   * @param {number} fontSize
   * @returns {PIXI.TextStyle}
   */
  static #textStyle(fontSize) {
    const family = CONFIG.canvasTextStyle?.fontFamily ?? "Signika, sans-serif";
    return new PIXI.TextStyle({
      fontFamily: family,
      fontSize,
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: Math.max(1, Math.round(fontSize * 0.14)),
      align: "left"
    });
  }

  /**
   * @param {PIXI.Container} badge
   * @param {string} url
   */
  static #applyTexture(badge, url) {
    if (badge._iconUrl === url && badge.icon.texture && badge.icon.texture !== PIXI.Texture.EMPTY) return;
    badge._iconUrl = url;

    const cached = this.#getTexture(url);
    if (cached) {
      badge.icon.texture = cached;
      return;
    }

    this.#loadTexture(url)
      .then(texture => {
        if (!texture || badge.destroyed || badge._iconUrl !== url) return;
        badge.icon.texture = texture;
        this.#fitIcon(badge);
      })
      .catch(() => {});
  }

  /**
   * Scale the icon sprite so it fills a square of `badge._iconSize` world units.
   * Runs again once an asynchronously loaded texture arrives.
   * @param {PIXI.Container} badge
   */
  static #fitIcon(badge) {
    const size = badge._iconSize ?? 0;
    const texture = badge.icon.texture;
    const width = texture?.orig?.width ?? texture?.width ?? 0;
    const height = texture?.orig?.height ?? texture?.height ?? 0;
    if (size > 0 && width > 0 && height > 0) badge.icon.scale.set(size / width, size / height);
    else badge.icon.scale.set(1, 1);
  }

  /** @param {string} url */
  static #getTexture(url) {
    try {
      return foundry.canvas.getTexture(url) ?? null;
    } catch {
      return globalThis.getTexture?.(url) ?? null;
    }
  }

  /** @param {string} url @returns {Promise<PIXI.Texture>} */
  static #loadTexture(url) {
    try {
      return foundry.canvas.loadTexture(url, { fallback: "icons/svg/hazard.svg" });
    } catch {
      return globalThis.loadTexture(url, { fallback: "icons/svg/hazard.svg" });
    }
  }

  /**
   * Recompute size, position and background of the badge.
   * @param {Token} token
   * @param {PIXI.Container} badge
   * @param {{key:string|null, icon:string|null, label:string}} form
   * @param {ReturnType<typeof getSettings>} settings
   */
  static #layout(token, badge, form, settings) {
    const s = canvas.dimensions?.uiScale ?? 1;
    const size = token.document.getSize();
    const tokenWidth = size?.width ?? token.w ?? 100;
    const tokenHeight = size?.height ?? token.h ?? 100;

    const showLabel = settings.showLabel && !!form.label;
    const iconSize = Math.max(16, Math.round(tokenWidth * settings.badgeSize));
    const pad = Math.max(2, Math.round(iconSize * 0.10));
    const radius = Math.max(2, Math.round(iconSize * 0.16));
    const fontSize = Math.max(8, Math.round(iconSize * 0.42));

    // --- Label text ---------------------------------------------------------
    badge.label.text = form.label ?? "";
    badge.label.visible = showLabel;
    if (badge._fontSize !== fontSize) {
      badge.label.style = this.#textStyle(fontSize);
      badge._fontSize = fontSize;
    }

    const labelWidth = showLabel ? Math.ceil(badge.label.width) : 0;
    const labelHeight = showLabel ? Math.ceil(badge.label.height) : 0;

    const innerHeight = Math.max(iconSize, labelHeight);
    const totalWidth = pad * 2 + iconSize + (showLabel ? pad + labelWidth : 0);
    const totalHeight = pad * 2 + innerHeight;
    const centerY = totalHeight / 2;

    // --- Icon ---------------------------------------------------------------
    badge.icon.position.set(pad, centerY);
    badge._iconSize = iconSize;
    this.#fitIcon(badge);

    // --- Label position -----------------------------------------------------
    badge.label.position.set(pad * 2 + iconSize, centerY);

    // --- Placement relative to the token ------------------------------------
    const offset = (CONFIG.Canvas?.objectBorderThickness ?? 4) * 0.75 * s;
    const nameplateVisible = token.nameplate?.visible === true;
    const nameplateHeight = nameplateVisible ? NAMEPLATE_FONT_SIZE * s : 0;

    let x;
    let y;
    switch (settings.position) {
      case "bottom-right":
        x = tokenWidth - totalWidth;
        y = tokenHeight + offset + nameplateHeight;
        break;
      case "bottom-left":
        x = 0;
        y = tokenHeight + offset + nameplateHeight;
        break;
      case "top-center":
        x = (tokenWidth - totalWidth) / 2;
        y = -totalHeight - offset;
        break;
      case "bottom-center":
      default:
        x = (tokenWidth - totalWidth) / 2;
        y = tokenHeight + offset + nameplateHeight;
        break;
    }

    // --- Background plate ---------------------------------------------------
    // Перерисовываем графику только когда геометрия действительно изменилась:
    // refreshToken вызывается и на каждом кадре анимации движения.
    const layoutKey = [
      totalWidth, totalHeight, radius, iconSize,
      settings.opacity, showLabel, form.label ?? ""
    ].join("|");
    if (badge._layoutKey !== layoutKey) {
      const bg = badge.bg;
      bg.clear();
      bg.lineStyle(Math.max(1, Math.round(iconSize * 0.06)), BORDER_COLOR, 1);
      bg.beginFill(BG_COLOR, Math.max(0.2, Math.min(1, settings.opacity)));
      bg.drawRoundedRect(0, 0, totalWidth, totalHeight, radius);
      bg.endFill();
      badge._layoutKey = layoutKey;
    }

    badge.position.set(Math.round(x), Math.round(y));
  }
}
