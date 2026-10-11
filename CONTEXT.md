# ProxyForGame

Calculators for the OGame browser game. The domain is the player's account in one game
universe, and the questions the calculators answer about it.

## Profiles

**Profile**:
One OGame account as the site knows it: its universe, its account data, and its planets
and moons. It is identified by our own id, never by game data.
_Avoid_: account (that is the game's side), user, save, slot

**Active profile**:
The profile the calculators in one browser tab currently read from and write to. With no
active profile, each calculator keeps its own settings.

**Manual profile**:
A profile with no game layer: every value in it was entered by the player.

**Imported profile**:
A profile whose game layer came from an account export.

**Game layer**:
The values a profile holds as the game reported them at the last import.
_Avoid_: original, baseline

**Override**:
A value the player set in a calculator on top of the game layer. An override marks a field
as different from the game until it is reset or a new import supplies that field.
_Avoid_: edit, change, local value

**Profile-owned field**:
A calculator input whose value belongs to the active profile, such as a research level or
a planet's temperature, and is shared with every other calculator.

**Calculator field**:
A calculator input that never belongs to a profile, such as a fleet composition, a build
queue or a mode.

**Saved set**:
One of the named slots flight and production kept before profiles existed, which were
labelled "profile" in the UI. They are converted into manual profiles.
_Avoid_: profile, when the old slot is meant

## Game data

**Universe**:
One game server, identified by its community (country) code and its number, as in
`s1-en`. Its settings, such as speeds and the donut flags, belong to the universe, not to a
profile.
_Avoid_: server, when the settings are meant

**Account export**:
The JSON document that describes a whole account, produced from inside the game by the
origin-exporter userscript or by the collector. It is the source of a profile's game layer.
_Avoid_: dump, backup

**Collector**:
Our own code that runs on the game's pages, gathers the account export while the player
plays, and hands it to the site.
_Avoid_: exporter (that is origin-exporter), bot, crawler

**Sync**:
An import the site performs by itself when the collector has delivered an account export
newer than the profile's game layer.
_Avoid_: auto-import, refresh

**API 2 export**:
The one-line JSON the game shows on its Fleet page. It describes one planet's fleet and the
account's drive technologies, and is not a source for profiles.
