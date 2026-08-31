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

### Added

- Build: `make mail` reads the mailbox the contact forms deliver to, so feedback can be gone through without opening Gmail. Read-only over IMAP - the mailbox is only ever examined, never modified - with filters for the messages the forms send, a date, a Gmail search, or one message by id. Credentials are an app password in `.env`.
- Deploy: versioned database migrations. SQL files in `db/migrations/` are applied to both hosts by `pfg-sync` before the smoke test and tracked in a `schema_migrations` table; a failed migration rolls the deploy back. Replaces applying every schema change by hand over SSH.
- Deploy: the watchdog now catches `webhook.php` drifting on production. The GitHub receiver lives outside the checkout, so a deploy never updates the running copy and a change to it had to be reinstalled by hand with nothing warning when that was forgotten. `ajax.php?service=health` publishes the sha256 of the installed receiver - the digest only - and the watchdog compares it against `deploy/webhook.php` at the commit that host reports as deployed, so a rollback does not read as drift.

### Fixed

- Deploy: a dispatched rollback no longer undid itself. Both hosts also reconcile against `main` on a timer, and that walk climbed straight back to the newest green commit - within five minutes on the standby, and on production at the next hourly run, so the rollback lever held for at most 59 minutes there. A rollback now pins both hosts to the commit it names, and the pin lapses by itself once `main` moves, so landing the fix is all it takes to resume rolling forward.

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
