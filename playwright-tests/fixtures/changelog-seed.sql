--
-- Changelog rows for the e2e suite.
--
-- The real entries live in `changelog.sql`, which is rewritten for every release
-- and applied to the hosts by the deploy, not by `make db-seed`. A fresh
-- database - CI's above all - therefore has the two change_* tables empty and
-- `service=changelog` answers with an empty array. The api spec checks the shape
-- of a non-empty answer, so it needs rows of its own.
--
-- Imported by `make db-seed`, right after schema.sql has recreated the tables.
-- Ids stay small so the "nothing newer than lastSeen" test, which asks with
-- lastSeen=999999, still gets nothing back.
--

/*!40101 SET NAMES utf8mb4 */;

INSERT INTO `change_headers` (`id`, `ts`) VALUES
(1, '2026-01-15'),
(2, '2026-02-20');

INSERT INTO `change_descriptions` (`id`, `lang`, `description`) VALUES
(1, 'en', 'Test fixture: the first entry of the sample changelog.'),
(1, 'ru', 'Тестовые данные: первая запись примера списка изменений.'),
(2, 'en', 'Test fixture: the second entry of the sample changelog.'),
(2, 'ru', 'Тестовые данные: вторая запись примера списка изменений.');
