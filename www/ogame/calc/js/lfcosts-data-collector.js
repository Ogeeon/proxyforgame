// ============================================================================
// DATA COLLECTOR — DOM → data models
// ============================================================================

class LfDataCollector {
    /**
     * Read all calculator parameters from the DOM.
     * Returns a plain params object; also resolves playerClass from radio buttons.
     */
    collectParams() {
        let playerClass = 0;
        if (inputEl('#class-2').checked) {
            playerClass = 2;
        } else if (inputEl('#class-1').checked) {
            playerClass = 1;
        }
        return {
            robotFactoryLevel:    getInputNumber(document.getElementById('robot-factory-level')),
            naniteFactoryLevel:   getInputNumber(document.getElementById('nanite-factory-level')),
            universeSpeed:        selectEl('#universe-speed').value,
            ionTechLevel:         getInputNumber(document.getElementById('ion-tech-level')),
            hyperTechLevel:       getInputNumber(document.getElementById('hyper-tech-level')),
            fullNumbers:          inputEl('#full-numbers').checked,
            capIncrSC:            getInputNumber(document.getElementById('sc-capacity-increase')),
            capIncrLC:            getInputNumber(document.getElementById('lc-capacity-increase')),
            megalithLvl:          getInputNumber(document.getElementById('megalith-level')),
            mineralResCntrLvl:    getInputNumber(document.getElementById('mrc-level')),
            resCentreLvl:         getInputNumber(document.getElementById('research-centre-level')),
            runeTechLvl:          getInputNumber(document.getElementById('rune-tech-level')),
            rbtResCentreLvl:      getInputNumber(document.getElementById('rbt-res-centre-level')),
            vortexChamberLvl:     getInputNumber(document.getElementById('vortex-chamber-level')),
            researchCostReduction:getInputNumber(document.getElementById('research-cost-reduction')),
            researchTimeReduction:getInputNumber(document.getElementById('research-time-reduction')),
            race:                 Number(selectEl('#race-selector').value),
            researchRaceOneLevel: this.collectResearchRace(0),
            researchRaceMultLevel:this.collectResearchRace(1),
            playerClass,
            rates: [
                getInputNumber(document.getElementById('exchange-rates-m')) || 1,
                getInputNumber(document.getElementById('exchange-rates-c')) || 1.5,
                getInputNumber(document.getElementById('exchange-rates-d')) || 3,
            ],
        };
    }

    collectResearchRace(outerTab) {
        const sel = selectEl(`#research-race-dd-${outerTab}`);
        return sel ? Number(sel.value) : 1;
    }

    /**
     * Read available resource inputs for a given outer+inner tab combination.
     */
    collectAvailableResources(outerTab, innerTab) {
        return {
            metal:   getInputNumber(document.getElementById(`metal-available-${outerTab}-${innerTab}`)),
            crystal: getInputNumber(document.getElementById(`crystal-available-${outerTab}-${innerTab}`)),
            deut:    getInputNumber(document.getElementById(`deut-available-${outerTab}-${innerTab}`)),
        };
    }

    /**
     * Read the tech-select + level range inputs for Tab 3.
     */
    collectTab3Request() {
        return {
            techID:    Number(selectEl('#tech-types-select').value),
            levelFrom: getInputNumber(document.getElementById('tab2-from-level')),
            levelTo:   getInputNumber(document.getElementById('tab2-to-level')),
        };
    }
}

// ============================================================================
// CALCULATION-ERROR REPORT
// ============================================================================
//
// What the sidebar's report dialog attaches for this page (the contract is in
// www/js/report-context.js): the tabs the result was read on, and every field
// that feeds it next to its factory default - except the resources
// available, which the report leaves out by design. reportFieldById(),
// reportEntryOf() and cleanReportLabel() come from sidebar.js.

// The rows the renderer marks by their role rather than by an element.
const LF_REPORT_SUMMARY_ROWS = new Set(['total', 'grand-total', 'res-needed', 'transports']);

