# Changelog

All notable changes to ProxyForGame are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The site is deployed continuously and carries no version numbers, so a release is
identified by its date and by the id of the changelog entry users see in the sidebar.

Bullets marked `<!-- site -->` are the ones published to that in-app changelog:
new calculators and pages, new fields and options, imported game data, changes to
the calculations, visual changes, and fixes to bugs users could hit. Everything
else - refactoring, tooling, tests, docs, wording and translation fixes - stays in
this file only. The exact published Russian text is quoted at the end of each
release section; it is the source of truth for the other eleven translations.

## [Unreleased]

### Fixed

- All calculators: a page whose scripts fail to load — a blocked or dropped request — now shows a "reload the page" banner instead of silently leaving a dead calculator that also reported one error per missing symbol to the error tracker. The versioned script and stylesheet URLs now carry a hash of the file's content instead of its modification time, so one URL can no longer serve two different file versions across a deploy; that mix is what had a stale cached page declare a moved constant twice and break every script after it.
- LF costs: the build or demolition time of a range of building levels is now the sum of its levels, each with the Megalith reduction and the universe speed applied to it alone and rounded down, as the game builds one level at a time. The range used to be reduced and divided by the speed as a whole and rounded once, which could come out a few seconds longer than the game - in any universe faster than 1, even without a Megalith. Every level of a building or research now also takes at least a second, as in the game, instead of only the whole range. A single level is unchanged. <!-- site -->
- LF costs: the multi-level table's totals no longer crash on a table that has lost its footer rows, and skip rendering instead.
- Trade: switching to a country that has no universe with the current number now selects that country's first universe. It used to fall back to universe 101, which no country has, leaving the universe list blank and the trade message without a universe name. <!-- site -->
- Flight: with an active profile, choosing a body in the departure select no longer snaps back to the previous one without touching the coordinates — the profile select keeps its own change handler, and picking a body writes the model before the DOM so the recalculation sees the fresh coordinates.

## [2026-10-25] - site entry 69

### Added

- Production: an "Amortisation of Life Form buildings and researches" table on the All planets tab ranks one more level of every Life Form building and research that raises resource production by its payback time - the question the plasma table answers, asked of the life forms. A building counts on its own planet, with the levels saved for it from the One planet tab and the Megalith discount for Rock'tal; a research counts on every planet. The gain is measured against the planets' current production, energy included. The Life Forms parameters tab gets the research levels, an "available" checkbox per research - a research slot holds one race's research, so the others in it are left out - the technology bonus that amplifies their gain and the research cost reduction. <!-- site -->
- MCP server: every calculator is available to LLM clients - ChatGPT, Claude and other Model Context Protocol clients - at `https://proxyforgame.com/mcp`, as twelve tools: flight, build cost, life form cost, build queue, production, expedition, moon destruction, moon creation, sensor phalanx, graviton, terraformer and trade. Most can read a live universe's settings. They compute with the calculators' own formulas.

### Fixed

- Profiles: an account export PfG Companion delivers while a calculator is open now shows in that calculator at once when it updates the active profile; until now the profile was updated in storage, but the page kept the old game values until it was reloaded.
- Profiles: a universe setting picked by hand instead of the game's — economy speed, debris shares, galaxy size and the like — now counts in the badge of values that differ from the game, and the badge's dialog lists it under "Universe" and restores it; until now only the profile's own values were counted, so the badge stayed hidden or undercounted while such a setting differed.
- Profiles: the production calculator's own settings — its display options such as the additional information and the one-planet view, and the economy speed of a profile with no universe — are now the same whether or not a profile is active, as in the other calculators; until now production kept a separate copy of them for profiles, so a change made with a profile active was not there under "no profile". That copy is taken over once, the first time a profile is shown.
- Costs: a range of levels under a life-form reduction - the research cost and time reductions, the Mineral Research Centre and the Terraformer reduction - is now the sum of its levels, each reduced and rounded down on its own, as the game charges one level at a time. The reduction used to be applied to the range's total and rounded once, which could come out a unit of resources or a second per level higher than the game, and a Terraformer range differed from the terraformer calculator (levels 4 to 7 by one second). A single level is unchanged.

> **RU:** В Калькуляторе производства на вкладке «Все планеты» появилась таблица «Окупаемость построек и исследований Форм Жизни». Она показывает, какие уровни построек и исследований Форм жизни, повышающих добычу, быстрее всего окупаются. Постройка учитывается на своей планете, для построек Рок’тал — со скидкой Мегалита. Исследование учитывается на всех планетах. Уровни исследований, доступность в слоте, технологический бонус и снижение стоимости исследований задаются на вкладке «Формы жизни» параметров.

## [2026-10-19] - site entry 68

### Added

