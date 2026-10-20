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

**Write-back**:
Writing an edit of a profile-owned field into the active profile, where it becomes an
override. Only what the player changed since the profile was applied is written back.
_Avoid_: sync, save

**Profile-owned field**:
A calculator input whose value belongs to the active profile, such as a research level or
a planet's temperature, and is shared with every other calculator.

**Field group**:
The profile-owned fields of one calculator that one entity fills: the account, the planet
or the moon shown, the body of a queue tab. A binder declares its groups, and the snapshot,
the write-back, the marks, the reset dialog's names and the restore buttons follow from them.
_Avoid_: field list, section

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

**Universe choice**:
A universe setting the player picked instead of the game's. It is kept in the universe
cache, not in a profile, so it is shared by every profile of that universe; it is marked,
counted and reset like an override, and the profile backup file carries it.
_Avoid_: override (that is a value of a profile)

**Account export**:
The JSON document that describes a whole account, produced from inside the game by the
origin-exporter userscript or by Companion. It is the source of a profile's game layer.
_Avoid_: dump, backup

**Companion**:
PfG Companion, our own code that runs on the game's pages, gathers the account export
while the player plays, and hands it to the site.
_Avoid_: collector (that is the game's player class), exporter (that is origin-exporter),
bot, crawler

**Sync**:
An import the site performs by itself when Companion has delivered an account export
newer than the profile's game layer. Nothing else is a sync: an edit reaching the profile
is a write-back.
_Avoid_: auto-import, refresh

**API 2 export**:
The one-line JSON the game shows on its Fleet page. It describes one planet's fleet and the
account's drive technologies, and is not a source for profiles.
