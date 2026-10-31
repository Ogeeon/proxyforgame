// ============================================================================
// TRADE CALCULATOR - CORE
// ============================================================================
// Pure conversion maths for the resource trade calculator: the exchange rates,
// the destination amounts for every source/destination combination, and how
// many cargo ships each side of the deal needs. No DOM access here - the input
// arrives as a plain params object and the result goes back as a plain object
// the page formats.

'use strict';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Which resources a source or destination type covers, indexed by the number
 * its radio button carries: [metal, crystal, deuterium]. 0..2 are the single
 * resources, 3..5 the pairs.
 */
const TRADE_RES_TYPES = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0],
    [1, 0, 1],
    [0, 1, 1]
];

/** The range each exchange rate has to stay in to count as a fair trade. */
const TRADE_RATE_LIMITS = {
    md: { min: 1.8, max: 3 },
    cd: { min: 1,   max: 2 },
    mc: { min: 1.5, max: 2 }
};

/** Base hold of a Small Cargo and of a Large Cargo. */
const TRADE_SC_CAPACITY = 5000;
const TRADE_LC_CAPACITY = 25000;
/** The class number that is the Collector. */
const TRADE_CLASS_COLLECTOR = 0;

/** Decimals the metal:crystal rate is kept to. See tradeMcRate. */
const TRADE_MC_DECIMALS = 3;

/**
 * Which way the deal is worked out: from the amount sold to what it buys, or
 * from the amounts wanted to what has to be sold for them.
 */
const TRADE_DIR_FORWARD = 0;
const TRADE_DIR_REVERSE = 1;

/**
 * Decimals a reverse amount is cut to before it is rounded up, so that float
 * noise on an exact answer (4500.0000000001) does not cost a whole unit.
 */
const TRADE_REVERSE_PRECISION = 6;

// ============================================================================
// RATES
// ============================================================================

/**
 * The metal:crystal rate implied by the other two.
 *
 * The rounding is deliberate and observable: every destination amount is
 * derived from this rate, so keeping it at full precision would produce
 * numbers that do not match the rate the page displays. It is stored as a
 * number rather than the toFixed string it used to be - the page formats it
 * back to three decimals when it shows it.
 *
 * @param {number} md - metal:deuterium rate
 * @param {number} cd - crystal:deuterium rate
 * @returns {number}
 */
function tradeMcRate(md, cd) {
    return Number((md / cd).toFixed(TRADE_MC_DECIMALS));
}

/**
 * The rates a fresh form starts from: the middle of each fair-trade range.
 * @returns {{md: number, cd: number, mc: number}}
 */
function tradeDefaultRates() {
    const md = (TRADE_RATE_LIMITS.md.min + TRADE_RATE_LIMITS.md.max) / 2;
    const cd = (TRADE_RATE_LIMITS.cd.min + TRADE_RATE_LIMITS.cd.max) / 2;
    return { md, cd, mc: tradeMcRate(md, cd) };
}

// ============================================================================
// UI STATE
// ============================================================================

/**
 * Availability flags for the destination resource fields, given the source and
 * destination types. Starts from the resources the source already covers -
 * those can never be a destination - and, for a single-resource destination,
 * frees the one it selects among the rest.
 *
 * @param {number} srcType - source resource type, 0..5
 * @param {number} dstType - destination resource type, 0..2
 * @returns {number[]} e.g. [1,0,0]
 */
function getDstInputState(srcType, dstType) {
    let dstEnable = TRADE_RES_TYPES[srcType].slice(0);
    let cnt = 0;
    if (dstType < 2) {
        for (let d = 0; d < 3; d++) {
            if (dstEnable[d] == 0) {
                if (cnt != dstType) {
                    dstEnable[d] = 1;
                }
                cnt++;
            }
        }
    }
    return dstEnable;
}

// ============================================================================
// MIX, CARGO AND TOTALS
// ============================================================================