- Production: player profiles. A selector in the top bar holds one profile per OGame account - several accounts in one universe included - and the production calculator reads its account data and planets from the active one and writes edits back to it. A profile is filled by importing the account data the Origin Exporter userscript - by the author of Antigame Reborn - copies out of the game (all planets and moons, researches, officers, classes and the life-form bonuses as the game totals them), or entered by hand. Each value keeps the imported game value and a hand-entered override apart: a field that differs from the game is marked and restores with one click, a list of every difference restores the ticked ones at once, and a re-import replaces the game values and clears only the overrides it brings a value for, so production percentages and exchange rates survive it. The economy speed comes from the profile's universe, and a speed picked by hand is kept until it is restored. The one-planet tab picks one of the profile's planets, "no profile" brings back the calculator's own settings unchanged, and the active profile is kept per browser tab. Profiles live in the browser only, so the manage dialog downloads and restores a backup file; the old production and flight saved sets are offered for conversion once and kept as they were. The design is ADR-0004. <!-- site -->
- Flight: player profiles. With a profile active, the drive researches, hyperspace technology, character and alliance class, the class boosters and the per-ship life-form bonuses come from it, and edits go back to it as overrides, marked and restorable as in production. The profile's universe is set in the universe picker and locked there. A new select next to the departure point lists the profile's planets and moons and copies the chosen one's coordinates, and "From the departure" fills the ship counts with the fleet stationed there at the last import. The flight's own fields - route, ships, times, universe settings - stay the calculator's. The old saved-set panel is gone; its sets are offered for conversion into profiles. A spy report imported while a profile is active no longer writes the spied player's research, class and bonuses into it: the import asks first whether to switch to "no profile" or to create a new profile for the report, on its universe and with the spied planet or moon. <!-- site -->
- Construction queue: player profiles. With a profile active, ion and hyperspace technology, the character class and the cargo bonuses of the small and large transporter come from it, and each tab shows one of the profile's planets or moons - picked in a select above its buildings - with that body's fields as the total and its building levels filled in as the start levels. Choosing a planet also shows its moon. Edits go back to the profile as overrides, marked and restorable as in production - except the start levels, which only save typing: changing one plans a queue and leaves the profile alone. The queues and their start times stay the calculator's, and a tab whose kind of body the profile does not have keeps the calculator's own values. The economy speed comes from the profile's universe, as in production. <!-- site -->
- LF costs: player profiles. With a profile active, ion and hyperspace technology, the character class, the cargo bonuses of the small and large transporter, the global life-form research cost and time reductions and the exchange rates come from it, and a select next to the title picks one of the profile's planets: its robotics and nanite factories, its life form and the life-form buildings that cut costs and times - the Megalith, the Mineral Research Centre and each race's research building - feed the calculation. Edits go back to the profile as overrides, marked and restorable as in production; the build tables and the available resources stay the calculator's, and a planet with no life form keeps the race chosen in the calculator. The planet's life-form building and research levels are filled in as the "from" levels of the multiple-levels tab - a research added there too - and on the one-item tab for whatever is picked there. A row whose "to" was left alone follows the new "from" - the same level, or the next one on the one-item tab - and is recalculated; a row whose "to" was changed by hand keeps both its levels when another planet is picked. They only save typing, so changing them leaves the profile alone. The economy speed comes from the profile's universe, as in production. <!-- site -->
- Graviton: player profiles. With a profile active, energy and hyperspace technology, the officers, the character and alliance class, the life-form energy bonus and the cargo bonuses of the small and large transporter and the recycler come from it, and a select next to the title picks one of the profile's planets: its shipyard and nanite factory, its maximum temperature, its solar and fusion plants, its solar satellites, its energy booster and its Disruption Chamber feed the calculation, along with the production percentages set for it in production. Edits go back to the profile as overrides, marked and restorable as in production; the graviton level and the available resources stay the calculator's. The economy speed, the share of a fleet that goes to the debris field and whether deuterium goes there too come from the profile's universe, a share no preset offers included; a value changed by hand is marked, kept for every profile of that universe and restorable, as the economy speed in production. <!-- site -->
- Terraformer: player profiles. With a profile active, energy and hyperspace technology, the officers, the character and alliance class, the life-form energy bonus and the cargo bonuses of the small and large transporter come from it, and a select next to the title picks one of the profile's planets: its robotics, shipyard and nanite factories, its maximum temperature, its solar and fusion plants, its solar satellites, its energy booster and its Disruption Chamber feed the calculation, along with the production percentages set for it in production. The terraformer's current level on that planet is filled in as the level the range starts from, and the level it goes to is raised one above it when it is not higher; both stay the calculator's, so changing them does not touch the profile. Edits to the other fields go back to the profile as overrides, marked and restorable as in production; the single-level switch and the available resources stay the calculator's too. The economy speed comes from the profile's universe; a value changed by hand is marked, kept for every profile of that universe and restorable, as the economy speed in production. <!-- site -->
- Trade: player profiles. With a profile active, hyperspace technology, the character class and the cargo bonuses of the small and large transporter come from it, and edits go back to it as overrides, marked and restorable as in production. The exchange rates are shared with production and carry no marks: changing them in one calculator shows in the other. The profile's universe is set in the universe picker and locked. A new select next to the title copies the coordinates of one of the profile's planets or moons into the location; the resources, the deal type and the coordinates stay the calculator's. A deal link opens with its own rates, universe and coordinates shown over the profile and writes nothing into it. <!-- site -->
- Expeditions: player profiles. With a profile active, the character class, hyperspace technology, the life-form bonuses of expeditions to resources and to ships, the collector and discoverer class boosters and the cargo bonus of every ship in the table come from it, and edits go back to it as overrides, marked and restorable as in production; the cargo bonuses read with the reader button become overrides the same way. The economy speed and the strongest player come from the profile's universe; a value changed by hand is marked, kept for every profile of that universe and restorable, as the economy speed in production. The fleet, the dark matter discovery bonus and the resource discovery booster stay the calculator's. A link with parameters opens with its own values shown over the profile and writes nothing into it. <!-- site -->
- Moon: player profiles. With a profile active, hyperspace technology, the character class (the general and the discoverer boxes), the life-form bonuses to the recycler's cargo, to the phalanx range and of the discoverer class come from it; a select in the title of the creation block picks one of the profile's planets, whose Supra Refractor feeds the calculation, and a select in the title of the sensor phalanx block picks one of its moons, whose sensor phalanx does. Choosing a planet also picks its moon. The moon's system is put into "your system" to save typing, and stays the calculator's, so changing it does not touch the profile. Edits to the other fields go back to the profile as overrides, marked and restorable as in production; the two resets of the creation and phalanx blocks are hidden while a profile is active, and a character class the boxes cannot show, a collector, is not taken for an edit. The shares of a fleet and of defenses that go to the debris field, whether deuterium goes there too, the number of systems and whether they form a ring come from the profile's universe; a value changed by hand is marked, kept for every profile of that universe and restorable, as the economy speed in production. The size of the moon and the Deathstars of the destruction block, the target system and the unit counts stay the calculator's. <!-- site -->
- Terraformer: a field for the life-form Terraformer cost reduction, as in the cost calculator. It lowers the crystal, the deuterium and the build time of every terraformer level, by up to 50%, and with a profile active it comes from the profile. <!-- site -->
- Player profiles: the backup file also keeps the universe settings picked by hand - the economy speed, and in graviton the debris share and whether deuterium goes to the debris field - for the universes of the profiles in it, and restoring a profile brings its universe's choices back. They are kept per universe rather than per profile, so a backup used to leave them behind. <!-- site -->
- Costs: player profiles. With a profile active, the researches (energy, plasma, ion, hyperspace, the research network), the officers, the character and alliance class, the life-form class boosters, the cargo bonuses, the Terraformer reduction and the research bonuses table come from it; a planet and a moon picked in two new selects next to the title supply the factories, the shipyard, the research lab, the temperature, the position and the Mineral Research Centre. Choosing a planet also picks its moon. The research network dialog lists the profile's planets by name with their research labs, and a lab edited there goes back to its planet; the start planet defaults to the best lab (the oldest planet on a tie), and the network is switched on by default when the account has researched it - both choices are remembered per profile. Edits go back to the profile as overrides, marked and restorable as in production. The levels the profile knows - the planet's and the moon's buildings and the researches - are filled in as the "from" levels of the multiple-levels tab, and on the one-item tab for whatever is picked there. A row whose "to" was left alone follows the new "from" - the same level, or the next one on the one-item tab - and is recalculated; a row whose "to" was changed by hand keeps both its levels when another planet or moon is picked. They only save typing, so changing them leaves the profile alone. The profile's universe is set in the universe picker and locked there, with its speeds. The build tables, the speeds and the booster stay the calculator's, and "no profile" brings back its own settings and research bonuses table unchanged. <!-- site -->
- The misspelling report and e-mail forms are protected against spam: a hidden honeypot field and a minimum time the dialog must stay open silently drop automated submissions, and one address can send at most 5 messages per 10 minutes and 20 per day. The privacy policy now says that a hash of the sender's IP is kept for up to 24 hours for this.

### Changed

- Moon: the share of destroyed defenses that goes to the debris field is set in a select of its own, next to the fleet's, instead of a checkbox that gave the defenses the fleet's share. It starts at 0%, as in most universes; settings saved with the checkbox switched on take the fleet's share, so their results stay the same. The Supra Refractor and the recycler cargo bonus move to a new "Life forms" tab of the creation parameters. <!-- site -->
- Graviton: the officers' energy bonus is set with a checkbox per officer, as in production, instead of a choice between none, the engineer and all officers; the engineer gives +10% and all five together +12%, as before. Settings saved with the old choice are read into the checkboxes. The solar and fusion plants and the solar satellites can also be set to 0%. <!-- site -->
- Terraformer: the officers' energy bonus is set with a checkbox per officer, as in production, instead of a choice between none, the engineer and all officers; the engineer gives +10% and all five together +12%, as before. Settings saved with the old choice are read into the checkboxes. The solar and fusion plants and the solar satellites can also be set to 0%. <!-- site -->
- Costs: the research lab field is always one planet's lab now, and the research network has a checkbox of its own next to it, kept with the other settings. Switched on, it shows the level the network reaches, followed by the button of the dialog where the network is set up; switched off, research uses the lab field alone - a lab of 0 included, which used to be quietly made up from the dialog's table. With the network on, only the table counts: when none of its labs meets a research's requirement, that research cannot run, rather than falling back to the lab field, and with no start planet ticked the network starts on the best lab, in the dialog and on the page alike. Confirming the dialog no longer writes the network's combined level into the lab field, where after a reload it passed for a single lab. <!-- site -->

### Fixed

