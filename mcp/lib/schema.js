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
        if (schema.minimum !== undefined && value < schema.minimum) {
            errors.push(`${path} must be at least ${schema.minimum}`);
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
            errors.push(`${path} must be at most ${schema.maximum}`);
        }
        return value;
    }
    if (Array.isArray(value)) {
        if (schema.minItems !== undefined && value.length < schema.minItems) {
            errors.push(`${path} must have at least ${schema.minItems} items`);
        }
        if (schema.maxItems !== undefined && value.length > schema.maxItems) {
            errors.push(`${path} must have at most ${schema.maxItems} items`);
        }
        const items = schema.items;
        return items ? value.map((item, i) => check(items, item, `${path}[${i}]`, errors)) : value;
    }
    if (typeOf(value) === 'object') {
        return checkObject(schema, /** @type {Record<string, unknown>} */ (value), path, errors);
    }
    return value;
}

/**
 * @param {JsonSchema} schema
 * @param {Record<string, unknown>} value
 * @param {string} path
 * @param {string[]} errors
 * @returns {Record<string, unknown>}
 */
function checkObject(schema, value, path, errors) {
    const properties = schema.properties ?? {};
    /** @type {Record<string, unknown>} */
    const out = {};

    for (const name of schema.required ?? []) {
        if (value[name] === undefined) {
            errors.push(`${path}.${name} is required`);
        }
    }
    for (const [name, item] of Object.entries(value)) {
        const names = schema.propertyNames?.enum;
        if (names && !names.includes(name)) {
            errors.push(`${path}.${name} is not one of: ${names.join(', ')}`);
            continue;
        }
        const extra = schema.additionalProperties;
        const sub = properties[name] ?? (typeof extra === 'object' ? extra : undefined);
        if (!sub) {
            if (extra === false) {
                errors.push(`${path}.${name} is not a known field`);
            } else {
                out[name] = item;
            }
            continue;
        }
        out[name] = check(sub, item, `${path}.${name}`, errors);
    }
    for (const [name, sub] of Object.entries(properties)) {
        if (out[name] !== undefined) {
            continue;
        }
        if (sub.default !== undefined) {
            out[name] = structuredClone(sub.default);
        } else if (sub.type === 'object' && sub.properties) {
            // An optional group the caller left out entirely still gets its
            // members' defaults, so a handler can read `args.drives.impulse`
            // without checking that `drives` is there first.
            const filled = checkObject(sub, {}, `${path}.${name}`, []);
            if (Object.keys(filled).length > 0) {
                out[name] = filled;
            }
        }
    }
    return out;
}

/** @param {string} type */
function article(type) {
    return /^[aeiou]/.test(type) ? `an ${type}` : `a ${type}`;
}

module.exports = { validate };
