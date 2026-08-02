'use strict';

// Tests for the CHANGELOG.md parser and the release cut (scripts/changelog.js).
// The script itself only reads and writes files around these functions, so the
// rules that matter - what makes a file invalid, and what a release produces -
// are pinned down here rather than by running the CLI.

const { describe, it } = require('node:test');
const { expect } = require('./expect');

const { validate, release, buildSql, escapeSql } = require('../scripts/changelog.js');

const HEADER = '# Changelog\n\nProse.\n\n## [Unreleased]\n';

/**
 * @param {string} body Release sections appended after the header.
 * @returns {string}
 */
const file = (body) => `${HEADER}${body}`;

const ENTRY_57 = `
## [2026-08-02] - site entry 57

### Added

- Production: fields for the 18th Rock'tal technology bonus. <!-- site -->

### Fixed

- Make every rendered page pass the Nu Html Checker.

> **RU:** В Калькулятор производства добавлены поля.
`;

const ENTRY_56 = `
## [2026-07-30] - site entry 56

### Added

- Moon: the Sensor Phalanx section. <!-- site -->

> **RU:** Создан новый раздел с расчётами Сенсорной Фаланги.
`;

describe('validate', () => {
    it('accepts a well-formed file', () => {
        const { errors, warnings } = validate(file(ENTRY_57 + ENTRY_56));

        expect(errors).toHaveLength(0);
        expect(warnings).toHaveLength(0);
    });

    it('accepts an empty [Unreleased] but not an empty release', () => {
        expect(validate(file(ENTRY_57)).errors).toHaveLength(0);

        const { errors } = validate(file('\n## [2026-08-03]\n'));
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('has no "###" group');
    });

    it('allows a gap in the site entry ids', () => {
        // Entry 36 is missing from the published history and always will be.
        const body = ENTRY_57.replace('57', '37') + ENTRY_56.replace('56', '35');

        expect(validate(file(body)).errors).toHaveLength(0);
    });

    it('rejects site entry ids that do not decrease', () => {
        const { errors } = validate(file(ENTRY_57 + ENTRY_56.replace('site entry 56', 'site entry 57')));

        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('must be smaller than 57');
    });

    it('warns about an inverted date without failing', () => {
        // The real history has one: entry 32 is dated after entries 33 and 34.
        const { errors, warnings } = validate(file(ENTRY_57 + ENTRY_56.replace('2026-07-30', '2026-09-01')));

        expect(errors).toHaveLength(0);
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('is dated after');
    });

    it('requires a quote when a bullet is marked for the site', () => {
        const { errors } = validate(file(ENTRY_57.replace(/\n> \*\*RU:\*\*.*\n/, '\n')));

        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('no "> **RU:**" quote');
    });

    it('rejects a quote when nothing is marked for the site', () => {
        const body = ENTRY_57.replace(' <!-- site -->', '').replace(' - site entry 57', '');
        const { errors } = validate(file(body));

        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('has a "> **RU:**" quote but no bullet marked');
    });

    it('rejects a site entry id on a release that publishes nothing', () => {
        const { errors } = validate(file(ENTRY_57.replace(' <!-- site -->', '')));

        expect(errors.some((e) => e.includes('carries "- site entry 57" but no bullet is marked'))).toBe(true);
    });

    it('rejects a quote longer than the database column', () => {
        const { errors } = validate(file(ENTRY_57.replace('В Калькулятор производства добавлены поля.', 'я'.repeat(1025))));

        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('over the 1024');
    });

    it('warns before the quote reaches the limit', () => {
        const { errors, warnings } = validate(file(ENTRY_57.replace('В Калькулятор производства добавлены поля.', 'я'.repeat(950))));

        expect(errors).toHaveLength(0);
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('950 characters');
    });

    it('rejects a group that is not a Keep a Changelog one', () => {
        const { errors } = validate(file(ENTRY_57.replace('### Fixed', '### Improved')));

        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('is not a Keep a Changelog group');
    });

    it('rejects groups written out of order', () => {
        const body = `
## [2026-08-02] - site entry 57

### Fixed

- Something. <!-- site -->

### Added

- Something else.

> **RU:** Текст.
`;
        const { errors } = validate(file(body));

        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('is out of order');
    });

    it('rejects an empty group', () => {
        const body = ENTRY_57.replace("- Production: fields for the 18th Rock'tal technology bonus. <!-- site -->", '');
        const { errors } = validate(file(body));

        expect(errors.some((e) => e.includes('has no bullets'))).toBe(true);
    });

    it('rejects a malformed release heading', () => {
        const { errors } = validate(file(ENTRY_57.replace('## [2026-08-02] - site entry 57', '## 2026-08-02')));

        expect(errors.some((e) => e.includes('malformed release heading'))).toBe(true);
    });

    it('rejects a missing [Unreleased] section', () => {
        const { errors } = validate(`# Changelog\n\nProse.\n${ENTRY_57}`);

        expect(errors.some((e) => e.includes('exactly one "## [Unreleased]"'))).toBe(true);
    });
});

describe('escapeSql', () => {
    it('doubles single quotes', () => {
        expect(escapeSql("Рок'тал")).toBe("Рок''тал");
    });
});

describe('buildSql', () => {
    it('writes one header row and one row per language', () => {
        const lines = buildSql(58, '2026-08-05', "Рок'тал").trim().split('\n').filter(Boolean);

        expect(lines).toHaveLength(13);
        expect(lines[0]).toBe("insert into change_headers (id, ts) values (58, '2026-08-05');");
        expect(lines[1]).toBe("insert into change_descriptions (id, lang, description) values (58, 'ru', 'Рок''тал');");
        expect(lines[12]).toContain("'bs'");
    });
});

describe('release', () => {
    const unreleased = `# Changelog

Prose.

## [Unreleased]

### Added

- Moon: the sensor phalanx range. <!-- site -->

### Changed

- Extract the API 2 normalizer into own-api.js.

> **RU:** В Калькулятор лун добавлена дальность Сенсорной Фаланги.
${ENTRY_57}`;

    it('cuts [Unreleased] into a dated section and allocates the next id', () => {
        const result = release(unreleased, '2026-08-05');

        expect(result.id).toBe(58);
        expect(result.content).toContain('## [2026-08-05] - site entry 58');
        expect(result.sql).toContain("values (58, '2026-08-05')");
        // The released bullets moved under the dated heading, and a fresh empty
        // [Unreleased] sits above them.
        expect(result.content.indexOf('## [Unreleased]')).toBeLessThan(result.content.indexOf('## [2026-08-05]'));
        expect(validate(result.content).errors).toHaveLength(0);
    });

    it('refuses to release when nothing is marked for the site', () => {
        let message = '';
        try {
            release(unreleased.replace('- Moon: the sensor phalanx range. <!-- site -->', '- Moon: the sensor phalanx range.'), '2026-08-05');
        } catch (error) {
            message = error instanceof Error ? error.message : String(error);
        }

        expect(message).toContain('there is no entry to publish');
    });

    it('refuses to release without a Russian announcement', () => {
        let message = '';
        try {
            release(unreleased.replace(/> \*\*RU:\*\* В Калькулятор лун.*\n/, ''), '2026-08-05');
        } catch (error) {
            message = error instanceof Error ? error.message : String(error);
        }

        expect(message).toContain('no "> **RU:**" quote');
    });

    it('refuses to reuse an existing release date', () => {
        let message = '';
        try {
            release(unreleased, '2026-08-02');
        } catch (error) {
            message = error instanceof Error ? error.message : String(error);
        }

        expect(message).toContain('already exists');
    });
});