/**
 * A localized caption the template inlined for the report (options.reportText).
 * @param {string} key
 * @returns {string}
 */
function lfReportText(key) {
    return cleanReportLabel(options.reportText[key] ?? key);
}

/**
 * The caption of a tab button, '' for a missing one.
 * @param {string} id
 * @returns {string}
 */
function lfTabLabel(id) {
    return cleanReportLabel(document.getElementById(id)?.textContent ?? '');
}

/**
 * The sub-heading of a parameter tab's fields: "Parameters — Buildings",
 * because the result tabs have a "Buildings" of their own.
 * @param {string} id - the parameter tab button
 * @returns {string}
 */
function lfParamGroup(id) {
    return `${lfReportText('parameters')} — ${lfTabLabel(id)}`;
}

/**
 * An element's name as its table row shows it: the cell's own text, without
 * the remove button a research row carries.
 * @param {HTMLTableRowElement} row
 * @returns {string}
 */
function lfReportRowName(row) {
    const cell = row.cells[1];
    if (cell === undefined) {
        return '';
    }
    const text = Array.from(cell.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? '')
        .join('');
    return cleanReportLabel(text);
}

/**
 * The tabs the result is read on: the main tab, and its inner tab where it has
 * them.
 * @returns {ReportModePart[]}
 */
function lfReportMode() {
    /** @type {ReportModePart[]} */
    const mode = [];
    const outer = document.querySelector('#mainTabs .nav-link.active');
    if (outer === null) {
        return mode;
    }
    mode.push({ key: outer.id, label: lfTabLabel(outer.id) });
    const inner = document.querySelector(`#innerTabs${outer.id.replace('tabtag-', '')} .nav-link.active`);
    if (inner !== null) {
        mode.push({ key: inner.id, label: lfTabLabel(inner.id) });
    }
    return mode;
}

/**
 * The parameter panel: all four of its tabs, the hidden ones included. The
 * full-numbers switch only changes how the numbers are written, so it is not
 * listed.
 * @param {ReportEntry[]} out
 */
function lfReportParameters(out) {
    /** @param {ReportEntry|null} entry */
    const push = (entry) => {
        if (entry !== null) {
            out.push(entry);
        }
    };
    const buildings = lfParamGroup('param-buildings-tab');
    push(reportFieldById('robot-factory-level', buildings));
    push(reportFieldById('nanite-factory-level', buildings));
    const researches = lfParamGroup('param-researches-tab');
    push(reportFieldById('ion-tech-level', researches));
    push(reportFieldById('hyper-tech-level', researches));

    const common = lfParamGroup('param-common-tab');
    push(reportFieldById('universe-speed', common));
    push(reportFieldById('class', common));
    const rates = lfReportText('exchange-rates');
    push(reportFieldById('exchange-rates-m', common, { label: `${rates} — ${lfReportText('metal')}` }));
    push(reportFieldById('exchange-rates-c', common, { label: `${rates} — ${lfReportText('crystal')}` }));
    push(reportFieldById('exchange-rates-d', common, { label: `${rates} — ${lfReportText('deuterium')}` }));

    const lifeforms = lfParamGroup('param-lifeforms-tab');
    for (const id of ['race-selector', 'megalith-level', 'mrc-level', 'research-centre-level', 'rune-tech-level',
        'rbt-res-centre-level', 'vortex-chamber-level', 'research-cost-reduction', 'research-time-reduction']) {
        push(reportFieldById(id, lifeforms));
    }
    const cargo = lfReportText('cargo-cap-increase');
    push(reportFieldById('sc-capacity-increase', lifeforms, { label: `${cargo} — ${options.scFull}` }));
    push(reportFieldById('lc-capacity-increase', lifeforms, { label: `${cargo} — ${options.lcFull}` }));
}

