// The MCP server's tools take the same values a calculator page does, and their
// input schemas carry their own bounds. Nothing ties the two together, so they
// drift apart: the phalanx tool took systems up to 999 while the page stopped
// at 550. A calculator's spec lists which tool argument is which page field,
// and expectMcpBoundsMatchPage checks every pair against the page as loaded.
//
// The rule: the lower bounds are equal, and so are the upper ones - except that
// a tool may cap a field the page leaves open-ended (a building level is
// 0..100 in the tool, unbounded on the page). A select is a pick from the values
// the game uses rather than a range, so there every option has to lie within
// the tool's bounds instead - or, when the tool lists its values, be one of them.
//
// The page side is read twice when a row names a saved parameter: the field's
// own constraints (what blur clamps the input to), and the settings' validate
// (what a saved setting has to satisfy to be loaded back).

import { expect } from './base';
import { createTools } from '../../mcp/tools';

const TOOLS = Object.fromEntries(createTools({ siteApi: {} }).map((tool) => [tool.name, tool]));

/**
 * @typedef {object} BoundsRow
 * @property {string} tool The MCP tool's name.
 * @property {string} arg Path into its arguments: `a.b` for a property, and a
 *   key of a keyed map (`destroyed.recycler`) or `[]` for an array's items.
 * @property {string} selector The page field.
 * @property {string} [prm] The options.prm key the field is saved under (an
 *   `options` key on the trade page).
 * @property {number} [scale] Page value per unit of the tool's argument, when
 *   the two count differently (a factor the page takes in tenths).
 */

/**
 * @param {string} toolName
 * @param {string} path
 */
function schemaAt(toolName, path) {
    const tool = TOOLS[toolName];
    if (!tool) throw new Error(`no MCP tool ${toolName}`);
    let node = tool.inputSchema;
    for (const raw of path.split('.')) {
        const isArray = raw.endsWith('[]');
        const key = isArray ? raw.slice(0, -2) : raw;
        node = node.properties?.[key] ?? (typeof node.additionalProperties === 'object' ? node.additionalProperties : undefined);
        if (node && isArray) node = node.items;
        if (!node) throw new Error(`${toolName} has no argument ${path}`);
    }
    return node;
}

/**
 * The tool's bounds for one argument, in the page's units.
 * @param {BoundsRow} row
 */
function toolBounds(row) {
    const schema = schemaAt(row.tool, row.arg);
    const scale = row.scale ?? 1;
    return {
        min: (schema.minimum ?? -Infinity) * scale,
        max: (schema.maximum ?? Infinity) * scale,
        integer: schema.type === 'integer',
        /** @type {number[] | null} */
        values: schema.enum ? schema.enum.map((/** @type {number} */ v) => v * scale) : null,
    };
}

/**
 * The bounds the page enforces on a field: a select's options, a number
 * input's min and max, or what a text input takes - the blur validator clamps
 * it to its constraints, and the typing filter drops a minus sign unless they
 * allow negatives.
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @returns {Promise<{min: number, max: number, options: number[] | null} | null>}
 */
function fieldBounds(page, selector) {
    return page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        if (el instanceof HTMLSelectElement) {
            const values = [...el.options].map((o) => Number.parseFloat(o.value)).filter(Number.isFinite);
            return { min: Math.min(...values), max: Math.max(...values), options: values };
        }
        if (el instanceof HTMLInputElement && el.type === 'number') {
            const attr = (/** @type {string} */ value, /** @type {number} */ open) => (value === '' ? open : Number(value));
            return { min: attr(el.min, -Infinity), max: attr(el.max, Infinity), options: null };
        }
        const bound = (/** @type {string} */ name, /** @type {number} */ open) => {
            const value = getConstraint(el, name, null);
            return value === null || value === undefined ? open : value;
        };
        const min = getConstraint(el, 'allowNegative', false) ? bound('min', -Infinity) : Math.max(bound('min', -Infinity), 0);
        return { min, max: bound('max', Infinity), options: null };
    }, selector);
}

/**
 * The object whose `validate` checks a saved setting: options.prm on most
 * pages, `options` itself on the trade page.
 */
const defaultSettings = () => options.prm ?? options;

/**
 * Whether the settings' validate keeps each value as given rather than falling
 * back to the default.
 * @param {import('@playwright/test').JSHandle} settings
 * @param {string} prm
 * @param {number[]} values
 * @returns {Promise<boolean[]>}
 */
function validateAccepts(settings, prm, values) {
    return settings.evaluate((saved, [key, list]) => list.map((v) => Number(saved.validate(key, String(v))) === v), [prm, values]);
}

/**
 * The upper-bound rule: equal, or the page open-ended.
 * @param {number} tool
 * @param {number} pageMax
 */
const upperAgrees = (tool, pageMax) => tool === pageMax || pageMax === Infinity;

/**
 * Every row's tool bounds against the page's; all disagreements are reported
 * together, one line each.
 * @param {import('@playwright/test').Page} page
 * @param {BoundsRow[]} rows
 * @param {() => {validate: (key: string, value: string) => unknown}} [settingsOf]
 *   Run in the page: the object whose `validate` the rows' `prm` keys go to.
 */