- Expeditions: a link naming a universe picks the "strongest player" entry the universe's top score falls into. The limits read from 1.000.000 on were ten times the ones the entries show, so a top score of 5.000.000 picked "< 1.000.000" and anything up to 1.000.000.000 stayed below "> 100.000.000". <!-- site -->
- Costs: the note on building the Robotics or Nanite Factory no longer opens for a row of the multiple-levels tab whose "from" and "to" levels are the same, since such a row builds nothing. <!-- site -->
- Construction queue: the finish time readout is named by its label, so a screen reader announces what it shows.
- LF costs: every input of the page has a name a screen reader announces - the crystal and deuterium exchange rates, the level fields of the build tables, the available resources and the technology selects - and the note at the bottom is no longer laid out as a table.
- Moon: the captions of the results, expenses, recycling and phalanx readouts and the per-unit "units for the maximum chance" counts are no longer form labels with nothing to label, and the fleet and defense grids are marked as layout rather than data tables.
- Graviton: the percentage selects of the solar plant, the fusion plant and the solar satellites and the available deuterium field have a name a screen reader announces, the captions and energy readouts are no longer form labels with nothing to label, and the plant, result, expense and recycling grids are marked as layout rather than data tables.
- Construction queue: the confirmations and warnings of the profile dialogs are headed in the page language instead of the English "Attention" - the profile dialogs now bring their heading with them rather than relying on the page to set it.
- Flight: a two-digit planet position no longer loses its edges in the coordinate fields, and the three-digit system no longer loses a pixel - the fields keep their width but take a narrower inner padding. <!-- site -->
- Flight: importing an alliance class from the API 2 export or a spy report now reads the game's ids as 1 warrior, 2 trader, 3 researcher. The importer had the warrior and the researcher swapped, so a warrior alliance arrived as none and a researcher alliance as warriors - quoting holding missions 10% fast. <!-- site -->
- LF costs: demolishing a Rock'tal building now gets the Megalith and Mineral Research Centre discount, as in the game; it used to cost the full price. The energy a life-form building needs no longer drops with the ion technology, which in the game only discounts a demolition. A building or research under a cost reduction could also come out one unit cheaper than in the game, because the base cost was rounded down before the discount was applied; the reduced cost is now rounded once, as the game does. <!-- site -->
- Costs: the build-time warning shown when a Robotics or Nanite factory is planned now points at the hint icon in the first cell of those two rows, and shows the icon itself; it used to refer to "the note in the first row of the table", which no row carries.
- Tooling: `scripts/new-calculator.js` no longer fails to sync the new calculator's translations when run from outside the repository root; it starts its helper scripts with the running node binary instead of looking `node` up on `PATH` through a shell.
- Flight: deleting a saved profile whose name contains a quote no longer fails; the entry is removed like any other. A name carrying a quote - an export pasted into the name field, say - broke the option lookup, which passed the stored key into a CSS selector.
- Sidebar: the wiring that runs on `DOMContentLoaded` returns when the Bootstrap bundle is missing, instead of throwing a `ReferenceError` out of the handler. The bundle is served from our own origin, so this only covers a request that failed; nothing in the handler works without the bundle anyway, so the step only keeps the failure off Hawk. The click handler above it already carried the same guard.

> **RU:** Во всех калькуляторах появились профили игрока. Профиль хранит данные аккаунта OGame — планеты и луны, исследования, офицеров, классы, бонусы форм жизни — и заполняется импортом из скрипта Origin Exporter или вручную. Калькуляторы берут из него нужные значения и уровни выбранной планеты; изменённое поле помечается и одним щелчком возвращается к игровому значению. Профили хранятся в браузере, их можно сохранить в файл и восстановить.<br>Терраформер: добавлено снижение стоимости от Терраформера форм жизни. Луны: доля обороны в обломках задаётся отдельно. Гравитон и Терраформер: бонус офицеров — флажок на каждого. Стоимость: у сети исследований свой флажок.

## [2026-10-13] - site entry 67

### Fixed

- Costs and LF costs: the points a build or research awards no longer drop with life-form cost reductions (the Megalith, the Mineral Research Centre and the research cost reductions). The game counts points from the full cost, so the points total now ignores the discount, as the points refunded on a demolition already did. <!-- site -->

> **RU:** Калькулятор стоимости и калькулятор стоимости для Форм жизни: очки за постройки и исследования больше не уменьшаются от скидок на стоимость (Мегалит, Центр исследования минералов, снижение стоимости исследований). Игра начисляет очки по полной стоимости, и теперь калькуляторы считают так же.

## [2026-10-11] - site entry 66

### Changed

- Flight: the parameters are regrouped so each tab holds one kind of setting. The universe's deuterium consumption factor and the General's fuel discount moved from "General" to "Universe", next to the other values the server data fills in; the first is now labelled "Universe deuterium consumption" so it no longer reads like a life-form bonus. The manual fleet-speed override moved from "Universe" to the Ships section, above the ship grid whose speeds it replaces. The two mutually exclusive alliance-class checkboxes - "Traders" under the parameters and "Warriors" above the results table - are one radio group on "General": none, Traders or Warriors. The saved-settings selector above the tabs, in flight and in production, is now labelled "Profile" instead of a third "Universe", and its prompts and confirmations speak of a profile. <!-- site -->

- Site: Bootstrap 5.3.8 and Bootstrap Icons 1.11.0 are served from the site itself (`www/vendor/`) instead of cdn.jsdelivr.net. PageSpeed Insights put the render-blocking CSS at 1.2 s of a mobile first visit, half of it the two jsdelivr stylesheets, which each first visit had to open a second origin for - DNS and TLS included; on our own HTTP/2 connection they ride along with the page. The files are committed copies of the versions `package.json` now pins, made by `make vendor` (`scripts/vendor-assets.js`), and `make check` fails when the two disagree; Dependabot proposes new versions monthly. Every page head takes them from one include, `www/vendor_bs.tpl`, instead of four tags repeated in eleven templates, and the e2e fixture that cached the CDN files is gone.

### Fixed

- Sidebar: a first visit no longer opens the changelog. Without a saved "last seen" release the code assumed entry 42, so every new visitor - and every PageSpeed Insights run, where the dialog came out as the largest paint at 4.8 s on mobile - was greeted with two dozen past releases. Now a first visit only records the current release, and the dialog keeps showing returning visitors what they missed.

- Site: pages render sooner and repeat visits no longer re-request every stylesheet and script. The Apache host that took over both domains on 2026-10-10 sent no `Cache-Control` or `Expires` for static files - the old nginx account had sent a day - so every page view revalidated some 27 files over HTTP/1.1. `www/.htaccess` now has stamped CSS and JS (every one carries `?v=<mtime>`) kept for a year as `immutable` and images for a month, in an `IfModule` block that is a no-op where `mod_expires`/`mod_headers` are not loaded. The page scripts load with `defer`, and the inline blocks that read their globals are `type="module"`, which runs them after those scripts in the same order as before, so a parser-blocking script no longer holds up the first paint - on a throttled mobile profile that delay was 1.1 s of a 1.3 s LCP. The icon font is preloaded instead of being discovered only once its stylesheet has loaded. The new-calculator generator emits the same head. Because the first paint now comes before the scripts initialize the form, a page a little taller than the window could lose its scrollbar when initialization collapsed a section and jump sideways (CLS 0.14 on flight with classic Windows scrollbars); `html { scrollbar-gutter: stable }` in `common_bs.css` keeps the scrollbar width reserved, bringing it back to 0.02.

> **RU:** В Калькуляторе полётов перегруппированы параметры. На вкладку «Вселенная» переехали расход дейтерия во вселенной и бонус Генерала к потреблению дейтерия — это настройки сервера, они заполняются вместе со скоростями флота. Поле «Задать скорость флота» теперь в разделе «Корабли», над списком кораблей. Классы альянса «Скупщики» и «Воины» объединены в одну группу «Класс альянса» на вкладке «Общие».<br>В калькуляторах полётов и производства селектор сохранённых настроек называется «Профиль».

## [2026-10-10] - site entry 65

### Added

- Monitoring: browser errors on every page are reported to Hawk (hawk.so), so a script failure a visitor hits no longer goes unseen. The tracker loads only where the host's `.env` sets `HAWK_TOKEN` - production and the standby - and reports only errors our own scripts are involved in, tagged with the deployed commit, the host and the page language. The tracker script loads `async`, so the CDN never holds up rendering; errors thrown before it arrives are buffered and handed over once it is up. Each page load gets a throwaway user id, so Hawk stores nothing in the visitor's browser and needs no cookie consent. The privacy policy describes what a report contains.

- Site: short calculator addresses. Every calculator now lives at `/<lang>/<calc>` - `https://proxyforgame.com/ru/costs` instead of `https://proxyforgame.com/ru/ogame/calc/costs.php` - and the sidebar, the language menu and the in-page links use them. The old `.php` addresses keep working forever: they answer with a permanent redirect to the new one, keeping the language prefix and the query string, so bookmarks, forum links and the spy-report `SR_KEY` links all still land on the right page. An address without a language prefix (`/costs`) is sent to the visitor's own language, and a trailing slash is dropped. The built-in PHP server behind `make serve`, Docker and CI now runs `scripts/dev-router.php`, which does what `www/.htaccess` does on Apache, so the `/<lang>/` addresses work locally too. <!-- site -->

### Changed

- Site: the cookie notice and the Yandex Metrica counter now run on `proxyforgame.net` as well as on `proxyforgame.com`; before, the standby showed visitors no cookie notice at all and was missing from the statistics. Both hosts are listed in one place, `www/hosts.inc.php`, and local development, CI and the e2e suite still run without either. The notice now says what the cookies are for - the values entered in the calculators, and Yandex Metrica's visit statistics - instead of a vague "personalize content", and the privacy policy describes Yandex Metrica in place of Google Analytics, which the site no longer runs, and names `https://proxyforgame.net` as the Service.

