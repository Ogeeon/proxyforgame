# 4. Player profiles live in the browser, keyed locally, with a game layer and an override layer

Date: 2026-10-11

## Status

Accepted. Not yet implemented — the phases are in `.claude/plans/player-profiles.md`.

## Context

Every calculator asks for the same account data again: player class, research levels,
officers, life-form bonuses, the universe. Production, graviton, terraformer, lfcosts and
queue also ask for the same planet: temperature, mine levels, life-form buildings. Each
calculator stores its answers in its own `options_<calc>` key, and nothing is shared.
Flight and production have named save slots labelled "profile" (`flight_uni_<name>`,
`prod_uni_<name>`), but each is private to its calculator and carries no identity: a
production slot does not even know its universe.

The player data can now come from one source. The third-party userscript
[origin-exporter](https://github.com/Rivenscryr/origin-exporter) wraps the game's
`externaldataexport` endpoint (`accountInfo` + `speciesBonuses`). It produces one JSON
document with the whole account and every planet and moon. It does not say which universe
it came from; we asked the maintainer to add that
([issue #1](https://github.com/Rivenscryr/origin-exporter/issues/1)). The game endpoint
cannot be called from our pages: it needs the player's game session, and CORS does not
allow it.

A player can have several accounts in one universe, so the account identity is a
compound of universe and player id.

Pasting an export is a chore the player repeats after every change in the game. The
OValue Exporter userscript shows another way: it reads the same `accountInfo` endpoint
whenever the player opens the game, keeps the result in the script's storage, and hands it
to its own site when the player opens that, through `localStorage` and a `CustomEvent`. The
player does nothing after installing it.

## Decision

A **profile** is one OGame account: universe, account data and its planets and moons. A
global selector in the top bar of every calculator chooses the **active profile**, and the
calculators read from it and write back to it.

- **Browser only.** Profiles are stored in `localStorage`: no registration, and no player
  data on our server. Re-importing the account export restores only the game layer.
  Overrides, production percentages, exchange rates and manual profiles exist nowhere but
  in that browser. Clearing site data loses them, and so does Safari's own purge of a
  site unused for about seven days. **Exporting and importing profiles as a file is
  therefore part of the first release**, not an extra. The site also asks the browser for
  persistent storage (`navigator.storage.persist()`), which lowers the risk but does not
  remove it.
- **A local id is the primary key.** The universe and the game's `playerId` are
  attributes. A re-import finds its profile by "same universe and same `playerId`". A
  profile created by hand has neither attribute and works all the same.
- **Our own normalized model, versioned**, not the exporter's JSON stored verbatim. The
  import is a translation into that model, so an exporter format change touches one
  translator and not ten calculators.
- **Two layers per value: game and override.** The import replaces the game layer and
  clears the overrides only for the fields it filled itself. Production percentages, for
  example, never come from the export, so their overrides survive. Fields that differ from
  the game are marked in every calculator and can be reset. A manual profile has no game
  layer, and then no marks are shown.
- **Two-way binding.** Editing a profile-owned field in a calculator writes it to the
  profile. Fields that belong to the calculator — fleet composition, the build queue,
  modes and tabs — never enter the profile. With a profile active, profile-owned fields
  are not written to `options_<calc>`, so "no profile" still shows the calculator's own
  values from before.
- **The life-form bonuses are stored as the final percentages** the calculators ask for,
  taken from the game's `speciesBonuses`, not recomputed from building levels with our
  formulas.
- **The active profile is per tab** (`sessionStorage`). `localStorage` only remembers the
  last choice, for a new tab. Two accounts can then be open side by side.
- **Two ways in for the account export: paste and sync.** Pasting stays and is always
  available; it is the only way on a phone. **Sync** is our own collector, run inside the
  game page: it calls `accountInfo` and `speciesBonuses` and produces the same document as
  origin-exporter, plus the universe from `location.hostname`. One translator serves both.
  On our pages it writes the document to our origin's `localStorage` and dispatches an
  event; the page reads the key on load and listens for the event, since the collector may
  start after the page has initialised.
- **The collector behaves like a player, not a bot.** It makes requests only on a game page
  the player opened, at most once every few minutes, never from a timer or a background
  context, and never with `cp=` (that switches the planet and shows activity in the
  galaxy). What the endpoints lack — production percentages — it reads from the DOM of
  `component=resourcesettings` when the player opens that page.
- **A sync applies only newer data.** It imports a document only when the document was
  collected after the profile's `importedAt`, so an override survives until the player
  next visits the game, exactly as it would until the next manual paste. Reloading
  calculators does not wipe it.
- **One collector source, two wrappers.** The collection and hand-off code is shared. It
  ships first as a **userscript**, while the export format and the sync rule can still
  change and a fix must reach players at once. A **browser extension** (Chrome Web Store
  and AMO) follows once the format is stable, and becomes the option the site recommends;
  the userscript stays for players who already run a script manager. Both are released
  separately from the site with their own version numbers, never auto-updated from
  `main`.
- **Universe settings are not in the profile.** The profile names its universe. The
  settings (speeds, donut, deuterium factor) come from the existing `serverdata` service
  and are cached per universe, shared by every profile in it.

## Considered options

- **Server-side accounts on proxyforgame.** They would sync between devices, but bring
  registration, passwords, other people's game data on our host and a privacy policy to
  match. That is out of proportion to the problem.
- **A key built from game data ("universe/playerId/planetId").** It does not exist for a
  manual profile. It also does not exist for an export without the universe (exporter
  schema 1), and replacing a primary key later means rewriting everything that refers to
  it.
- **One-way fill (the profile fills the fields, and edits stay in the calculator).** A
  manual profile would then never fill up. A "save to profile" button gets forgotten.
- **Importing overwrites everything and keeps no layers.** A "what if the mine were 40"
  experiment would silently become the account's truth in every calculator, and the next
  import would silently erase it.
- **Detaching a calculator while experimenting.** The detachment is local to one page, so
  a second calculator would show a different scenario than the player believes.
- **Recomputing life-form bonuses from levels.** That means reproducing every life-form
  research formula with the species-level amplifier. Our formulas have already diverged
  from the game once; the game's own totals are exact by definition.
- **Paste only.** It works everywhere, but the profile goes stale unless the player keeps
  pasting, and most will not.
- **Contributing a bridge to origin-exporter instead of writing our own.** Its script
  would need a `@match` for our domains and a hand-off tailored to our pages; the universe
  issue shows the turnaround on even a small change. Our collector is a few hundred lines
  over two documented endpoints, and it lets us add the production percentages.
- **A sync that clears overrides, like a paste does.** Every page load after any game
  visit would silently undo a what-if experiment.
- **Polling the game from the extension's background.** Technically possible with host
  permissions, but it is automated traffic in the player's session, the kind of thing the
  game's rules are written against.
- **Extension only.** Chrome now makes userscript managers ask for an extra "Allow user
  scripts" switch, so an extension installs more easily. But store review delays every
  fix by hours to days, Chrome Web Store wants a privacy policy and a data disclosure, and
  Safari needs a paid Apple developer account; none of that is worth paying while the
  format still moves.
- **The active profile shared by all tabs.** It makes the main use case — two accounts in
  one universe — impossible to work with side by side.

## Consequences

- The saved-set migration moves the most valuable hand-entered data — production
  percentages per planet — into the same browser-only store. The profile-file export must
  therefore ship no later than the migration, and the migration dialog offers it.
- The UI word "profile" changes meaning. The old named slots become profiles:
  `flight_uni_*` and `prod_uni_*` are converted, after the user agrees in a one-time
  dialog, into manual profiles. Their keys are kept for a few months as a backup.
  `flight_fleet_*` is a fleet preset, not account data, and stays as it is.
- Merging two profiles becomes a needed operation: a converted slot and an import of the
  same account. The primary profile keeps its values and only takes what it lacks; planets
  are matched by coordinates.
- An imported profile's universe is locked when it came from the export, because changing
  it would break the re-import match. It stays editable when the user typed it in during
  a schema-1 import.
- Exchange rates become account data with no game layer. The canonical form is
  `[metal, crystal, deuterium]` in metal units. Trade converts it to its own `{md, cd}`.
- The collector runs our code inside the player's game session, so it has to stay small
  and readable: no cross-origin requests (`GM_xmlhttpRequest`, `@connect`), source in this
  repository. Whoever controls the GreasyFork or store account can push code into every
  user's game: those accounts need two-factor authentication.
- A synced profile is only as fresh as the player's last visit to the game. The UI shows
  when the game layer was collected.
- Neither wrapper reaches Chrome on Android or Safari on iOS, so paste is never retired.
- Every calculator keeps working with no profile at all. That is the default and the
  rollback path.
