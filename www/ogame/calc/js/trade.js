// ============================================================================
// TRADE CALCULATOR - PAGE
// ============================================================================
// Persisted form state, rendering and event wiring. The conversion maths lives
// in trade-core.js; nothing here computes an exchange, it only collects the
// form, hands it to TradeCalculator and shows what comes back.

/**
 * Localised strings for this page. The template fills it in an inline <script>
 * that runs right after this file loads, so it starts out empty.
 * @type {Record<string, string>}
 */
let l = {};

/**
 * The two resources each single-resource source can be traded for. The pairs
 * (source types 3..5) can only buy the one resource they are missing, so they
 * list a single destination and show no mix controls at all.
 */
const TRADE_DST_RESOURCES = [
    ['crystal', 'deuterium'],   // selling metal
    ['metal', 'deuterium'],     // selling crystal
    ['metal', 'crystal'],       // selling deuterium
    ['deuterium'],              // selling metal + crystal
    ['crystal'],                // selling metal + deuterium
    ['metal']                   // selling crystal + deuterium
];

/**
 * The short form of each resource name, as the mix fields spell it.
 * @type {Record<string, string>}
 */
const TRADE_SHORT_LABELS = { metal: 'met', crystal: 'crys', deuterium: 'deut' };

/**
 * The rates a fresh form starts from: the middle of each fair-trade range.
 * @returns {{md: number, cd: number, mc: number}}
 */
function defaultRates() {
    const md = (TRADE_RATE_LIMITS.md.min + TRADE_RATE_LIMITS.md.max) / 2;
    const cd = (TRADE_RATE_LIMITS.cd.min + TRADE_RATE_LIMITS.cd.max) / 2;
    return { md, cd, mc: tradeMcRate(md, cd) };
}

