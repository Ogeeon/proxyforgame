'use strict';

// The subset of JSON Schema the tool definitions use, enforced on the way in.
//
// Each tool publishes its inputSchema in tools/list, and the model builds its
// arguments from it. Validating against that same object - not against a
// hand-written copy of the rules inside the handler - is what keeps the two
// from drifting apart. Defaults declared in the schema are filled in here, so a
// handler sees every optional field with a value.
//
// Supported keywords: type (object, array, string, number, integer, boolean),
// properties, required, additionalProperties (false, or a schema for every
// property not listed), propertyNames (its enum), items, enum, minimum,
// maximum, minItems, maxItems, default. Anything else in a schema is
// documentation only.
//
// propertyNames with additionalProperties is how a map such as ship -> count
// is written: the ship keys are listed once instead of once per property, which
// keeps the schemas every client loads into its context small.

/**
 * @typedef {object} JsonSchema
 * @property {string} [type]
 * @property {string} [description]
 * @property {Record<string, JsonSchema>} [properties]
 * @property {string[]} [required]
 * @property {boolean|JsonSchema} [additionalProperties]
 * @property {{enum?: string[]}} [propertyNames]
 * @property {JsonSchema} [items]
 * @property {Array<string|number|boolean>} [enum]
 * @property {number} [minimum]
 * @property {number} [maximum]
 * @property {number} [minItems]
 * @property {number} [maxItems]
 * @property {unknown} [default]
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function typeOf(value) {
    if (value === null) {
        return 'null';
    }
    if (Array.isArray(value)) {
        return 'array';
    }
    if (typeof value === 'number') {
        return Number.isInteger(value) ? 'integer' : 'number';
    }
    return typeof value;
}

/**
 * @param {string} wanted
 * @param {unknown} value
 */
function matchesType(wanted, value) {
    const actual = typeOf(value);
    if (wanted === 'number') {
        return (actual === 'number' || actual === 'integer') && Number.isFinite(value);
    }
    return actual === wanted;
}

/**
 * Checks a value against a schema and returns a copy with the defaults filled in.
 *
 * @param {JsonSchema} schema
 * @param {unknown} value
 * @param {string} [path] where the value sits, for the error messages
 * @returns {{value: any, errors: string[]}}
 */
function validate(schema, value, path = 'arguments') {
    /** @type {string[]} */
    const errors = [];
    const result = check(schema, value, path, errors);
    return { value: result, errors };
}

/**
 * @param {JsonSchema} schema
 * @param {unknown} value
 * @param {string} path
 * @param {string[]} errors
 * @returns {any}
 */
function check(schema, value, path, errors) {
    if (schema.type && !matchesType(schema.type, value)) {
        errors.push(`${path} must be ${article(schema.type)}, got ${typeOf(value)}`);
        return value;
    }
    if (schema.enum && !schema.enum.includes(/** @type {any} */ (value))) {
        errors.push(`${path} must be one of: ${schema.enum.join(', ')}`);
        return value;
    }
    if (typeof value === 'number') {
        checkBounds(value, schema.minimum, schema.maximum, `${path} must be`, errors);
        return value;
    }
    if (Array.isArray(value)) {
        checkBounds(value.length, schema.minItems, schema.maxItems, `${path} must have`, errors, ' items');
        const items = schema.items;
        return items ? value.map((item, i) => check(items, item, `${path}[${i}]`, errors)) : value;
    }
    if (typeOf(value) === 'object') {
        return checkObject(schema, /** @type {Record<string, unknown>} */ (value), path, errors);
    }
    return value;
}

/**
 * A number, or an array's length, against an optional lower and upper bound.
 * @param {number} n
 * @param {number|undefined} min
 * @param {number|undefined} max
 * @param {string} subject e.g. "arguments.x must be"
 * @param {string[]} errors
 * @param {string} [unit] e.g. " items"
 */
function checkBounds(n, min, max, subject, errors, unit = '') {
    if (min !== undefined && n < min) {
        errors.push(`${subject} at least ${min}${unit}`);
    }
    if (max !== undefined && n > max) {
        errors.push(`${subject} at most ${max}${unit}`);
    }
}

/**
 * @param {JsonSchema} schema
 * @param {Record<string, unknown>} value
 * @param {string} path
 * @param {string[]} errors
 * @returns {Record<string, unknown>}
 */
function checkObject(schema, value, path, errors) {
    /** @type {Record<string, unknown>} */
    const out = {};

    for (const name of schema.required ?? []) {
        if (value[name] === undefined) {
            errors.push(`${path}.${name} is required`);
        }
    }
    for (const [name, item] of Object.entries(value)) {
        checkProperty(schema, name, item, `${path}.${name}`, errors, out);
    }
    fillDefaults(schema, path, out);
    return out;
}

/**
 * One property of an object: refused when the schema does not admit its name,
 * checked against its own schema - or the shared one of a map - when it has
 * one, passed through otherwise. What passes lands in `out`.
 * @param {JsonSchema} schema the object's schema
 * @param {string} name
 * @param {unknown} item
 * @param {string} path
 * @param {string[]} errors
 * @param {Record<string, unknown>} out
 */
function checkProperty(schema, name, item, path, errors, out) {
    const names = schema.propertyNames?.enum;
    if (names && !names.includes(name)) {
        errors.push(`${path} is not one of: ${names.join(', ')}`);
        return;
    }
    const extra = schema.additionalProperties;
    const sub = schema.properties?.[name] ?? (typeof extra === 'object' ? extra : undefined);
    if (sub) {
        out[name] = check(sub, item, path, errors);
    } else if (extra === false) {
        errors.push(`${path} is not a known field`);
    } else {
        out[name] = item;
    }
}

/**
 * Fills in the defaults of the properties the caller left out. An optional
 * group left out entirely still gets its members' defaults, so a handler can
 * read `args.drives.impulse` without checking that `drives` is there first.
 * @param {JsonSchema} schema
 * @param {string} path
 * @param {Record<string, unknown>} out
 */
function fillDefaults(schema, path, out) {
    for (const [name, sub] of Object.entries(schema.properties ?? {})) {
        if (out[name] !== undefined) {
            continue;
        }
        if (sub.default !== undefined) {
            out[name] = structuredClone(sub.default);
            continue;
        }
        if (sub.type !== 'object' || !sub.properties) {
            continue;
        }
        const filled = checkObject(sub, {}, `${path}.${name}`, []);
        if (Object.keys(filled).length > 0) {
            out[name] = filled;
        }
    }
}

/** @param {string} type */
function article(type) {
    return /^[aeiou]/.test(type) ? `an ${type}` : `a ${type}`;
}

module.exports = { validate };
