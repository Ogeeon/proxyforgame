# Checking game terms against the game itself

A locale string that names a game entity — a building, a ship, a research, a merchant, a
menu section — has to use the term the game shows in that language. A translation that
merely means the same thing is wrong: the player looks for the word they see in the game.
The game is the only authority here; wikis and forums lag behind renames and often carry
fan translations.

## The method: one account, every language

An OGame account is not tied to its server's language. **Options → Display → Language**
(`component=preferences`, the "Display" tab, select `#languageSelectionDropdown`) switches
the whole game UI of that account to any of 27 languages, on any server. So one account on
one server is enough to read every term in every language the site supports; no account on
the other countries' servers is needed.

Steps for one term:

1. Open the game page that shows the term (for the Scrap Merchant:
   `index.php?page=ingame&component=trader`, the four section headings are `<h2>`).
2. Note the language the account is on now, to put it back at the end.
3. For each language: Options → Display → Language → pick it → **Apply settings**, then reload
   the page from step 1 and read the term.
4. Put the original language back.

The site's locale files map onto the game's language codes like this:

| Locale file | Game language (`value` of the option) |
|-------------|----------------------------------------|
| `en.json` | `en` English |
| `us.json` | `us` English [US] |
| `de.json` | `de` Deutsch |
| `fr.json` | `fr` Français |
| `nl.json` | `nl` Nederlands |
| `it.json` | `it` Italiano |
| `pl.json` | `pl` Polski |
| `sk.json` | `sk` Slovensky |
| `bs.json` | `yu` Bosanski |
| `es.json` | `es` Español |
| `pt.json` | `pt` Português |
| `tr.json` | `tr` Türkçe |
| `ru.json` | `ru` Русский |

Note `bs` ↔ `yu`; `si` (Slovensko) is Slovenian, not Bosnian.

## Doing it from a browser session (Claude in Chrome)

Clicking through 13 languages by hand works, but the switch can be scripted from the game
tab itself. What held up, in a page script run through the browser tool:

- Load the preferences page into a hidden same-origin `<iframe>`, set
  `#languageSelectionDropdown` to the code, fire `change`, click the form's submit button and
  wait for the frame's `load`. Then `fetch()` the page with the term and parse its HTML.
- **A plain `fetch()` POST of the form's `FormData` does not change the language** — the
  form needs its real submit.
- **Read the language back** from the preferences page after every switch
  (`#languageSelectionDropdown.value`) and print it beside the term. Without that check a
  stale or overlapping run reads one language's text under another's label.
- **Keep each script call short — two or three languages.** The browser tool times a call out
  after about 45 s, and a timed-out script keeps running in the page: it goes on switching
  languages while the next call runs, and the two interleave. After a timeout, wait for it to
  finish (it ends on its last language) before starting again.
- The tool blocks script output that looks like cookies or query strings: return only the
  text you need, never raw HTML or form fields.
- Never click anything else on the page: the trader screens carry buttons that spend Dark
  Matter or sell the fleet.

## Conventions when copying a term

- Take the noun as the game writes it, then decline it as the sentence needs ("Kalkulator
  handlarza złomu", "Tasso del mercante").
- The game title-cases many headings ("Скупщик Лома", "Trgovac Otpadom", "Mercador de
  Sucata"). The site writes them in sentence case, like the rest of its labels.
- Update every string of the page that names the entity, not only the menu title: the page
  title, keywords, description, header and labels such as "the merchant's rate".

## Record of checks

| Date | Term | Result |
|------|------|--------|
| 2026-11-20 | Scrap Merchant (`scrap-title`, `scrap` page) | de, fr, nl, es, tr, en, us, ru matched. Fixed to the game's term: it *Mercante di ferraglia* (was *Rottamaio*), pl *Handlarz złomu* (*Handlarz złomem*), sk *Priekupník surovín* (*Obchodník so šrotom*), bs *Trgovac otpadom* (*Otkupljivač otpada*), pt *Mercador de sucata* (*Sucateiro*). |