let options = {
    metal: 0,
    crystal: 0,
    deuterium: 0,
    fix1: 0,
    fix2: 0,

    // mc is stored, not derived: saveToCookie JSON-encodes this object and
    // loadFromCookie replaces it with the parsed result, which would drop an
    // accessor. syncMcRate() is what keeps it in step with md and cd.
    rates: defaultRates(),

    srcType: 2,
    dstType: 2,
    dstMixType: 0,

    mixBalance: 50,
    mixProp1: 1,
    mixProp2: 1,

    country: 'en',
    universe: 101,
    coordg: 0,
    coords: 0,
    coordp: 0,
    moon: false,
    hyperTech: 0,
    playerClass: 0,
    scCapacityIncrease: 0,
    lcCapacityIncrease: 0,

    // Supplied by the template, never read from the cookie - see load().
    decimalSeparator: '.',

    validate: function(field, value) {
        switch (field) {
            case 'metal': return validateNumber(Number.parseInt(value), 0, Infinity, 0);
            case 'crystal': return validateNumber(Number.parseInt(value), 0, Infinity, 0);
            case 'deuterium': return validateNumber(Number.parseInt(value), 0, Infinity, 0);
            case 'srcType': return validateNumber(Number.parseInt(value), 0, 5, this.srcType);
            case 'dstType': return validateNumber(Number.parseInt(value), 0, 5, this.dstType);
            case 'dstMixType': return validateNumber(Number.parseInt(value), 0, 3, this.dstMixType);
            case 'mixBalance': return validateNumber(Number.parseFloat(value), 0, 100, this.mixBalance);
            case 'mixProp1': return validateNumber(Number.parseInt(value), 0, 100, this.mixProp1);
            case 'mixProp2': return validateNumber(Number.parseInt(value), 0, 100, this.mixProp2);
            case 'country': return value;
            case 'universe': return validateNumber(Number.parseInt(value), 0, Infinity, 101);
            case 'coordg': return validateNumber(Number.parseInt(value), 0, 12, this.coordg);
            case 'coords': return validateNumber(Number.parseInt(value), 0, 550, this.coords);
            case 'coordp': return validateNumber(Number.parseInt(value), 0, 15, this.coordp);
            case 'hyperTech': return validateNumber(Number.parseInt(value), 0, 50, this.hyperTech);
            case 'playerClass': return validateNumber(Number.parseInt(value), 0, 2, this.playerClass);
            case 'scCapacityIncrease': return validateNumber(Number.parseFloat(value), 0, Infinity, this.scCapacityIncrease);
            case 'lcCapacityIncrease': return validateNumber(Number.parseFloat(value), 0, Infinity, this.lcCapacityIncrease);
            case 'moon': return value === true || value === 'true';
            default: return value;
        }
    },

    load: function() {
        try {
            // decimalSeparator is a locale constant supplied by the template, not user data.
            // It must never be taken from the cookie: in locales where it is a comma it collides
            // with the comma record delimiter and round-trips to an empty string, which then breaks
            // both number input (no separator accepted) and display. Keep the template value.
            const ds = this.decimalSeparator;
            loadFromCookie('options_trade', options);
            this.decimalSeparator = ds || '.';
            // The cookie carries `rates` as JSON, so a corrupted entry can leave
            // anything at all here. Re-derive mc either way: an old cookie holds
            // it as the toFixed string it used to be.
            if (typeof this.rates !== 'object' || this.rates === null) {
                this.rates = defaultRates();
            }
            syncMcRate();
        } catch(e) {
            alert(e);
        }
    },

    save: function() {
        // Keep the locale separator out of the comma-delimited cookie (see load()).
        const ds = this.decimalSeparator;
        delete this.decimalSeparator;
        saveToCookie('options_trade', options);
        this.decimalSeparator = ds;
    },

    _parseUrlParams: function() {
        const url = globalThis.location.href.split("#");
        if (url.length <= 1) return null;

        const params = url[1].split('&');
        /** @type {Record<string, string>} */
        const prm = {};
        for (const ps of params) {
            const t = ps.split('=');
            if (t.length == 2) {
                prm[decodeURIComponent(t[0]).toLowerCase()] = decodeURIComponent(t[1]).toLowerCase();
            }
        }
        return prm;
    },

    _parseRatesFromParams: function(prm) {
        if (isset(prm['rmd'])) this.rates.md = validateNumber(Number.parseFloat(prm['rmd']), 1, 5, this.rates.md);
        if (isset(prm['rcd'])) this.rates.cd = validateNumber(Number.parseFloat(prm['rcd']), 1, 5, this.rates.cd);
        syncMcRate();
    },

    _parseTypesFromParams: function(prm) {
        if (isset(prm['st'])) this.srcType = validateNumber(Number.parseInt(prm['st']), 0, 5, this.srcType);
        if (isset(prm['dt'])) this.dstType = validateNumber(Number.parseInt(prm['dt']), 0, 5, this.dstType);
        if (isset(prm['dmt'])) this.dstMixType = validateNumber(Number.parseInt(prm['dmt']), 0, 3, this.dstMixType);
    },

    _parseMixFromParams: function(prm) {
        if (isset(prm['mix'])) this.mixBalance = validateNumber(Number.parseFloat(prm['mix']), 0, 100, this.mixBalance);

        if (isset(prm['mp1'])) {
            this.mixProp1 = validateNumber(Number.parseInt(prm['mp1']), 0, 100, this.mixProp1);
            setVal('#mix-balance-prop1', this.mixProp1 == 0 ? '' : this.mixProp1);
        }
        if (isset(prm['mp2'])) {
            this.mixProp2 = validateNumber(Number.parseInt(prm['mp2']), 0, 100, this.mixProp2);
            setVal('#mix-balance-prop2', this.mixProp2 == 0 ? '' : this.mixProp2);
        }
        if (isset(prm['fix1'])) {
            this.fix1 = validateNumber(Number.parseInt(prm['fix1']), 0, Infinity, this.fix1);
            setVal('#mix-fix1', this.fix1 == 0 ? '' : this.fix1);
        }
        if (isset(prm['fix2'])) {
            this.fix2 = validateNumber(Number.parseInt(prm['fix2']), 0, Infinity, this.fix2);
            setVal('#mix-fix2', this.fix2 == 0 ? '' : this.fix2);
        }
    },

    _parseResourcesFromParams: function(prm) {
        if (isset(prm['m'])) {
            const m = validateNumber(Number.parseInt(prm['m']), 0, Infinity, 0);
            setVal('#res-src-m', m == 0 ? '' : m);
        }
        if (isset(prm['c'])) {
            const c = validateNumber(Number.parseInt(prm['c']), 0, Infinity, 0);
            setVal('#res-src-c', c == 0 ? '' : c);
        }
        if (isset(prm['d'])) {
            const d = validateNumber(Number.parseInt(prm['d']), 0, Infinity, 0);
            setVal('#res-src-d', d == 0 ? '' : d);
        }
    },

    _parseLocationFromParams: function(prm) {
        if (isset(prm['l'])) {
            const m = prm['l'].split(':');
            if (m.length == 2) {
                this.country = checkCountryLang(m[0]);
                this.universe = validateNumber(Number.parseInt(m[1]), 0, Infinity, 101);
            }
        }

        if (isset(prm['lc'])) {
            const m = prm['lc'].split(':');
            if (m.length == 3) {
                this.coordg = validateNumber(Number.parseInt(m[0]), 0, 12, 0);
                this.coords = validateNumber(Number.parseInt(m[1]), 0, 550, 0);
                this.coordp = validateNumber(Number.parseInt(m[2]), 0, 15, 0);
            }
        }

        if (isset(prm['lm'])) {
            const lm = validateNumber(Number.parseInt(prm['lm']), 0, 1, 0);
            setChecked('#moon', lm !== 0);
            this.moon = lm !== 0;
        } else {
            this.moon = false;
        }
    },

    parseFromUri: function() {
        const prm = this._parseUrlParams();
        if (!prm) return;

        this._parseRatesFromParams(prm);
        this._parseTypesFromParams(prm);
        this._parseMixFromParams(prm);
        this._parseResourcesFromParams(prm);
        this._parseLocationFromParams(prm);
    },

    _buildMixTypeParams: function() {
        const mixTypeBuilders = {
            0: () => '&mix=' + this.mixBalance,
            1: () => '&mp1=' + this.mixProp1 + '&mp2=' + this.mixProp2,
            2: () => this.fix1 ? '&fix1=' + this.fix1 : '',
            3: () => this.fix2 ? '&fix2=' + this.fix2 : ''
        };
        const builder = mixTypeBuilders[this.dstMixType];
        return builder ? builder() : '';
    },

    _buildResourceParams: function() {
        const resources = [
            { index: 0, value: this.metal, param: 'm' },
            { index: 1, value: this.crystal, param: 'c' },
            { index: 2, value: this.deuterium, param: 'd' }
        ];
        return resources
            .filter(r => TRADE_RES_TYPES[this.srcType][r.index] === 1 && r.value)
            .map(r => '&' + r.param + '=' + r.value)
            .join('');
    },

    _buildCoordinateParams: function() {
        if (!this.coordg || !this.coords || !this.coordp) return '';
        const moonParam = this.moon ? '&lm=1' : '&lm=0';
        return '&lc=' + this.coordg + ':' + this.coords + ':' + this.coordp + moonParam;
    },

    makeUri: function() {
        const loc = globalThis.location;
        const baseUrl = loc.protocol + '//' + loc.host + loc.pathname + loc.search;
        const rateParams = '#rmd=' + this.rates.md + '&rcd=' + this.rates.cd;
        const typeParams = '&st=' + this.srcType + '&dt=' + this.dstType;

        let url = baseUrl + rateParams + typeParams;

        if (this.dstType === 2) {
            url += '&dmt=' + this.dstMixType + this._buildMixTypeParams();
        }

        url += this._buildResourceParams();
        url += '&l=' + this.country + ':' + this.universe;
        url += this._buildCoordinateParams();

        return url;
    },

    makeString: function(dm, dc, dd) {
        const parts = [
            this._formatSourceResources(),
            '. ',
            this._formatDestinationResources(dm, dc, dd),
            l.rates + ' ' + options.rates.md + ':' + options.rates.cd + ':1. ',
            this._formatCoordinates()
        ];
        return parts.join('');
    },

    _addResourceIfNeeded: function(resources, typeIndex, value, label) {
        if (TRADE_RES_TYPES[this.srcType][typeIndex] === 1 && value) {
            resources.push(numToOGame(value) + ' ' + label);
        }
    },

    _formatSourceResources: function() {
        const resources = [];
        this._addResourceIfNeeded(resources, 0, this.metal, l.met);
        this._addResourceIfNeeded(resources, 1, this.crystal, l.crys);
        this._addResourceIfNeeded(resources, 2, this.deuterium, l.deut);
        return l.src + ' ' + resources.join(' ' + l.and + ' ');
    },

    _formatDestinationResources: function(dm, dc, dd) {
        if (!dm && !dc && !dd) return '';

        const resources = [];
        if (dm) resources.push(numToOGame(dm) + ' ' + l.met);
        if (dc) resources.push(numToOGame(dc) + ' ' + l.crys);
        if (dd) resources.push(numToOGame(dd) + ' ' + l.deut);
        return l.dst + ' ' + resources.join(' ' + l.and + ' ') + '. ';
    },

    _formatCoordinates: function() {
        if (!this.coordg || !this.coords || !this.coordp) return '';

        const serverText = $('#country option:checked').textContent;
        const uniText = $('#universe option:checked').textContent;
        const server = /\(([^)]{1,64})\)/.exec(serverText)[1];
        const uni = /^(.+) \(/.exec(uniText)[1];

        const coords = '[' + this.coordg + ':' + this.coords + ':' + this.coordp + ']';
        const moonPart = this.moon ? ', ' + l.moonstr : '';
        return l.coords + ' ' + coords + moonPart + ' (' + uni + ', ' + server + ')';
    }
};