/**
 * The element tables of one of the two "all items" tabs: both inner tables,
 * not only the open one, because the grand total adds them up.
 * @param {ReportEntry[]} out
 * @param {number} outerTab - 0 single level, 1 several levels
 */
function lfReportTables(out, outerTab) {
    const suffixes = outerTab === 1 ? ['from', 'to'] : ['level'];
    const captions = outerTab === 1 ? ['from-level', 'to-level'] : ['level'];
    for (const table of document.querySelectorAll(`#tab-${outerTab} table[id^="table-${outerTab}-"]`)) {
        const group = lfTabLabel(`tabtag-${outerTab}-${table.id.split('-')[2]}`);
        for (const row of table.querySelectorAll('tr[data-report-key]')) {
            if (!(row instanceof HTMLTableRowElement)) {
                continue;
            }
            const name = lfReportRowName(row);
            row.querySelectorAll('input').forEach((input, i) => {
                out.push(reportEntryOf(input, {
                    key: `${row.dataset.reportKey}.${suffixes[i] ?? i}`, group, numeric: true,
                    label: `${name} — ${lfReportText(captions[i] ?? 'level')}`,
                }));
            });
        }
    }
}

/**
 * The "one item, several levels" tab: the item and its range.
 * @param {ReportEntry[]} out
 * @param {string} group
 */
function lfReportRange(out, group) {
    const select = document.getElementById('tech-types-select');
    if (select instanceof HTMLSelectElement) {
        // The item is what the whole tab is about, so it is named even at its
        // default; the option's group ("Researches (Humans)") is its caption.
        const optgroup = select.selectedOptions[0]?.parentElement;
        const label = optgroup instanceof HTMLOptGroupElement ? cleanReportLabel(optgroup.label) : '';
        const entry = reportEntryOf(select, label === '' ? { group } : { group, label });
        delete entry.default;
        out.push(entry);
    }
    for (const id of ['tab2-from-level', 'tab2-to-level']) {
        const entry = reportFieldById(id, group);
        if (entry !== null) {
            out.push(entry);
        }
    }
}

/**
 * The report hook: the open tabs and every field the result there depends
 * on, defaults included.
 * @returns {ReportSnapshot}
 */
function lfReportSnapshot() {
    const mode = lfReportMode();
    /** @type {ReportEntry[]} */
    const entries = [];
    const outer = mode[0]?.key ?? '';
    if (outer === 'tabtag-0' || outer === 'tabtag-1') {
        lfReportTables(entries, outer === 'tabtag-0' ? 0 : 1);
    } else if (outer === 'tabtag-2') {
        lfReportRange(entries, mode[0].label);
    }
    lfReportParameters(entries);
    return { mode, entries };
}

/**
 * The caption of a result cell the renderer marked: "<row>, <column>", the
 * row being an element's name, a summary row or a level of the range tab.
 * @param {string} key - e.g. "grand-total.metal", "lf-high-performance-transformer.time", "level-3.points"
 * @returns {string}
 */
function lfDescribeCell(key) {
    const dot = key.lastIndexOf('.');
    if (dot < 0) {
        return '';
    }
    const rowKey = key.slice(0, dot);
    const column = lfReportText(key.slice(dot + 1));
    let row = LF_REPORT_SUMMARY_ROWS.has(rowKey) ? lfReportText(rowKey) : '';
    const level = /^level-(\d+)$/.exec(rowKey);
    if (level !== null) {
        row = `${lfReportText('level')} ${level[1]}`;
    } else if (row === '') {
        const tr = document.querySelector(`#mainTabContent tr[data-report-key="${CSS.escape(rowKey)}"]`);
        row = tr instanceof HTMLTableRowElement ? lfReportRowName(tr) : '';
    }
    return row === '' ? column : `${row}, ${column}`;
}

if (typeof window !== 'undefined') {
    globalThis.reportSnapshot = lfReportSnapshot;
    globalThis.describeCell = lfDescribeCell;
}
