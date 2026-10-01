# Changelog

All notable changes to this module are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-10-01

First public release.

### Features

- **Form badge under the token** - displays the active shapeshifting form of a
  Werewolf / Changing Breed actor as an icon plate below its token on the canvas.
  The badge follows the token, and respects hidden/secret tokens.
- **Quick form-switching bar** - a movable `ApplicationV2` window with one button
  per form. Its position is stored per user; hotkey `G` toggles it.
- Support for both data layouts of the system:
  - legacy sheets (`actor.system.shapes`),
  - the new PC Actor sheet (`Trait` items with `system.type === "wod.types.shapeform"`).
- Icon paths are resolved from the system assets
  (`systems/worldofdarkness/assets/img/werewolf/form/*.svg`), with a fallback to
  `.../img/shapes/*.svg`; form names are localized through the system keys
  `wod.shapes.*`.
- **Two-way form synchronization** between the base actor and its unlinked tokens
  (world setting), so the sheet, the token and every scene stay consistent.
- The status-effect icon created by the system is hidden so it does not duplicate
  the badge (client setting).
- Client settings: badge on/off, badge size, position, opacity, form name,
  hide in Homid form, show only on accessible actors, form bar on/off and labels.
- Public API: `game.modules.get("werewolf-gui").api`
  (`getActiveForm`, `refresh`, `refreshActor`, `linkTokens`, `showFormBar`,
  `hideFormBar`, `toggleFormBar`).
- English and Russian localization.

### Compatibility

- Foundry Virtual Tabletop 14.
- World of Darkness 20th edition system (`worldofdarkness`) 7.3.x.