// ============================================================================
// EXCHANGE RATES
// ============================================================================

/** Re-derives the metal:crystal rate after md or cd changed. */
function syncMcRate() {
    options.rates.mc = tradeMcRate(options.rates.md, options.rates.cd);
}

/** Shows the derived metal:crystal rate in the two controls that carry it. */
function renderMcRate() {
    setTextContent('#rate-mc', options.rates.mc.toFixed(TRADE_MC_DECIMALS));
    setVal('#mc-slider', options.rates.mc);
}

/**
 * Shared tail of every control that edits an exchange rate.
 *
 * The edited control echoes its own new value into its counterpart (field into
 * slider, or the other way round) before calling this: writing it back into the
 * field being typed in would swallow a half-entered "2.".
 */
function applyRateChange() {
    syncMcRate();
    renderMcRate();
    updateNumbers();
    validateRateLimits();
    options.save();
}

/**
 * Checks whether the exchange rates are within the allowed limits, and if not - highlights the input in red.
 */
function validateRateLimits() {
    const inLimits = (value, limits) => value >= limits.min && value <= limits.max;
    toggleClass('#rate-md', 'ui-state-error', !inLimits(options.rates.md, TRADE_RATE_LIMITS.md));
    toggleClass('#rate-cd', 'ui-state-error', !inLimits(options.rates.cd, TRADE_RATE_LIMITS.cd));
    toggleClass('#rate-mc', 'ui-state-error', !inLimits(options.rates.mc, TRADE_RATE_LIMITS.mc));
}

