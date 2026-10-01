# Werewolf GUI

A Foundry VTT module for the **World of Darkness 20th edition** system that shows the
current shapeshifting form of Werewolf (and other shifter) characters **right on the
canvas**, and gives players a one-click form switcher.

> 🇷🇺 Русская документация: [README.ru.md](README.ru.md)

---

## What it does

| | |
| --- | --- |
| 🐺 **Form badge** | A small icon plate **under the token** shows the active form (Homid / Glabro / Crinos / Hispo / Lupus). It follows the token, respects hidden/secret tokens and updates on every client. |
| 🎛 **Form bar** | A small movable panel with one button per form. Position is remembered per user; hotkey **G** toggles it. No need to open the character sheet. |
| 🔄 **Sync** | The base actor and its unlinked tokens are kept in sync, so a form change updates the sheet, the token, and every scene. |
| 🧩 **Both sheet types** | Works with the legacy `Werewolf` / `Changing Breed` sheets **and** with the new `PC` actor sheet. |
| 🎨 **No duplicated art** | Icons are taken from the system assets (`systems/worldofdarkness/assets/img/werewolf/form/*.svg`). |

---

## Requirements

- **Foundry VTT 14**
- System **World of Darkness 20th edition** (`worldofdarkness`), tested with `7.3.1`

---

## Installation

In Foundry VTT open **Add-on Modules → Install Module** and paste the manifest URL:

```
https://github.com/ZmeugatGPT/werewolf-gui/releases/latest/download/module.json
```

Then enable **Werewolf GUI** in *Manage Modules* and reload the world.

<details>
<summary>Manual installation</summary>

1. Download `werewolf-gui.zip` from the [latest release](https://github.com/ZmeugatGPT/werewolf-gui/releases/latest).
2. Extract it into `{userData}/Data/modules/werewolf-gui/` so that `module.json`
   ends up at the root of that folder.
3. Restart Foundry and enable the module.

</details>

---

## Settings

All settings are **client-scoped** (each user configures them for themselves),
except the synchronization setting, which is world-scoped and controlled by the GM.

| Setting | Default | Description |
| --- | --- | --- |
| Enable form badge | on | Master switch for the token badge. |
| Hide built-in status icon | on | Hides the status-effect icon the system draws on the token so it does not duplicate the badge. |
| Show form name | on | Show the localized form name next to the badge icon. |
| Hide in breed form | off | Do not show the badge while the actor is in its human (Homid) form. |
| Badge size | 0.45 | Badge icon size as a fraction of the token width. |
| Background opacity | 0.85 | Opacity of the badge background plate. |
| Badge position | Below, centered | `bottom-center`, `bottom-right`, `bottom-left`, `top-center`. |
| Only show on accessible actors | off | Show the badge only where the user has at least *Limited* permission on the actor. |
| Show form bar | on | The movable quick form switcher. |
| Show form names on the bar | on | Show the form name under each button. |
| **Sync form to unlinked tokens** (world) | on | Keeps the base actor and its unlinked tokens in sync in both directions. |

**Hotkey:** `G` shows/hides the form bar (rebindable in *Configure Controls → Werewolf GUI*).

---

## Form bar

- **Target actor:** the controlled token if its actor is a shifter, otherwise the
  user's assigned character (`game.user.character`). If neither is available — or
  the user has no permission — the bar hides itself.
- **Moving:** drag the window by its title. The position is saved per user in the
  client setting `formBarPosition`.
- **Hiding:** the ✕ button turns the *Show form bar* setting off; re-enable it in the
  module settings or press **G**.
- **Switching** works like activating a form on the character sheet: `system.shapes`
  and the related bonus items are updated for legacy sheets, form `Trait` items and
  their bonus lists for `PC` sheets, after which the system recalculates totals.
  For non-werewolf `PC` splats the system's shapeshifting roll is **not** requested.

---

## API

```js
const api = game.modules.get("werewolf-gui").api;

// Active form of an actor: { key, icon, label, source } | null
api.getActiveForm(actor);

// Redraw everything / only the tokens of one actor.
api.refresh();
api.refreshActor(actor);

// Enable or disable "Link Actor Data" on every token of an actor, on every scene.
// GM only. WARNING: linking discards the token's own ActorDelta changes.
await api.linkTokens(actor, true);

// The form bar.
await api.showFormBar();
await api.hideFormBar();
await api.toggleFormBar();
```

---

## How it works

The badge is a `PIXI.Container` added as a **child of the token placeable**, so it
moves, hides and fades together with the token; only its layout is recalculated.
The form bar is an `ApplicationV2` window.

| Hook | Purpose |
| --- | --- |
| `canvasReady` | Create badges for every token of the scene. |
| `drawToken` | Create the badge for a new token. |
| `refreshToken` | Re-layout on token refresh. |
| `destroyToken` | Remove the badge. |
| `controlToken` | Re-target the form bar. |
| `updateToken` | React to hidden/texture/size changes. |
| `updateActor` | React to `system.shapes` changes and sync unlinked tokens. |
| `createItem` / `updateItem` / `deleteItem` | React to form item changes (`PC` actors). |
| `createActiveEffect` / `updateActiveEffect` / `deleteActiveEffect` | Keep in step with the system's status effects. |

Dependencies on the system (intentionally reused instead of duplicating assets):

- `actor.system.shapes` and `Trait` items with `system.type === "wod.types.shapeform"`;
- `assets/img/werewolf/form/*.svg` (fallback: `assets/img/shapes/*.svg`);
- localization keys `wod.shapes.*`;
- the system's service effects flagged with `flags.worldofdarkness.shapeformIcon`.

---

## Development

```bash
# Point the manifest at your own fork (rewrites module.json + README links)
node tools/configure.mjs --owner <you> --repo <repo> --version 1.1.0

# Build dist/module.json and dist/werewolf-gui.zip
node tools/build.mjs
```

Releases are produced by GitHub Actions on every `v*` tag
(`.github/workflows/release.yml`): the workflow injects the real repository URL and
version into `module.json`, builds the zip, and publishes a release with
`module.json` and `werewolf-gui.zip` attached.

---

## License

Module code is released under the [MIT License](LICENSE).

The form icons and all World of Darkness content belong to their respective
rights holders and are **not** distributed with this module — it only references
the assets shipped by the `worldofdarkness` system.