/**
 * How much of each destination resource one unit of the source buys, in the
 * order the mix controls address them - the same order TRADE_DST_RESOURCES in
 * trade.js spells out. Source pairs have no mix, so they fall in with
 * deuterium rather than getting a case of their own.
 *
 * @param {number} srcType - source resource type, 0..5
 * @param {{md: number, cd: number, mc: number}} rates - the exchange rates
 * @returns {{first: number, second: number}}
 */
function tradeMixRates(srcType, rates) {
    switch (srcType) {
        // metal buys crystal and deuterium
        case 0: return { first: 1 / rates.mc, second: 1 / rates.md };
        // crystal buys metal and deuterium
        case 1: return { first: rates.mc, second: 1 / rates.cd };
        // deuterium buys metal and crystal
        default: return { first: rates.md, second: rates.cd };
    }
}

/**
 * Mix mode 4 as a destination share: the player names the cut of what they are
 * *selling* that goes on the first destination resource ("half the deuterium
 * for metal, half for crystal"), and this converts it into the share of what
 * comes back, which is what every destination amount is derived from.
 *
 * @param {number} srcShare - percentage of the source spent on the first resource
 * @param {number} srcType - source resource type, 0..5
 * @param {{md: number, cd: number, mc: number}} rates - the exchange rates
 * @returns {number}
 */
function tradeSourceSharePercent(srcShare, srcType, rates) {
    const share = clampNumber(srcShare, 0, 100) / 100;
    const mixRates = tradeMixRates(srcType, rates);
    const first = share * mixRates.first;
    const second = (1 - share) * mixRates.second;
    return first + second === 0 ? 0 : first / (first + second) * 100;
}

/**
 * The share of the first destination resource, in percent, for the three mix
 * modes that express the split as one: a direct percentage (0), a proportion
 * (1), or a cut of the source (4). The fixed-amount modes (2, 3) name an
 * amount instead and do not use it.
 *
 * @param {{dstMixType: number, mixBalance: number, mixProp1: number,
 *          mixProp2: number, mixSrcBalance: number, srcType: number}} prm
 * @param {{md: number, cd: number, mc: number}} rates - the exchange rates
 * @returns {number}
 */
function tradeMixPercent(prm, rates) {
    switch (prm.dstMixType) {
        case 0:
            return prm.mixBalance;
        case 1:
            return clampNumber(prm.mixProp1 / (prm.mixProp1 + prm.mixProp2) * 100, 0, 100);
        case 4:
            return tradeSourceSharePercent(prm.mixSrcBalance, prm.srcType, rates);
        default:
            return 0;
    }
}

/**
 * Hold of one Small and one Large Cargo, with Hyperspace Technology, the
 * Collector class and the cargo capacity increase (see shipHold).
 *
 * @param {number} hyperTech - Hyperspace Technology level
 * @param {number} playerClass - player class, Collector is 0
 * @param {number} scIncrease - Small Cargo capacity increase, in percent
 * @param {number} lcIncrease - Large Cargo capacity increase, in percent
 * @returns {{sc: number, lc: number}}
 */
function tradeCargoCapacity(hyperTech, playerClass, scIncrease, lcIncrease) {
    const classBonus = playerClass === TRADE_CLASS_COLLECTOR ? HOLD_CLASS_BONUS.COLLECTOR : 0;
    return {
        sc: shipHold(TRADE_SC_CAPACITY, { hyperTechLevel: hyperTech, classBonus, lfBonus: scIncrease }),
        lc: shipHold(TRADE_LC_CAPACITY, { hyperTechLevel: hyperTech, classBonus, lfBonus: lcIncrease })
    };
}

/**
 * How many Small and Large Cargos a load of `amount` takes.
 * @param {number} amount - resources to move
 * @param {{sc: number, lc: number}} capacity - from tradeCargoCapacity
 * @returns {{sc: number, lc: number}}
 */
function tradeCargoCount(amount, capacity) {
    return {
        sc: Math.ceil(amount / capacity.sc),
        lc: Math.ceil(amount / capacity.lc)
    };
}

/**
 * The resources actually being sold, given the source type.
 * @param {number} srcType - source resource type, 0..5
 * @param {number} sm - metal offered
 * @param {number} sc - crystal offered
 * @param {number} sd - deuterium offered
 * @returns {number}
 */