### Fixed

- Site: the costs, flight and trade pages answer about half a second sooner on production. Each page view read the country and universe lists from the database with one query per country - some 28 round trips to a database that sits on another machine on production - and costs joined flight and trade in doing so when its universe picker went live on 2026-10-04, which Yandex Metrica shows as its time to first paint doubling that day. The lists are now read in two queries for every language at once and kept in a file cache in the system temp directory for an hour, so a page view normally does not query them at all; `trade.php` uses the same loader as the other two instead of its own copy of the query.

- Site: CSS and JS updates now reach visitors of `proxyforgame.net` as soon as they are deployed. Every page stamps its stylesheets and scripts with the file's modification time so the browser fetches a fresh copy after a change, but the templates found the files through a hardcoded Windows path on any host other than `proxyforgame.com` - so on the standby, under `make serve` and in Docker every stamp came out empty or `0`, and a browser could keep running a stale script against a newer page. The path is now taken from where the template itself sits - in the page templates, the sidebar and the new-calculator generator.

- Deploy: `pfg-sync` no longer rolls a host back when GitHub's runs API misreports the tip. Now and then the API answers "no successful run" for a commit that has one, and since 2026-09-28 every such answer reset the host to the previous commit until the next run put it back - production several times a day for an hour, the standby for five minutes at a time. Green mode now stops its walk at the commit already deployed and takes it without asking, so it only ever rolls forward (going back is the rollback pin's job) and an idle reconcile makes no API call at all. The watchdog asks twice before it counts a commit as not green, after the same false answer failed its run on 2026-10-05.

> **RU:** Калькуляторы получили короткие адреса: например, proxyforgame.com/ru/costs вместо proxyforgame.com/ru/ogame/calc/costs.php. Старые ссылки и закладки продолжают работать и сами ведут на новые адреса.

## [2026-10-04] - site entry 64

### Added

- Build: a Docker Compose stack for local development. `docker compose up -d` (or `make docker-up`) serves the site on `http://localhost:8000` with a MariaDB seeded from `schema.sql` and the changelog fixture and migrated by `deploy/pfg-migrate` - the same files the deploy uses. The PHP container runs the built-in server, exactly as `make serve` and CI do. WAMP stays supported and unchanged; the production hosts and CI keep their own setup. See `docs/adr/0002-docker-local-dev.md`.

- Costs: a country and universe picker on the Common tab, which fills in both speeds. A universe's research speed is its economy speed multiplied by the research divisor - Buzz DE runs at 5 x 3 = 15, not 10 - and nothing on the page said so, so a player there was quoted research times half again too long while his building times were right. Both speed fields stay editable; the picker only spares the player working the number out, and a hint beside the research speed now spells the rule out. While a universe's settings are being fetched, the settings panel is covered with a "Fetching data..." overlay, as on the flight calculator, so a speed cannot be changed only to be overwritten by the answer. The settings come from the same service the flight calculator already uses, and the universe lists the two pages build are now one include. <!-- site -->

### Fixed

- Build: a real environment variable now overrides a value of the same name in `.env` (`www/db.connect.inc.php`), which is the 12-factor order, so `docker compose` can point the app at its `db` service without the bind-mounted `.env` winning. Inert on the hosts and in CI, where nothing sets a conflicting variable. `make serve` also honours a customised `.env` again, because the Makefile no longer exports the `DB_*` defaults globally - only `db-seed` and `db-migrate` do.

- Flight: the deuterium column now matches the game for a general with life forms. Two things were wrong. The Mechan General Enhancement deepened the general's discount by a fifth of the percentage entered - speed and cargo were moved onto the full scale when the enhancement was added, the fuel column kept the old one. And the class discount and the ship's own life form discount were multiplied together, where the game adds the two percentages and stops the sum at 90%. A player with a 62,88% enhancement was quoted 6.530 deuterium against the game's 1.708 on a recycler run; that run now reads 1.708. Pinned against three flights he measured in-game and the published server settings of his universe, which supply the two dropdowns the page cannot know on its own.

- Flight: the deuterium column now matches the game to the unit on every flight the reporter measured, not just the first. Two roundings were off. A ship whose fuel falls below one unit after the universe factor and the discounts was flying free, where the game charges it a whole deuterium - the espionage probe and the death star both sit on a base consumption of 1, and a fleet carries them in tens of thousands. And the ship types were summed as fractions and rounded once at the end, where the game settles each type on a whole number of its own first and never below one, so a single ship beside a million is a unit rather than a rounding error. His whole fleet now reads 690.814 against the game's 690.814, and his two-ship experiment 1.141 against 1.141.

- Flight: importing an account whose alliance runs the warrior class now ticks that bonus. Both importers - the API 2 export and the spy report - only ever looked for the trader, so a warrior alliance arrived as no alliance at all and the fleet was quoted 10% slow. The two boxes also follow the import now rather than being left as they were found.
- Flight: a spy report import no longer blanks the general's deuterium discount. The value was scaled by ten instead of a hundred, and 2,5 matches none of the options the select carries, so the field came out of the import showing nothing.
- Flight: the warrior alliance bonus now survives a page reload. The checkbox was read on every recalculation but never written to the stored settings, so it came back cleared and the fleet was quoted 10% slower than the one that had been set up; the trader box beside it has always been kept.
- Flight: an import no longer empties a dropdown it cannot fill. The universe settings were assigned straight to the select, and a select holds only the values the page put into it, so a figure with no matching option - a spy report that gives the deuterium consumption factor as 0, say - left the field blank instead of the choice that was already there. The import now picks an option only when the list carries it.
- Flight: the cargo hold of a big fleet is no longer overstated. The fraction left over after the hyperspace technology, class and life form bonuses was dropped once from the fleet total, where the game drops it from each ship's hold before multiplying by the count - so the error grew with the fleet: 66.664 recyclers were credited with 53.330 units of cargo the game does not give them. All three fleets a player sent in now match the game to the unit.
- Trade: the exchange rates now survive a page reload. The settings store in `www/js/utils.js` serialized to a `key;value,` string that never escaped the comma, so the nested `rates` object was split on the commas inside its own JSON, `JSON.parse` threw on load (a `SyntaxError` in the console on every visit), and the rates silently fell back to their defaults. `saveToCookie` now writes a JSON document and `loadFromCookie` reads either format - the pre-JSON payload still in a returning visitor's storage keeps working. Phase 1 of `.claude/plans/settings-serialization.md`; no calculator changed.
- Costs: the reset button now also clears the table of life form research bonuses. The table is kept in the browser apart from the other settings, and the reset never touched it, so the bonuses stayed in place and kept discounting research costs and times - and survived a reload even after being cleared by hand from the fields.
- Build: `scripts/read-mail.js` now validates the host, address and port before opening the IMAP socket - the connection target must be a dotted-quad IPv4, the certificate name a plausible host name, the port in range. Closes an SSRF path SonarCloud flagged from `IMAP_ADDR` / `IMAP_HOST` / `IMAP_PORT` and the DoH response into `tls.connect()`.
- Deploy: `pfg-sync` retries `git fetch` before giving up. GitHub intermittently answered an unauthenticated fetch with a 401 for about an hour on 2026-08-31, and both hosts mailed a deploy-failure alarm for a blip that fixed itself by the next run. The fetch now gets three attempts with a short backoff, and `GIT_TERMINAL_PROMPT=0` turns the credential prompt a 401 provokes into an immediate error rather than a hang.
- Deploy: `pfg-sync` (and `cutover-prod.sh`) force the `git fetch` onto HTTP/1.1. From 2026-09-02 the HTTP/2 `POST .../git-upload-pack` to GitHub started hanging from production - the GET that advertises the refs still succeeds over h2, the POST that negotiates the pack resets, and git falls through to a credential prompt and reports `could not read Username for 'https://github.com'`. So the hourly reconcile mailed a deploy-failure alarm every run even though the site was already on `main`'s tip. It is old libcurl (git 2.30.2, no root to upgrade) against GitHub's current edge; `curl` and the standby's newer git are both unaffected. Pinning HTTP/1.1 sidesteps the broken h2 upload.
- Deploy: `pfg-sync` no longer mails a cascade of alarms when one connection to GitHub stalls. On 2026-10-03 a standby run hung on a network call for over ten minutes - neither `git fetch` nor the API `curl` had a deadline - so the next two five-minute runs gave up waiting for the lock and each mailed "another pfg-sync held the lock", and a third mailed "GitHub API unreachable" for a single unanswered request. The site was never affected. Every network call is now bounded (`timeout 60` on the fetch, `--max-time 20` on the API), API requests get the same three attempts as the fetch, and a timer run that finds the lock taken steps aside quietly - whoever holds it is doing the same job, and a host that stays stuck still shows up as drift in the watchdog. A `--sha` or `--check` run still waits and fails loudly.