// ============================================================================
// UNIVERSE LIST
// ============================================================================

/**
 * Fills select#universe with the list of universes for the given country and sets the current item in it.
 * @param lang country language: 'ru', 'en', ...
 * @param uni current universe: 1,2,3,..101,102,...
 */
function setUniList(lang, uni) {
    const universeEl = selectEl('#universe');
    universeEl.innerHTML = '';
    let ulist = unis[lang] || [];

    // check whether such a universe exists in the given country. if not, reset to the start of the list
    let fu = false;
    for (const item of ulist) {
        if (item[0] == uni) {
            fu = true;
            break;
        }
    }
    if (!fu) {
        options.universe = uni = 101;
        options.save();
    }

    for (const item of ulist) {
        const option = document.createElement('option');
        option.value = item[0];
        option.textContent = item[2] + ' (' + item[1] + ')';
        universeEl.appendChild(option);
    }
    universeEl.value = uni;
}

/**
 * Returns the language specified in the url. If the language cannot be recognized from the url, the default is returned.
 */
function getUrlLang() {
    let um = /^\/(\w\w)\//.exec(globalThis.location.pathname);
    return um ? um[1] : 'en';
}

/**
 * Validates the country language against the #country list. If such a language is not found, the default is used.
 */
function checkCountryLang(lang) {
    for (const option of selectEl('#country').options) {
        if (option.value === lang) return lang;
    }
    return getUrlLang();
}

// ============================================================================
// RESOURCE TYPE SWITCHES
// ============================================================================

/**
 * Handles a change of the srcType switch.
 */
function onUpdateSrcType() {
    setChecked('#res-src-' + options.srcType, true);
    updateSrcInputState(TRADE_RES_TYPES[options.srcType]);
    updateDstFromSrc();
    onUpdateDstType();
}

/**
 * Handles a change of the dstType switch.
 */
function onUpdateDstType() {
    // additional guard
    if (options.srcType > 2) {
        options.dstType = 0;
    }
    setChecked('#res-dst-' + options.dstType, true);
    updateDstInputState(getDstInputState(options.srcType, options.dstType));
    onUpdateDstMixType();
}

/**
 * Handles a change of the dstMixType switch, taking the dstType switch state into account.
 */
function onUpdateDstMixType() {
    if (options.dstType == 2) {
        setChecked('#res-dst-mix-' + options.dstMixType, true);
    } else {
        for (const radio of inputsAll('#dst-mix-block input[type="radio"]')) {
            radio.checked = false;
        }
    }
    updateNumbers();
    options.save();
}

/**
 * Forcibly sets dstType to position 2 (mix).
 * @return true if a state change occurred and dependent data needs to be updated
 */
function forceDstMix() {
    if (options.dstType == 2) {
        return false;
    } else {
        options.dstType = 2;
        return true;
    }
}

/**
 * Activates a specific mix type depending on the active input field obj.
 * @param {HTMLElement} obj - the mix field that just took focus
 */