function tradeSourceTotal(srcType, sm, sc, sd) {
    switch (srcType) {
        case 0: return sm;
        case 1: return sc;
        case 2: return sd;
        case 3: return sm + sc;
        case 4: return sm + sd;
        case 5: return sc + sd;
        default: return 0;
    }
}

// ============================================================================
// CALCULATION ENGINE
// ============================================================================

/**
 * How the destination side of the deal is split.
 * @typedef {object} TradeMix
 * @property {number} dstType - destination resource type, 0..2
 * @property {number} dstMixType - mix mode, 0..4, only read when dstType is 2
 * @property {number} p - share of the first destination resource, in percent
 * @property {number} fix1 - fixed amount of the first destination resource
 * @property {number} fix2 - fixed amount of the second destination resource
 */

/**
 * Everything one recalculation needs.
 * @typedef {object} TradeParams
 * @property {number} metal - metal offered
 * @property {number} crystal - crystal offered
 * @property {number} deuterium - deuterium offered
 * @property {number} srcType - source resource type, 0..5
 * @property {number} dstType - destination resource type, 0..2
 * @property {number} dstMixType - mix mode, 0..4
 * @property {number} mixBalance - the percentage of mix mode 0
 * @property {number} mixProp1 - first term of the proportion of mix mode 1
 * @property {number} mixProp2 - second term of the proportion of mix mode 1
 * @property {number} fix1 - fixed amount of mix mode 2
 * @property {number} fix2 - fixed amount of mix mode 3
 * @property {number} mixSrcBalance - the cut of the source of mix mode 4
 * @property {number} hyperTech - Hyperspace Technology level
 * @property {number} playerClass - player class, Collector is 0
 * @property {number} scCapacityIncrease - Small Cargo capacity increase, percent
 * @property {number} lcCapacityIncrease - Large Cargo capacity increase, percent
 */

/**
 * What a reverse calculation needs on top of the cargo settings: the amounts
 * wanted, and which of them the deal covers.
 * @typedef {object} TradeReverseParams
 * @property {number} srcType - source resource type, 0..2 - a pair has no single answer
 * @property {number} dstType - destination resource type, 0..2; 2 wants both
 * @property {number} wantMetal - metal wanted
 * @property {number} wantCrystal - crystal wanted
 * @property {number} wantDeuterium - deuterium wanted
 * @property {number} hyperTech - Hyperspace Technology level
 * @property {number} playerClass - player class, Collector is 0
 * @property {number} scCapacityIncrease - Small Cargo capacity increase, percent
 * @property {number} lcCapacityIncrease - Large Cargo capacity increase, percent
 */

class TradeCalculator {
    /**
     * @param {{md: number, cd: number, mc: number}} rates - the exchange rates
     */
    constructor(rates) {
        this.rates = rates;
    }

    /**
     * Each offered resource converted into each of the others at the current
     * rates. The keys read source-then-destination: `mc` is the crystal the
     * offered metal is worth.
     *
     * @param {number} sm - metal offered
     * @param {number} sc - crystal offered
     * @param {number} sd - deuterium offered
     */
    conversions(sm, sc, sd) {
        const r = this.rates;
        return {
            mc: sm / r.mc,
            md: sm / r.md,
            cm: sc * r.mc,
            cd: sc / r.cd,
            dm: sd * r.md,
            dc: sd * r.cd
        };
    }