export async function expectMcpBoundsMatchPage(page, rows, settingsOf = defaultSettings) {
    const settings = await page.evaluateHandle(settingsOf);
    const problems = [];
    for (const row of rows) {
        const tool = toolBounds(row);
        const name = `${row.tool} ${row.arg} / ${row.selector}`;
        const field = await fieldBounds(page, row.selector);
        if (!field) {
            problems.push(`${name}: no such field on the page`);
            continue;
        }
        if (tool.values) {
            const same = field.options && field.options.length === tool.values.length
                && tool.values.every((v) => field.options?.includes(v));
            if (!same) {
                problems.push(`${name}: tool takes ${tool.values.join(', ')}, field ${field.options?.join(', ') ?? 'is not a select'}`);
            }
            continue;
        }
        const agrees = field.options
            ? tool.min <= field.min && field.max <= tool.max
            : tool.min === field.min && upperAgrees(tool.max, field.max);
        if (!agrees) {
            problems.push(`${name}: tool ${tool.min}..${tool.max}, field ${field.min}..${field.max}`);
        }
        if (row.prm && field.options) {
            const kept = await validateAccepts(settings, row.prm, field.options);
            const lost = field.options.filter((_, i) => !kept[i]);
            if (lost.length > 0) {
                problems.push(`${name}: validate('${row.prm}') drops the options ${lost.join(', ')}`);
            }
        } else if (row.prm) {
            const step = tool.integer ? 1 : 0.001;
            const probes = [tool.min, tool.min - step, tool.max, tool.max + step, 1e15]
                .map((v) => (Number.isFinite(v) ? v : Math.sign(v) * 1e15));
            const [min, belowMin, max, aboveMax, huge] = await validateAccepts(settings, row.prm, probes);
            const savedMin = min && !belowMin;
            const savedMax = tool.max === Infinity ? huge : max && (!aboveMax || huge);
            if (!savedMin || !savedMax) {
                problems.push(`${name}: validate('${row.prm}') does not keep ${tool.min}..${tool.max} `
                    + `(min ${min}, below ${belowMin}, max ${max}, above ${aboveMax}, 1e15 ${huge})`);
            }
        }
    }
    expect(problems).toEqual([]);
}

/**
 * The planet's energy inputs, which the graviton and terraformer pages and
 * tools share field for field.
 * @param {string} tool
 * @returns {BoundsRow[]}
 */
export function energyRows(tool) {
    return [
        { tool, arg: 'maxTemperature', selector: '#max-planet-temp', prm: 'maxPlanetTemp' },
        { tool, arg: 'solarPlant.level', selector: '#solar-plant-level', prm: 'solarPlantLevel' },
        { tool, arg: 'solarPlant.percent', selector: '#solar-plant-percent', prm: 'solarPlantPercent' },
        { tool, arg: 'fusionReactor.level', selector: '#fusion-plant-level', prm: 'fusionPlantLevel' },
        { tool, arg: 'fusionReactor.percent', selector: '#fusion-plant-percent', prm: 'fusionPlantPercent' },
        { tool, arg: 'solarSatellites.count', selector: '#solar-satellites-count', prm: 'solarSatellitesCount' },
        { tool, arg: 'solarSatellites.percent', selector: '#solar-satellites-percent' },
        { tool, arg: 'energyTechnology', selector: '#energy-tech-level', prm: 'energyTechLevel' },
        // The page's booster select holds tenths: 2 is the 20% booster.
        { tool, arg: 'energyBoosterPercent', selector: '#energy-boost', prm: 'energyBoost', scale: 0.1 },
        { tool, arg: 'hyperspaceTechnology', selector: '#hyper-tech-level', prm: 'hyperTechLevel' },
        { tool, arg: 'lifeforms.energyBonus', selector: '#total-lf-energy-bonus', prm: 'totalLFEnrgBonus' },
        { tool, arg: 'lifeforms.disruptionChamber', selector: '#disr-chamber-level', prm: 'disChLevel' },
        { tool, arg: 'lifeforms.collectorClassBonus', selector: '#lf-collector-class-bonus', prm: 'collectorClassBonus' },
        { tool, arg: 'lifeforms.shipBonuses.small-cargo.cargo', selector: '#sc-capacity-increase', prm: 'scCapacityIncrease' },
        { tool, arg: 'lifeforms.shipBonuses.large-cargo.cargo', selector: '#lc-capacity-increase', prm: 'lcCapacityIncrease' },
        // The shipyard is left out: the tools share the facilities schema with
        // the cost tool, where level 0 is a real answer, while these pages need
        // a shipyard to build the satellites at all and start it at 1.
        { tool, arg: 'facilities.naniteFactory', selector: '#nanites-factory-level', prm: 'nanitesFactoryLevel' },
        { tool, arg: 'universeSpeed', selector: '#universe-speed', prm: 'universeSpeed' },
        { tool, arg: 'crystalAvailable', selector: '#crystal-available', prm: 'crysAvailable' },
        { tool, arg: 'deuteriumAvailable', selector: '#deuterium-available', prm: 'deutAvailable' },
    ];
}