function activateDstMixType(obj) {
    let ids = [
        ['mix-balance-proc', 0],
        ['mix-balance-prop1', 1],
        ['mix-balance-prop2', 1],
        ['mix-fix1', 2],
        ['mix-fix2', 3]
    ];
    let type = -1;
    for (const [id, value] of ids) {
        if (obj.id == id) {
            type = Number(value);
            break;
        }
    }
    if (type >= 0 && (options.dstType != 2 || options.dstMixType != type)) {
        options.dstMixType = type;
        if (forceDstMix()) {
            onUpdateDstType();
        }
        else {
            onUpdateDstMixType();
        }
    }
}

/**
 * Sets the availability state for a single resource class.
 * @param className element class name
 * @param panelSelector panel selector
 * @param enabled availability flag
 */
function updateResourceState(className, panelSelector, enabled) {
    const elems = $$(panelSelector + ' .' + className);
    const inputs = inputsAll('input.' + className);
    if (enabled) {
        for (const el of elems) el.classList.remove('ui-state-disabled');
        for (const inp of inputs) inp.removeAttribute('disabled');
    } else {
        for (const el of elems) el.classList.add('ui-state-disabled');
        for (const inp of inputs) inp.disabled = true;
    }
}

/**
 * Sets the availability of the source resource fields.
 * @param resEnable availability array for the resource input fields: e.g. [1,0,0]
 */
function updateSrcInputState(resEnable) {
    const classNames = ['res-src-m', 'res-src-c', 'res-src-d'];
    for (let i = 0; i < 3; i++) {
        updateResourceState(classNames[i], '#res-src-panel', resEnable[i] == 1);
    }
}

/**
 * Updates the availability and labels of the destination resource type switches depending on the source resource type switch state.
 * For a single source resource all three destination options are available; for a mix, only one destination is available.
 */
function updateDstFromSrc() {
    // limit the possible dstType values
    if (options.srcType > 2) {
        options.dstType = 0;
    }
    // update the resource type labels
    const [first, second] = TRADE_DST_RESOURCES[options.srcType];
    setTextContent('#res-type-dst-lbl-0', l[first]);
    if (second) {
        const shortFirst = l[TRADE_SHORT_LABELS[first]];
        const shortSecond = l[TRADE_SHORT_LABELS[second]];
        setTextContent('#res-type-dst-lbl-1', l[second]);
        setTextContent('#res-type-dst-lbl-2', l[first] + ' + ' + l[second]);
        setTextContent('#mix-lbl', shortFirst);
        setTextContent('#mix-prop-lbl', shortFirst + ' / ' + shortSecond);
        setTextContent('#mix-fix1-lbl', l.fix + '. ' + shortFirst);
        setTextContent('#mix-fix2-lbl', l.fix + '. ' + shortSecond);
    }
    $('#dst-block').style.visibility = options.srcType < 3 ? 'visible' : 'hidden';
}

/**
 * Sets the availability of the destination resource fields.
 * @param resEnable availability array for the resource input fields: e.g. [1,0,0]
 */
function updateDstInputState(resEnable) {
    let classNames = ['res-dst-m', 'res-dst-c', 'res-dst-d'];
    for (let i = 0; i < 3; i++) {
        let elems = $$('#res-dst-panel .' + classNames[i]);
        if (resEnable[i] == 0) {
            for (const el of elems) el.classList.remove('ui-state-disabled');
        } else {
            for (const el of elems) el.classList.add('ui-state-disabled');
        }
    }
}

function resetParams() {
    options.rates = defaultRates();
    options.srcType = 2;
    options.dstType = 2;
    options.dstMixType = 0;
    options.mixBalance = 50;
    options.mixProp1 = 1;
    options.mixProp2 = 1;
    options.fix1 = 0;
    options.fix2 = 0;
    options.hyperTech = 0;
    options.playerClass = 0;
    options.scCapacityIncrease = 0;
    options.lcCapacityIncrease = 0;
    options.moon = false;

    setVal('#res-src-m', '');
    setVal('#res-src-c', '');
    setVal('#res-src-d', '');
    setVal('#rate-md', options.rates.md);
    setVal('#rate-cd', options.rates.cd);
    setVal('#md-slider', options.rates.md);
    setVal('#cd-slider', options.rates.cd);
    renderMcRate();
    setVal('#mix-balance-proc', options.mixBalance);
    setVal('#mix-balance-prop1', options.mixProp1);
    setVal('#mix-balance-prop2', options.mixProp2);
    setVal('#mix-balance', options.mixBalance);
    setVal('#mix-fix1', '');
    setVal('#mix-fix2', '');
    setVal('#hypertech-lvl', 0);
    setChecked('#player-class-0', true);
    setVal('#sc-capacity-increase', 0);
    setVal('#lc-capacity-increase', 0);
    setChecked('#moon', false);
    onUpdateSrcType();
    validateRateLimits();
    options.save();
}