- Costs: the life form research bonuses now import from a German game client. The paste parser accepted only a dot as the decimal separator, but the separator follows the game's language, not the site's, and the German client writes "52,38%" - so every fractional value arrived cut off at the comma, and a 0,2% bonus came in as 0. Both separators are read now; neither can be a thousands separator here, because every value on that panel is a percentage below 1000.

- Costs, Production: the character class bonus is now entered as the game shows it. Both calculators multiplied the figure by the life form experience level - 57,35% became 63,09% at level 100 - on the premise that the game's class panel printed the raw research total. It does not: "Discoverer, Total: 57.35%" is the amplified figure, and every bonus listed under it is the base bonus times 1,5735, the level included. The reduction was therefore counted twice, and a research came out several percent too fast. Checked against a measured research rather than reasoning: Laser Technology 13 in a German player's account in Undae, 17 labs totalling level 340, research speed 20, -52,382% from the life form researches, technocrat and Discoverer - the game says 2m 20s, the calculator now says 2m 20s, and the old reading said 2m 17s. The "Lifeform level" field existed only to carry that amplification and is gone from both pages; the hint beside the class bonus now says which value from the game belongs there. The flight calculator was always right and is unchanged. <!-- site -->

- Site: the German and Bosnian versions take a comma as the decimal separator, the way both languages write numbers. Both were configured with a dot, so a German player could not type a fractional value into any field on any of the ten calculators - a comma was swallowed and 57,35 became 5735 - and every number the site printed back carried the wrong separator. The other nine comma languages were always right, so this only puts the two of them on the path the rest already use. Stored settings are unaffected: they have always been written with a dot, independently of the language.

- Costs: astrophysics now costs what the game asks for. Its price was rounded to the nearest hundred, a rule from an old version of the game, while the game floors it to the unit like every other research - level 5 on en-1 costs 37.515 metal, 75.031 crystal and 37.515 deuterium, where the calculator said 37.500, 75.000 and 37.500. The error grows with the level and adds up over a range. The special case is gone, and astrophysics goes through the same formula as the rest, with the 1,75 growth factor it already carried.

- Flight: the warrior alliance bonus now speeds the fleet up only on a holding mission, as in the game. With the box ticked, every mission - attack, transport, moon destruction's speed column included - was quoted 10% faster than it flies; the box can stay ticked now and only the holding mission picks it up.
> **RU:** Калькулятор стоимости: на вкладке «Общие» теперь можно выбрать страну и вселенную — скорость экономики и скорость исследований подставятся автоматически.<br>Калькуляторы стоимости и производства: бонус класса теперь вводится как значение «Всего» из таблицы OGame, поле уровня формы жизни убрано — раньше бонус учитывался дважды.

## [2026-09-01] - site entry 63

### Added

- Trade: a fifth way of splitting a mixed purchase - a percentage of the resource being *sold*, rather than of what comes back. Selling 1.000.000 deuterium at 50% now buys what 500.000 deuterium of metal and 500.000 of crystal are worth, which is how the split is usually thought about; the existing percentage and proportion modes divide the resources received. Shares in the link as `msrc`. <!-- site -->
- Build: `make mail` reads the mailbox the contact forms deliver to, so feedback can be gone through without opening Gmail. Read-only over IMAP - the mailbox is only ever examined, never modified - with filters for the messages the forms send, a date, a Gmail search, or one message by id. Credentials are an app password in `.env`.
- Deploy: versioned database migrations. SQL files in `db/migrations/` are applied to both hosts by `pfg-sync` before the smoke test and tracked in a `schema_migrations` table; a failed migration rolls the deploy back. Replaces applying every schema change by hand over SSH.
- Deploy: the watchdog now catches `webhook.php` drifting on production. The GitHub receiver lives outside the checkout, so a deploy never updates the running copy and a change to it had to be reinstalled by hand with nothing warning when that was forgotten. `ajax.php?service=health` publishes the sha256 of the installed receiver - the digest only - and the watchdog compares it against `deploy/webhook.php` at the commit that host reports as deployed, so a rollback does not read as drift.

### Fixed

- Moon, expeditions, graviton, queue and terraformer: the label on a blue sub-panel was wrapped in `<b>` and rendered heavier than the grey section header above it. The wrapper is gone and both now render at the same weight, matching the cost calculators.
- Deploy: a dispatched rollback no longer undid itself. Both hosts also reconcile against `main` on a timer, and that walk climbed straight back to the newest green commit - within five minutes on the standby, and on production at the next hourly run, so the rollback lever held for at most 59 minutes there. A rollback now pins both hosts to the commit it names, and the pin lapses by itself once `main` moves, so landing the fix is all it takes to resume rolling forward.

> **RU:** Калькулятор торговли: покупку теперь можно разделить по проценту от продаваемого ресурса, а не от получаемого. При продаже 1 000 000 дейтерия с долей 50 % металл и кристалл считаются как половины по 500 000 дейтерия.

## [2026-08-30] - site entry 62

### Changed

- Sidebar: the full changelog dialog now shows ten entries per page with a previous/next pager instead of one long scroll. The pager is hidden when everything fits on one page, so the "something changed since your last visit" popup is unaffected.

### Fixed

- Flight: the "Destruction" mission showed the single 100% row of the flight-times table. The fixed speed of 310 that OGame 12.9.0 gave the mission is its speed at 100%, and the fleet can still be sent at a lower percentage, so the table holds all of its speed steps again and the deuterium follows the throttled trip. 
- Production: the crawler production bonus grew without limit; in the game it is capped at 50% of a mine's base production, regardless of crawler count or the 150% overload. The calculator now applies that ceiling, so it no longer over-states production for a Collector running crawlers at 150% with high mines. <!-- site -->

> **RU:** Калькулятор производства: бонус Гусеничников к добыче теперь ограничен 50 % производства шахты, как в игре.

## [2026-08-16] - site entry 61

### Added

- Flight: the flight-times table now says why it has nothing to show instead of standing empty - either that no ships have been entered, or that the coordinates are out of range. The message links to the field to fill in, opening the section it is on when that section is collapsed.
- Flight: a "Moon destruction" mission type (labelled "Destruction" on the page), flying at the fixed speed of 310 that OGame 12.9.0 introduced for that mission - a Death Star with hyperspace drive 7 in a 1x universe. Drive levels, the player class, the alliance and life form bonuses and the universe fleet speed no longer change the flight time, the deuterium is charged at that same speed, and the speed percentage cannot be picked, so the table holds the single 100% row and the manual speed override is greyed out. <!-- site -->

### Fixed

- Expeditions, Flight: pasting text into the API 2 field that is not an export from the game, but happens to be JSON carrying a "ships" or "researches" block, counted as a successful import. In the expeditions calculator it cleared the whole cargo-bonus table and kept a bonus report pasted alongside it from being read; in the flight calculator it cleared every ship count and bonus field. Both now recognize an export by the ships and researches they have a field for, and report anything else as unreadable without touching what is on the page.

> **RU:** Калькулятор полётов: добавлен тип миссии «Уничтожение луны» (на странице — «Уничтожение»). С версии OGame 12.9.0 флот в такой миссии летит с фиксированной скоростью 310 — уровень привода, класс игрока и скорость вселенной на время полёта больше не влияют.

## [2026-08-10] - site entry 60

### Added

- Costs: the Common tab now has an "Alliance class is 'Traders'" checkbox, so the +5% alliance mine output bonus is included in the hourly production shown on the "One item, multiple levels" tab, matching the production calculator. <!-- site -->

### Fixed