    /**
     * Destination amounts when metal is what is being sold.
     * @param {ReturnType<TradeCalculator['conversions']>} dst - conversion table
     * @param {number} sm - metal offered
     * @param {TradeMix} mix - how the destination is split
     */
    _fromMetal(dst, sm, mix) {
        const r = this.rates;
        let dm = 0, dc = 0, dd = 0;
        switch (mix.dstType) {
            case 0: dc = dst.mc; break;
            case 1: dd = dst.md; break;
            case 2:
                switch (mix.dstMixType) {
                    case 0:
                    case 1:
                    case 4:
                        dc = dst.md / ((100 - mix.p) / mix.p + r.mc / r.md);
                        dd = dst.mc / (mix.p / (100 - mix.p) + r.md / r.mc);
                        break;
                    case 2:
                        dc = clampNumber(mix.fix1, 0, dst.mc);
                        dd = (sm - (dc * r.mc)) / r.md;
                        break;
                    case 3:
                        dd = clampNumber(mix.fix2, 0, dst.md);
                        dc = (sm - (dd * r.md)) / r.mc;
                        break;
                }
                break;
        }
        return { dm, dc, dd };
    }

    /**
     * Destination amounts when crystal is what is being sold.
     * @param {ReturnType<TradeCalculator['conversions']>} dst - conversion table
     * @param {number} sc - crystal offered
     * @param {TradeMix} mix - how the destination is split
     */
    _fromCrystal(dst, sc, mix) {
        const r = this.rates;
        let dm = 0, dc = 0, dd = 0;
        switch (mix.dstType) {
            case 0: dm = dst.cm; break;
            case 1: dd = dst.cd; break;
            case 2:
                switch (mix.dstMixType) {
                    case 0:
                    case 1:
                    case 4:
                        dm = dst.cd / ((100 - mix.p) / mix.p + 1 / (r.cd * r.mc));
                        dd = dst.cm / (mix.p / (100 - mix.p) + r.mc * r.cd);
                        break;
                    case 2:
                        dm = clampNumber(mix.fix1, 0, dst.cm);
                        dd = (sc - (dm / r.mc)) / r.cd;
                        break;
                    case 3:
                        dd = clampNumber(mix.fix2, 0, dst.cd);
                        dm = (sc - (dd * r.cd)) * r.mc;
                        break;
                }
                break;
        }
        return { dm, dc, dd };
    }

    /**
     * Destination amounts when deuterium is what is being sold.
     * @param {ReturnType<TradeCalculator['conversions']>} dst - conversion table
     * @param {number} sd - deuterium offered
     * @param {TradeMix} mix - how the destination is split
     */
    _fromDeuterium(dst, sd, mix) {
        const r = this.rates;
        let dm = 0, dc = 0, dd = 0;
        switch (mix.dstType) {
            case 0: dm = dst.dm; break;
            case 1: dc = dst.dc; break;
            case 2:
                switch (mix.dstMixType) {
                    case 0:
                    case 1:
                    case 4:
                        dm = dst.dc / ((100 - mix.p) / mix.p + r.cd / r.md);
                        dc = dst.dm / (mix.p / (100 - mix.p) + r.md / r.cd);
                        break;
                    case 2:
                        dm = clampNumber(mix.fix1, 0, dst.dm);
                        dc = (sd - (dm / r.md)) * r.cd;
                        break;
                    case 3:
                        dc = clampNumber(mix.fix2, 0, dst.dc);
                        dm = (sd - (dc / r.cd)) * r.md;
                        break;
                }
                break;
        }
        return { dm, dc, dd };
    }