// ============================================================================
// COLLECT AND RENDER
// ============================================================================

/**
 * Reads every field the calculation depends on into the options model. The
 * radios and switches write themselves as they change; these are the free-text
 * fields, which are only read when a recalculation happens.
 */
function collectInputs() {
    options.metal = clampNumber(getInputNumber(inputEl('#res-src-m')), 0, Infinity);
    options.crystal = clampNumber(getInputNumber(inputEl('#res-src-c')), 0, Infinity);
    options.deuterium = clampNumber(getInputNumber(inputEl('#res-src-d')), 0, Infinity);

    options.fix1 = getInputNumber(inputEl('#mix-fix1'));
    options.fix2 = getInputNumber(inputEl('#mix-fix2'));

    options.hyperTech = clampNumber(getInputNumber(inputEl('#hypertech-lvl')), 0, Infinity);
    const checkedClass = checkedRadio('player-class');
    options.playerClass = checkedClass ? Number.parseInt(checkedClass.value) : 0;
    options.scCapacityIncrease = clampNumber(getInputNumber(inputEl('#sc-capacity-increase')), 0, Infinity);
    options.lcCapacityIncrease = clampNumber(getInputNumber(inputEl('#lc-capacity-increase')), 0, Infinity);
}

/**
 * "16 SC / 4 LC" - how many of each cargo ship a load takes.
 * @param {{sc: number, lc: number}} cargo - from TradeCalculator
 */
function formatCargo(cargo) {
    return numToOGame(cargo.sc) + ' ' + l.sc + ' / ' + numToOGame(cargo.lc) + ' ' + l.lc;
}

/**
 * The shareable link and its plain-text and BB-code forms. Cleared while
 * nothing is being offered, since there is no deal to describe yet.
 * @param {ReturnType<TradeCalculator['compute']>} result - the computed deal
 */
function renderShareLinks(result) {
    const alink = /** @type {HTMLAnchorElement} */ ($('#alink'));
    if (!options.metal && !options.crystal && !options.deuterium) {
        alink.href = '';
        alink.textContent = '';
        setTextContent('#atext', '');
        setTextContent('#abbcode', '');
        return;
    }

    const uri = options.makeUri();
    const txt = options.makeString(result.dm, result.dc, result.dd);
    alink.href = uri;
    alink.textContent = uri;
    setTextContent('#atext', txt);
    setTimeout(function() { setTextContent('#abbcode', '[url=' + uri + ']' + txt + '[/url]'); }, 200);
}

/**
 * Shows one computed deal.
 * @param {ReturnType<TradeCalculator['compute']>} result - the computed deal
 */
function renderResults(result) {
    setTextContent('#res-dst-m', numToOGame(result.dm));
    setTextContent('#res-dst-c', numToOGame(result.dc));
    setTextContent('#res-dst-d', numToOGame(result.dd));
    setTextContent('#res-src-cargo', formatCargo(result.srcCargo));
    setTextContent('#res-dst-cargo', formatCargo(result.dstCargo));
    renderShareLinks(result);
}

/**
 * Recalculates the resource values according to the settings in the model.
 */
function updateNumbers() {
    collectInputs();
    renderResults(new TradeCalculator(options.rates).compute(options));
    options.save();
}

// ============================================================================
// WIRING
// ============================================================================