- LF costs: the Humans research "Supercomputer" used a cost growth coefficient of 1.3, while the game grows it by 1.2; every level above the first was overcharged (level 10 alone by more than 25M metal).
- Costs: a research the Research Lab level is too low for is reported as impossible, but the Discoverer class still saw the 750 Dark Matter minimum in the DM column of such a row; the column now stays at 0 when there is nothing to speed up.
- English locale: four spelling mistakes in the English text, in the ship-bonus reader error ("Couln't"), in the misspelling-report and e-mail dialogs ("Lets correct it") and in the production table header ("Enchanced").

> **RU:** В калькуляторе стоимости на вкладке «Общие» появился флажок «Класс альянса — "Скупщики"». Бонус +5% к добыче шахт теперь учитывается в почасовой добыче на вкладке «Один элемент - неск. уровней» — так же, как в калькуляторе добычи.

## [2026-08-07] - site entry 59

### Added

- Costs: the Life Forms tab now has a field for the Rock'tal Collector Enhancement and a life form level beside it, so the Collector class bonus is no longer stuck at its base 25%. It feeds both the Small and Large Cargo capacity behind the "Transports needed" row and the hourly production on the "One item, multiple levels" tab. The Discoverer class bonus got its own Kaelesh life form level in the same way. <!-- site -->

### Changed

- Flight: alerts and confirmations (spy report import, own API import, universe and fleet save/load/delete) now show as an in-page dialog instead of the browser's native alert/confirm popup.
- Production: alerts and confirmations (planet add/remove, universe save/load/delete, cloning planet data) now show as an in-page dialog instead of the browser's native alert/confirm popup.
- Costs: the Life Form research bonuses import error now shows as an in-page dialog instead of the browser's native alert popup.
- Expeditions: the cargo-bonus import error now shows as an in-page dialog instead of the browser's native alert popup.
- LF costs: a corrupted settings cookie now reports the error as an in-page dialog instead of the browser's native alert popup.
- Trade: startup and settings-load exceptions now report as an in-page dialog instead of the browser's native alert popup.
- Costs: asking for a research the entered Research Lab level is too low for now raises that level to what the research requires and says so in a notification, instead of only reporting that the research is impossible. A lab level computed from the Intergalactic Research Network is left untouched and still reports the requirement. <!-- site -->
- Costs: the Discoverer class bonus is no longer capped at 100%, matching the production calculator, and its tooltip now names the research it comes from.



### Fixed

- Production: the "Crawlers boost" tooltip named the lifeform research in English regardless of locale; it now uses the translated tech name.
- Flight: clicking the spy report import button with an empty code field sent a request to the server anyway; it now shows a notification asking for a code instead.
- Costs, Flight, Expeditions: modal dialogs (Life Form research bonuses, own API import) now consistently place the Cancel button on the left, matching every other dialog on the site.
- Flight, Costs: the captions of the Class, Circular universe and Mission speed groups dropped onto a line of their own instead of staying beside the controls they label.
- Flight: in the Ships panel the names, speeds and count fields of the fifteen ships no longer lined up in columns, and in the parameters panel the SR_KEY field stretched across the whole panel instead of ending where the universe row above it does.

> **RU:** В калькуляторе стоимости на вкладке «Формы жизни» добавлены поля для исследований, усиливающих классы игрока: «Улучшение Рок’тал для Коллекционера» и «Улучшение Кэлиш для Исследователя», у каждого свой уровень формы жизни. Бонус класса Коллекционер теперь учитывается во вместимости МТ и БТ в строке «Для доставки требуется» и в почасовой добыче на вкладке «Один элемент - неск. уровней».<br>Там же: если для выбранного исследования не хватает указанного уровня Лаборатории, калькулятор теперь сам поднимает её до нужного уровня и сообщает об этом, вместо того чтобы просто отказать в расчёте. Уровень, рассчитанный через Межгалактическую исследовательскую сеть, при этом не меняется.

## [2026-08-03] - site entry 58

### Added

- Build: the database schema validator compares the column types and nullability in `schema.sql` against the live database.
- Flight: when the universe settings or the map of populated systems cannot be loaded, a notification now says so; until now the panel silently kept its default values and the flight was computed from them. <!-- site -->

### Fixed

- Production: the "Crawlers boost" field only increased crawler production; in the game the same percentage (from the Ion Crystal Modules lifeform research) also reduces crawler energy consumption, which the calculator now applies as well. <!-- site -->
- Build: the database schema validator looked for `schema.sql` under `www/` and matched `SqlQuery` where the helper is `sqlQuery`, so it found neither the schema nor a single query and never validated anything.

- Sidebar: the changelog now loads for Bosnian, which the language whitelist rejected outright.
- `schema.sql`: `population_data` was missing `population_all` and `updated_at`, the two columns `get_population.php` has been writing and `ajax.php` reading, so on any database built from the schema the populated-systems query failed outright.
- Sidebar: when a message could not be sent, the dialog went blank with both buttons hidden and no way to tell whether it had gone out; the misspelling and e-mail forms now say that sending failed and let you try again.
- `schema.sql`: `change_descriptions.description` is `varchar(1024)`, the width production has.
- Flight, Production: an unterminated `<` in a saved universe or planet name passed the tag stripper untouched and reached the page as markup; the name now keeps its text and loses the `<`.
- Sidebar: the two failure messages of the misspelling and e-mail dialogs were English in all thirteen locales and are now translated; the English of "sending failed" also names what could not be sent, which the report dialog got wrong in three locales and vaguely right in the rest.

> **RU:** Калькулятор полёта: теперь показывается предупреждение, если не удалось загрузить настройки вселенной или карту заселённых систем — раньше расчёт молча использовал значения по умолчанию.<br>Калькулятор производства: бонус гусеничников (технология «Модули ионизированных кристаллов») теперь снижает их энергопотребление на тот же процент, что и раньше давал только прирост добычи.

## [2026-08-02] - site entry 57

### Added

- Production: fields for the bonus of the 18th Rock'tal technology. <!-- site -->

> **RU:** В Калькулятор производства добавлены поля для учёта бонуса от 18й технологии Рок'тал.<br> Если калькулятор всё ещё считает неправильно, пожалуйста, напишите мне в Discord или через форму обратной связи на сайте, указав ваш email.

## [2026-07-30] - site entry 56

### Added

- Moon: the Supra Refractor, the moon size details and the creation chance in the moon creation section. <!-- site -->
- Moon: a section for the Sensor Phalanx calculations. <!-- site -->
- Expeditions: import the ships' cargo capacity bonuses from the API 2 string on the Fleet page. <!-- site -->

### Changed

- Moon: migrate to the new framework. <!-- site -->
- Expeditions: migrate to the new framework. <!-- site -->

> **RU:** Калькулятор лун переведен на новый фреймворк. В раздел расчета создания луны добавлены учёт Рефрактора Супра и вывод подробностей о размере и шансе на создание. Создан новый раздел с расчётами, относящимися к Сенсорной Фаланге.<br>Калькулятор экспедиций также переведен на новый фреймворк. Там добавлена возможность импорта бонусов к грузоподъёмности кораблей из строки API 2 со страницы "Флот".

## [2026-07-27] - site entry 55

### Added

- Flight: search for save spots with a one-way flight only. <!-- site -->
- Flight: a fleet recall tab in the arrival time panel. <!-- site -->

### Changed

- Flight: migrate to the new framework. <!-- site -->

> **RU:** Калькулятор времени полёта переведён на новый фреймворк. В него добавлена возможность поиска точек сейва с полётом только в одну сторону. На панель расчета времени прибытия добавлена вкладка с расчётом отзыва флота.

## [2026-07-24] - site entry 54

### Added

- Graviton and Terraformer: Life Form bonuses. <!-- site -->

### Changed

- Graviton and Terraformer: migrate to the new framework. <!-- site -->

> **RU:** Калькуляторы Гравитационной технологии и Терраформера переведены на новый фреймворк. Теперь они учитывают бонусы Форм Жизни.

## [2026-07-22] - site entry 53

### Added

- Production: Life Form bonuses. <!-- site -->
- Production: priority mine upgrades on the All planets tab. <!-- site -->

### Changed

- Production: migrate to the new framework. <!-- site -->

> **RU:** Калькулятор производства переведен на новый фреймворк. Теперь он учитывает бонусы Форм Жизни. Также на вкладке "Все планеты" там добавлен раздел с приоритетными апгрейдами шахт.

## [2026-07-17] - site entry 52

### Added

- Flight: import API 2 data from the Fleet page, from a button next to the espionage report import. <!-- site -->