    /**
     * The whole deal: what the offered resources buy, and how many cargo ships
     * each side of it takes. Amounts are rounded the way the page shows them,
     * and the destination cargo count is derived from the rounded amounts.
     *
     * @param {TradeParams} prm - the current form state
     */
    compute(prm) {
        const sm = prm.metal;
        const sc = prm.crystal;
        const sd = prm.deuterium;
        const dst = this.conversions(sm, sc, sd);

        /** @type {TradeMix} */
        const mix = {
            dstType: prm.dstType,
            dstMixType: prm.dstMixType,
            p: tradeMixPercent(prm, this.rates),
            fix1: prm.fix1,
            fix2: prm.fix2
        };

        let out = { dm: 0, dc: 0, dd: 0 };
        switch (prm.srcType) {
            case 0: out = this._fromMetal(dst, sm, mix); break;
            case 1: out = this._fromCrystal(dst, sc, mix); break;
            case 2: out = this._fromDeuterium(dst, sd, mix); break;
            // The pairs have a single possible destination: the third resource.
            case 3: out = { dm: 0, dc: 0, dd: dst.md + dst.cd }; break;
            case 4: out = { dm: 0, dc: dst.mc + dst.dc, dd: 0 }; break;
            case 5: out = { dm: dst.cm + dst.dm, dc: 0, dd: 0 }; break;
        }

        const dm = Math.round(out.dm);
        const dc = Math.round(out.dc);
        const dd = Math.round(out.dd);

        const capacity = tradeCargoCapacity(
            prm.hyperTech, prm.playerClass, prm.scCapacityIncrease, prm.lcCapacityIncrease);
        const srcTotal = tradeSourceTotal(prm.srcType, sm, sc, sd);
        const dstTotal = dm + dc + dd;

        return {
            sm, sc, sd,
            dm, dc, dd,
            srcTotal,
            dstTotal,
            capacity,
            srcCargo: tradeCargoCount(srcTotal, capacity),
            dstCargo: tradeCargoCount(dstTotal, capacity)
        };
    }

    /**
     * What one unit of each resource costs in the resource being sold.
     * @param {number} srcType - source resource type, 0..2
     * @returns {number[]} [metal, crystal, deuterium]; the source itself costs 0
     */
    _unitCosts(srcType) {
        const r = this.rates;
        switch (srcType) {
            case 0: return [0, r.mc, r.md];
            case 1: return [1 / r.mc, 0, r.cd];
            case 2: return [1 / r.md, 1 / r.cd, 0];
            default: return [0, 0, 0];
        }
    }

    /**
     * The deal worked out backwards: the amounts wanted are given, and the
     * answer is how much of the single source resource buys them. It is the
     * forward formula inverted, and it is rounded up - one unit short does not
     * buy the goods. Resources the destination type does not cover are left
     * out, whatever their fields hold.
     *
     * Returns the same shape as compute(), so the page renders either one.
     *
     * @param {TradeReverseParams} prm - the current form state
     */
    computeReverse(prm) {
        const covered = getDstInputState(prm.srcType, prm.dstType);
        const wanted = [prm.wantMetal, prm.wantCrystal, prm.wantDeuterium]
            .map((amount, i) => covered[i] === 0 ? Math.round(clampNumber(amount, 0, Infinity)) : 0);
        const costs = this._unitCosts(prm.srcType);
        const exact = wanted.reduce((sum, amount, i) => sum + amount * costs[i], 0);
        const sell = Math.ceil(Number(exact.toFixed(TRADE_REVERSE_PRECISION)));

        const sold = [0, 0, 0];
        if (prm.srcType >= 0 && prm.srcType <= 2) sold[prm.srcType] = sell;
        const [dm, dc, dd] = wanted;
        const [sm, sc, sd] = sold;

        const capacity = tradeCargoCapacity(
            prm.hyperTech, prm.playerClass, prm.scCapacityIncrease, prm.lcCapacityIncrease);
        const srcTotal = sm + sc + sd;
        const dstTotal = dm + dc + dd;

        return {
            sm, sc, sd,
            dm, dc, dd,
            srcTotal,
            dstTotal,
            capacity,
            srcCargo: tradeCargoCount(srcTotal, capacity),
            dstCargo: tradeCargoCount(dstTotal, capacity)
        };
    }
}

if (typeof window !== 'undefined') {
    Object.assign(window, {
        TradeCalculator,
        TRADE_RES_TYPES,
        TRADE_RATE_LIMITS,
        TRADE_SC_CAPACITY,
        TRADE_LC_CAPACITY,
        TRADE_CLASS_COLLECTOR,
        TRADE_MC_DECIMALS,
        TRADE_DIR_FORWARD,
        TRADE_DIR_REVERSE,
        TRADE_REVERSE_PRECISION,
        tradeMcRate,
        tradeDefaultRates,
        getDstInputState,
        tradeMixPercent,
        tradeMixRates,
        tradeSourceSharePercent,
        tradeCargoCapacity,
        tradeCargoCount,
        tradeSourceTotal
    });
}
