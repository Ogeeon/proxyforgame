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

- Build: the database schema validator compares the column types and nullability in `schema.sql` against the live database.

### Fixed

- Build: the database schema validator looked for `schema.sql` under `www/` and matched `SqlQuery` where the helper is `sqlQuery`, so it found neither the schema nor a single query and never validated anything.

- Sidebar: the changelog now loads for Bosnian, which the language whitelist rejected outright.
- `schema.sql`: `population_data` was missing `population_all` and `updated_at`, the two columns `get_population.php` has been writing and `ajax.php` reading, so on any database built from the schema the populated-systems query failed outright.
- `schema.sql`: `change_descriptions.description` is `varchar(1024)`, the width production has.
- Flight, Production: an unterminated `<` in a saved universe or planet name passed the tag stripper untouched and reached the page as markup; the name now keeps its text and loses the `<`.

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