> **RU:** В Калькулятор полётов добавлена возможность импорта данных API 2 со страницы "Флот". Кнопка для открытия окна импорта размещена справа от кнопки импорта шпионского доклада.

## [2026-07-16] - site entry 51

### Added

- Costs: a field for the Life Form bonus to research speed of the Researcher class. <!-- site -->
- Costs: the bonuses that reduce research cost and time, listed in the Full table on the Lifeforms tab. <!-- site -->

> **RU:** В калькулятор стоимости добавлено поле для учёта бонуса Форм жизни к ускорению исследований для класса Исследователь. Также в этот калькулятор добавлен учёт различных бонусов для снижения стоимости и времени исследований, см. "Полная таблица" на вкладке "Формы жизни" в параметрах калькулятора.

## [2026-07-11] - site entry 50

### Added

- Trade: fields for the Life Form bonuses to transport cargo capacity. <!-- site -->

### Changed

- Queue: migrate to the new framework. <!-- site -->

> **RU:** В торговый калькулятор добавлены поля для учёта бонусов Форм Жизни к грузоподъёмности транспортов.<br>Калькулятор очереди строительства переведен на новый фреймворк.

## [2026-06-27] - site entry 49

### Added

- Costs: fields for the Life Form bonuses to transport cargo capacity. <!-- site -->

> **RU:** В Калькулятор стоимости добавлены поля для ввода бонусов Форм Жизни к грузоподъёмности транспортов.

## [2026-05-05] - site entry 48

### Added

- LF costs: the third building of each Life Form in the parameters panel. <!-- site -->
- LF costs: a tooltip with the construction energy next to the second building's name. <!-- site -->

### Changed

- LF costs: migrate to the new framework. <!-- site -->
- LF costs: pick a single research into the table from a dropdown instead of listing them all; the dropdown on the third tab holds the researches of every Life Form. <!-- site -->

### Removed

- LF costs: the Energy column from the tables - energy is not required for construction or research. <!-- site -->

> **RU:** Калькулятор стоимости для Форм жизни переведен на новый фреймворк. Также в нём внесены следующие изменения:<br>-на панель параметров добавлены третьи здания каждой Формы жизни<br>-из таблиц убран столбец "Энергия", т.к. для строительства и исследования энергия не требуется; исключение - второе здание, для него возле названия в таблице добавлена подсказка с указанием необходимой для строительства энергии<br>-на вкладках с исследованиями вместо отображения всего списка для выбранной в параметрах Формы жизни добавлены выпадающие списки, позволяющие выбрать и добавить в таблицу конкретное исследование; на третьей вкладке в выпадающем списке одновременно присутствуют все исследования всех Форм жизни

## [2026-05-04] - site entry 47

### Added

- Costs: exchange rate inputs; the cost in standard units now takes them into account. <!-- site -->

> **RU:** В Калькулятор стоимости добавлены поля для ввода курсов обмена. Стоимость в стандартных единицах теперь рассчитывается с учётом этих курсов.

## [2026-04-30] - site entry 46

### Added

- Costs: a column with the cost in standard units. <!-- site -->

> **RU:** В таблицы Калькулятора стоимости добавлен столбец со стоимостью в стандартных единицах.

## [2026-04-12] - site entry 45

### Added

- Costs: parameters for the Life Form bonuses. <!-- site -->
- Costs: a resource delivery calculation that accounts for the resources already at the destination. <!-- site -->
- Costs: fields for the cost of several copies of the same building. <!-- site -->

### Changed

- Costs: migrate to the new framework. <!-- site -->
- Costs: split the parameters panel into tabs. <!-- site -->

> **RU:** Калькулятор стоимости переведен на новый фреймворк. Также в нём сделаны следующие изменения:<br>-панель параметров разделена на вкладки;<br>-добавлены параметры для учёта бонусов от Форм Жизни;<br>-добавлен расчёт доставки ресурсов с учётом уже имеющихся в месте назначения;<br>-добавлены поля для расчёта стоимости нескольких копий одной и той же постройки.<br>Пожалуйста, дайте мне знать, если что-то рассчитывается не так, как нужно, или есть параметры, которые калькулятор не учитывает.

## [2026-01-30] - site entry 44

### Added

- Flight: country and universe selectors that fetch the universe population data from the public API for the servers where fleets skip empty and inactive systems. <!-- site -->
- Flight: a setting to adjust the empty system count, because the public population data updates once a week. <!-- site -->

### Changed

- Flight: take the total bonus of the 18th Life Form researches instead of the Mechan General's and Rock'tal Collector's enhancement levels. <!-- site -->
- Flight: split the universe speed setting into peaceful, war and holding. <!-- site -->

> **RU:** Калькулятор времени полета был обновлен:<br>1) Вместо уровней Улучшения Мех для Генерала и Улучшения Роктал для Коллекционера, в калькулятор теперь нужно вводить общие бонусы от исследований 18-й формы жизни соответственно.<br>2) Настройка скорости вселенной теперь разделена на мирные, боевые скорости и скорость удержания.<br>
3) Чтобы учесть игнорирование флотом пустых/неактивных систем на некоторых серверах, теперь есть селекторы стран и вселенных. Если выбранный сервер поддерживает пропуск систем, калькулятор будет получать и использовать данные о населении вселенной из общедоступного API.<br>4) Поскольку данные о населении в общедоступном API обновляются раз в неделю, фактическое расстояние между начальной и конечной системами в одной галактике может отличаться. Чтобы учесть это, теперь есть настройка для корректировки количества пустых систем.

## [2025-12-09] - site entry 43

### Added

- Sidebar: a link to the project's code on GitHub. <!-- site -->

### Changed

- Trade: migrate to a modern framework - the first calculator to get the new look, which also renders better on mobile devices. <!-- site -->

> **RU:** Я начал переход на современный фреймворк, чтобы было проще вносить изменения и сайт стал лучше выглядеть на мобильных устройствах. Первым обновление получил Калькулятор торговли. Пожалуйста, попробуйте новую версию и при необходимости дайте мне обратную связь.<br>Кроме того, в боковую панель добавлена ссылка на код проекта на GitHub.

## [2025-11-22] - site entry 42

### Added

- Costs: the Full Numbers setting. <!-- site -->

### Fixed

- LF costs: save the cost and research time reduction settings correctly. <!-- site -->

> **RU:** В Калькулятор стоимости добавлена настройка "Числа полностью". Калькулятор стоимости Форм жизни теперь корректно сохраняет настройки уменьшения стоимости и времени исследований.

## [2025-11-14] - site entry 41

### Added

- Feedback: a link to the Discord server. <!-- site -->

> **RU:** В раздел "Обратная связь" добавлена ссылка на Discord-сервер.

## [2025-11-01] - site entry 40

### Added

- Expeditions: several more Life Form technologies and the resource finder booster. <!-- site -->

### Fixed

- Expeditions: the universe speed setting. <!-- site -->

> **RU:** Калькулятор экспедиций теперь учитывает ещё несколько технологий Форм Жизни, а также бустер поиска ресурсов. Кроме того, в этом калькуляторе исправлена ошибка, связанная с учётом скорости вселенной.

## [2025-10-08] - site entry 39

### Added

- The Expeditions calculator, from an original idea by Vesselin Bontchev. <!-- site -->

> **RU:** Калькулятор экспедиций (исходная идея Весселина Бонтчева) теперь интегрирован на наш сайт

## [2025-10-04] - site entry 38

### Added

- Graviton and Terraformer: the total Life Form bonus to energy production. <!-- site -->

> **RU:** Калькуляторы Терраформера и Гравитационной технологии теперь учитывают суммарный бонус Форм Жизни к производству энергии.

## [2025-10-02] - site entry 37

### Added

- Graviton and Terraformer: the level of the Disruption Chamber. <!-- site -->
- Graviton: set the desired technology level. <!-- site -->

> **RU:** Калькуляторы Терраформера и Гравитационной технологии теперь учитывают уровень Камеры Разрыва. В Калькуляторе Гравитационной технологии теперь можно задать желаемый уровень технологии.

## [2025-02-11] - site entry 35

### Changed

- Flight: rework the Life Form bonuses - copy the ship bonus table out of OGame and paste it into the calculator. <!-- site -->

> **RU:** Переработан учёт бонусов Форм Жизни в Калькуляторе полётов: теперь можно скопировать в OGame таблицу со значениями бонусов кораблей и вставить её в калькулятор.

## [2023-02-22] - site entry 34

### Added