/** Sets up the three rate sliders and the mix balance slider. */
function initSliders() {
    const mdSlider = inputEl('#md-slider');
    mdSlider.min = String(TRADE_RATE_LIMITS.md.min);
    mdSlider.max = String(TRADE_RATE_LIMITS.md.max);
    mdSlider.step = '0.05';
    mdSlider.value = String(options.rates.md);
    addEvent(mdSlider, 'input', function() {
        options.rates.md = Number.parseFloat(mdSlider.value);
        setVal('#rate-md', options.rates.md);
        applyRateChange();
    });

    const cdSlider = inputEl('#cd-slider');
    cdSlider.min = String(TRADE_RATE_LIMITS.cd.min);
    cdSlider.max = String(TRADE_RATE_LIMITS.cd.max);
    cdSlider.step = '0.05';
    cdSlider.value = String(options.rates.cd);
    addEvent(cdSlider, 'input', function() {
        options.rates.cd = Number.parseFloat(cdSlider.value);
        setVal('#rate-cd', options.rates.cd);
        applyRateChange();
    });

    // Derived from the other two, so it only ever displays.
    const mcSlider = inputEl('#mc-slider');
    mcSlider.min = String(TRADE_RATE_LIMITS.mc.min);
    mcSlider.max = String(TRADE_RATE_LIMITS.mc.max);
    mcSlider.step = '0.05';
    mcSlider.value = String(options.rates.mc);
    mcSlider.disabled = true;

    const mixBalanceSlider = inputEl('#mix-balance');
    mixBalanceSlider.min = '0';
    mixBalanceSlider.max = '100';
    mixBalanceSlider.step = '5';
    mixBalanceSlider.value = String(options.mixBalance);
    addEvent(mixBalanceSlider, 'input', function() {
        options.mixBalance = Number.parseFloat(mixBalanceSlider.value);
        setVal('#mix-balance-proc', options.mixBalance);
        if (options.dstType != 2 || options.dstMixType != 0) {
            options.dstMixType = 0;
            if (forceDstMix()) onUpdateDstType(); else onUpdateDstMixType();
        }
        updateNumbers();
        options.save();
    });
}

/** Puts the loaded options into the form. */
function renderInitialState() {
    setVal('#hypertech-lvl', options.hyperTech);
    setChecked('#player-class-' + options.playerClass, true);
    inputEl('#sc-capacity-increase')._constrains = { min: 0, def: 0, allowFloat: true, allowNegative: false };
    inputEl('#lc-capacity-increase')._constrains = { min: 0, def: 0, allowFloat: true, allowNegative: false };
    setNumVal('#sc-capacity-increase', options.scCapacityIncrease);
    setNumVal('#lc-capacity-increase', options.lcCapacityIncrease);
    setVal('#country', options.country);
    setUniList(options.country, options.universe);

    setTextContent('#rate-md-min', TRADE_RATE_LIMITS.md.min.toFixed(1));
    setTextContent('#rate-md-max', TRADE_RATE_LIMITS.md.max.toFixed(1));
    setTextContent('#rate-cd-min', TRADE_RATE_LIMITS.cd.min.toFixed(1));
    setTextContent('#rate-cd-max', TRADE_RATE_LIMITS.cd.max.toFixed(1));
    setTextContent('#rate-mc-min', TRADE_RATE_LIMITS.mc.min.toFixed(1));
    setTextContent('#rate-mc-max', TRADE_RATE_LIMITS.mc.max.toFixed(1));
    setVal('#rate-md', options.rates.md);
    setVal('#rate-cd', options.rates.cd);
    renderMcRate();
    setVal('#mix-balance-proc', options.mixBalance);
    setVal('#mix-balance-prop1', options.mixProp1);
    setVal('#mix-balance-prop2', options.mixProp2);
    setVal('#coord-g', options.coordg ? options.coordg : '');
    setVal('#coord-s', options.coords ? options.coords : '');
    setVal('#coord-p', options.coordp ? options.coordp : '');
    setChecked('#moon', options.moon);
}

/** The six preset exchange rates above the sliders. */
function initRateButtons() {
    const presets = [[4, 2], [3, 2], [3, 1.5], [2.5, 1.5], [2, 1.5], [2.4, 1.5]];
    presets.forEach(([md, cd], i) => {
        addEvent('#rate-btn-' + (i + 1), 'click', function() {
            options.rates.md = md;
            options.rates.cd = cd;
            setVal('#rate-md', md);
            setVal('#rate-cd', cd);
            setVal('#md-slider', md);
            setVal('#cd-slider', cd);
            applyRateChange();
        });
    });
}

/** The source/destination/mix type radios. */
function initTypeRadios() {
    for (const radio of inputsAll('#res-src input[type="radio"]')) {
        addEvent(radio, 'change', function() {
            options.srcType = Number.parseInt(radio.value);
            onUpdateSrcType();
        });
    }
    for (const radio of inputsAll('#res-dst input[name="dst"]')) {
        addEvent(radio, 'change', function() {
            options.dstType = Number.parseInt(radio.value);
            onUpdateDstType();
        });
    }
    for (const radio of inputsAll('#dst-mix-block input[type="radio"]')) {
        addEvent(radio, 'change', function() {
            options.dstMixType = Number.parseInt(radio.value);
            if (forceDstMix()) onUpdateDstType(); else onUpdateDstMixType();
        });
    }
    for (const radio of inputsAll('input[name="player-class"]')) {
        addEvent(radio, 'change', function() {
            options.playerClass = Number.parseInt(radio.value);
            updateNumbers();
            options.save();
        });
    }
}