- LF costs: the bonus from the Mineral Research Centre. <!-- site -->

> **RU:** В калькулятор стоимости для Форм жизни добавлен учёт бонуса от Центра исследования минералов.

## [2023-02-16] - site entry 33

### Added

- LF costs: the Megalith bonus. <!-- site -->

> **RU:** В калькулятор стоимости для Форм Жизни добавлен учёт бонуса Мегалита

## [2023-04-26] - site entry 32

### Added

- The cost calculator for Life Form buildings and technologies. <!-- site -->

> **RU:** Добавлен калькулятор стоимости зданий и технологий Форм жизни

## [2023-03-17] - site entry 31

### Added

- Flight: a setting to force the fleet speed, for example from a Sensor Phalanx report. <!-- site -->

> **RU:** В Калькулятор полётов введена настройка, позволяющая принудительно задать скорость флота (например, из отчёта Сенсорной Фаланги)

## [2022-12-02] - site entry 30

### Added

- Flight: the cargo space of Espionage Probes. <!-- site -->
- Flight: save and load the universe settings and the fleet ship list. <!-- site -->
- Flight: Life Form bonuses. <!-- site -->

> **RU:** Доработан калькулятор времени полёта: добавлен учёт грузоподъёмности Шпионских Зондов; добавлена возможность сохранять и загружать настройки Вселенной и список кораблей во флоте; добавлен учёт бонусов Форм жизни.

## [2022-11-26] - site entry 29

### Added

- Trade: mark that the resources have to be delivered to a moon. <!-- site -->

> **RU:** Теперь в Торговом калькуляторе можно указать, что ресурсы нужно доставить на луну.

## [2022-04-14] - site entry 28

### Added

- Costs: the Dark Matter cost of a one-time construction or research time reduction, calculated per row. <!-- site -->

> **RU:** В Калькулятор стоимости добавлен вывод затрат Тёмной Материи на однократное сокращение времени строительства/исследования. Стоимость ускорения постройки зданий и проведения исследований рассчитывается по каждой строке отдельно, а стоимость ускорения строи

## [2022-04-11] - site entry 27

### Fixed

- Trade: restore the automatic update of the universe list from the OGame website. <!-- site -->

> **RU:** Восстановлена работа автоматического обновления списка Вселенных (для Торгового калькулятора) с сайта OGame. Дайте мне знать, если вашей вселенной по-прежнему нет в списке.

## [2022-03-17] - site entry 26

### Added

- The Bosnian translation. <!-- site -->

> **RU:** Добавлен перевод на боснийский.

## [2021-11-11] - site entry 25

### Added

- Production and Flight: a setting for the Traders alliance class bonus. <!-- site -->

> **RU:** В калькулятор производства и калькулятор времени полета добавлен учёт бонуса альянса "Скупщики".

## [2021-11-05] - site entry 24

### Added

- Flight: a setting for the Warriors alliance class bonus. <!-- site -->

> **RU:** В калькулятор времени полета добавлен учёт бонуса альянса "Воины".

## [2021-03-18] - site entry 23

### Added

- Production: the payback calculation for mines and Plasma Technology. <!-- site -->

> **RU:** В Калькулятор Производства добавлен расчёт окупаемости шахт и Плазменной технологии.

## [2021-03-06] - site entry 22

### Fixed

- Production: enter data directly on the All planets tab again. <!-- site -->

> **RU:** В Калькуляторе Производства на вкладке "Все планеты" снова можно вводить данные напрямую.

## [2021-02-24] - site entry 21

### Added

- Production: clone the entered data to all planets. <!-- site -->

> **RU:** В Калькуляторе Производства теперь можно склонировать введённые данные на все планеты. В следующем обновлении будет возвращена возможность прямого редактирования данных на вкладке "Все планеты".

## [2021-02-03] - site entry 20

### Added

- Production: save all settings separately for each universe. <!-- site -->

> **RU:** Калькулятор производства теперь позволяет сохранять все настройки отдельно для каждой вселенной.

## [2021-01-25] - site entry 19

### Added

- Production: set every parameter per planet on the All planets tab. <!-- site -->

> **RU:** Калькулятор производства теперь позволяет указывать все параметры для каждой из планет на вкладке "Все планеты".

## [2020-10-12] - site entry 18

### Added

- Production: the metal production bonus on big planets and the Crawler overload. <!-- site -->

> **RU:** Калькулятор строительства теперь учитывает бонус производства металла на больших планетах и перегрузку Гусеничников.

## [2020-10-05] - site entry 17

### Added

- Flight: the 5% speed increments of the General class. <!-- site -->

> **RU:** Калькулятор времени полёта теперь учитывает 5% шаг скорости для Генерала.

## [2020-08-08] - site entry 16

### Added

- Costs: 20x research speed. <!-- site -->

> **RU:** Добавлена 20-кратная скорость исследования.

## [2020-06-21] - site entry 15

### Added

- The Platinum production boosters. <!-- site -->
- Costs: 18x research speed. <!-- site -->

> **RU:** Добавлены платиновые бустеры производства и 18-кратная скорость исследования.

## [2020-06-02] - site entry 14

### Added

- The energy boosters. <!-- site -->

> **RU:** Добавлены бустеры энергии.

## [2020-04-28] - site entry 13

### Changed

- Costs: raise the maximum research speed to 14. <!-- site -->

> **RU:** Максимальная скорость исследований в Калькуляторе стоимости увеличена до 14.

## [2020-04-05] - site entry 12

### Changed

- A notice on how to report a calculation error; no product change. <!-- site -->

> **RU:** Это не запись об изменении. Я хочу высказать просьбу. Когда вы сообщаете об ошибке в расчетах, пожалуйста, приложите скриншот калькулятора. Если вы видите в OGame одно, а в моём калькуляторе другое, приложите и скриншот из игры. Это не обязательно, но оче

## [2020-03-14] - site entry 11

### Changed

- Production: store an unrealistically large number of planets. <!-- site -->

> **RU:** Калькулятор производства теперь позволяет сохранять неправдоподобно большое количество планет.

## [2020-02-15] - site entry 10

### Changed

- Costs: raise the maximum research speed to 12. <!-- site -->

> **RU:** Максимальная скорость исследований в Калькуляторе стоимости увеличена до 12.

## [2020-01-31] - site entry 9

### Changed

- Production: update for OGame 7. <!-- site -->

> **RU:** Калькулятор производства обновлен для версии 7.

## [2020-01-16] - site entry 8

### Changed

- Costs: update for OGame 7. <!-- site -->

> **RU:** Калькулятор стоимости обновлен для версии 7.

## [2020-01-12] - site entry 7

### Changed

- Graviton and Terraformer: update for OGame 7. <!-- site -->

> **RU:** Калькуляторы Терраформера и Грав. технологии обновлены для версии 7.

## [2020-01-11] - site entry 6

### Changed

- Moon: update for OGame 7. <!-- site -->

> **RU:** Калькулятор лун обновлен для версии 7.

## [2020-01-10] - site entry 5

### Changed

- Flight: update for OGame 7. <!-- site -->
- Flight: the deuterium consumption of the General class is unreliable because of an OGame bug. <!-- site -->

> **RU:** Калькулятор времени полёта обновлен для версии 7.</br>Расчёт затрат дейтерия для класса Генерал ненадежен из-за бага OGame.

## [2020-01-05] - site entry 4

### Added

- Feedback: a link to our Stomt page. <!-- site -->

> **RU:** В раздел "Обратная связь" добавлена ссылка на нашу страницу в Stomt.

## [2020-01-04] - site entry 3

### Added

- Costs: the universe research speed and the increased research speed event. <!-- site -->

### Changed

- Start implementing the changes introduced in OGame 7.0. <!-- site -->

> **RU:** В Калькулятор стоимости добавлен учёт скорости исследования во вселенной и события, ускоряющего исследования.</br>Начаты работы по учёту изменений, введённых версией 7.0.

## [2019-10-20] - site entry 2

### Changed

- The donation widget now accepts USD. <!-- site -->

> **RU:** Виджет пожертвований теперь принимает доллары.

## [2019-10-11] - site entry 1

### Changed

- Raise the maximum allowed number of systems to 550. <!-- site -->

> **RU:** Максимальное допустимое количество систем увеличено до 550.

## [2019-10-05] - site entry 0

### Added

- Start keeping a changelog. <!-- site -->

> **RU:** Начато ведение журнала изменений.