/** The mix percentage, proportion and fixed-amount fields. */
function initMixInputs() {
    addEvent('#mix-balance-proc', 'keyup', function() {
        const n = clampNumber(getInputNumber(inputEl('#mix-balance-proc')), 0, 100);
        setVal('#mix-balance', n);
        options.mixBalance = n;
        options.save();
    });
    addEvent('#mix-balance-prop1', 'keyup', function() {
        options.mixProp1 = clampNumber(getInputNumber(inputEl('#mix-balance-prop1')), 0, 100);
        options.save();
    });
    addEvent('#mix-balance-prop2', 'keyup', function() {
        options.mixProp2 = clampNumber(getInputNumber(inputEl('#mix-balance-prop2')), 0, 100);
        options.save();
    });
    for (const input of inputsAll('#dst-mix-block input[type="text"]')) {
        addEvent(input, 'keyup', updateNumbers);
        addEvent(input, 'focusin', function() { activateDstMixType(input); });
    }
}

/** The exchange rate fields, the coordinates and the cargo capacity fields. */
function initTextInputs() {
    for (const input of inputsAll('#res-src-panel input[type="text"]')) {
        addEvent(input, 'keyup', updateNumbers);
    }

    addEvent('#rate-md', 'keyup', function() {
        options.rates.md = clampNumber(getInputNumber(inputEl('#rate-md')), 1, 5);
        setVal('#md-slider', options.rates.md);
        applyRateChange();
    });
    addEvent('#rate-cd', 'keyup', function() {
        options.rates.cd = clampNumber(getInputNumber(inputEl('#rate-cd')), 1, 5);
        setVal('#cd-slider', options.rates.cd);
        applyRateChange();
    });

    addEvent('#coord-g', 'keyup', function() {
        options.coordg = clampNumber(getInputNumber(inputEl('#coord-g')), 0, 12);
        updateNumbers();
        options.save();
    });
    addEvent('#coord-s', 'keyup', function() {
        options.coords = clampNumber(getInputNumber(inputEl('#coord-s')), 0, 550);
        updateNumbers();
        options.save();
    });
    addEvent('#coord-p', 'keyup', function() {
        options.coordp = clampNumber(getInputNumber(inputEl('#coord-p')), 0, 15);
        updateNumbers();
        options.save();
    });

    for (const id of ['#hypertech-lvl', '#sc-capacity-increase', '#lc-capacity-increase']) {
        const input = inputEl(id);
        addEvent(input, 'keyup', function() {
            validateInputNumber({ currentTarget: input, data: 'updateNumbers' });
        });
    }
}

/** Repopulates the universe list for the newly picked country. */
function onCountryChange() {
    options.country = selectEl('#country').value;
    setUniList(options.country, options.universe);
    updateNumbers();
    options.save();
}

/** Records the newly picked universe. */
function onUniverseChange() {
    options.universe = Number.parseInt(selectEl('#universe').value);
    updateNumbers();
    options.save();
}

/** The country/universe selects and the moon checkbox. */
function initLocationInputs() {
    // Both selects are bound twice: `change` for the mouse, `keyup` for the
    // arrow keys, which move the selection without firing `change` everywhere.
    addEvent('#country', 'change', onCountryChange);
    addEvent('#country', 'keyup', onCountryChange);
    addEvent('#universe', 'change', onUniverseChange);
    addEvent('#universe', 'keyup', onUniverseChange);

    addEvent('#moon', 'click', function() {
        options.moon = getChecked('#moon');
        updateNumbers();
        options.save();
    });
}

document.addEventListener('DOMContentLoaded', function() {
try {
    options.load();
    options.parseFromUri();

    initSliders();
    renderInitialState();

    for (const input of inputsAll('input')) {
        addEvent(input, 'focusin', function() { input.classList.add('ui-state-focus'); });
        addEvent(input, 'focusout', function() { input.classList.remove('ui-state-focus'); });
    }

    addEvent('#reset_bs', 'click', resetParams);
    initRateButtons();
    validateRateLimits();
    initTypeRadios();
    initMixInputs();
    initTextInputs();
    initLocationInputs();

    let theme = { value: 'light', validate: function(key, val) { return val; } };
    loadFromCookie('theme', theme);
    toggleLightBS(theme.value === 'light');
    const cbLightTheme = inputEl('#cb-light-theme');
    if (cbLightTheme) {
        addEvent(cbLightTheme, 'click', function() { toggleLightBS(cbLightTheme.checked); });
    }

    onUpdateSrcType();
} catch (e) {
    alert('Exception: ' + e);
}
});
