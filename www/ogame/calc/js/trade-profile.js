// ============================================================================
// TRADE CALCULATOR - PLAYER PROFILE BINDING
// ============================================================================
// Connects the trade calculator to the active player profile (ADR-0004).
// Trade keeps its settings in the flat `options` object; this file projects
// the profile into it and writes the changes back:
//   - apply(): profile -> options (hyperspace technology, class, the cargo
//     bonuses of the small and large transporter, the exchange rates) and the
//     profile's universe into the universe picker, locked;
//   - sync(): options -> profile, called from options.save(), writing only
//     what changed since the last apply or sync, so a lossy mapping (a profile
//     with no class shows as collector here) never becomes an override.
// The exchange rates are shared with production, which keeps them as
// [metal, crystal, deuterium] in metal units; they carry no game layer, so
// they are bound but never marked.
// Everything else - resources, deal types, the mix, the coordinates - is the
// calculator's own and keeps going to options_trade. The profile-owned keys
// are written there with the values they had before the profile, so "no
// profile" shows them untouched.
// #pf-body is a convenience that reads the profile without binding: it copies
// a planet's or moon's coordinates into the location fields.
// A deal link opened with a profile active wins over it, once: the rates, the
// universe and the coordinates it carries stay shown, and nothing from it is
// written into the profile until the player edits a value.

'use strict';

/**
 * What a link brought, as options.parseFromUri() reports it.
 *
 * @typedef {{rates: boolean, universe: boolean, coords: boolean}} TradeLinkOverrides
 */

/** @type {TradeLinkOverrides} */
const TRADE_NO_LINK = { rates: false, universe: false, coords: false };

/**
 * A rate rounded to four digits: the profile keeps the rates as ratios to
 * metal, and dividing them back gives 1.4999999999999998 for 1.5.
 *
 * @param {number} x
 * @returns {number}
 */
function tradeRoundRate(x) {
  return Math.round(x * 1e4) / 1e4;
}

/** @type {ProfileConvField[]} */
const TRADE_ACCOUNT_FIELDS = [
  pfConvNumField('research.114', 'hyperTech', '#hypertech-lvl'),
  {
    // Trade has no "no class": a profile without one shows as collector.
    prm: 'playerClass', key: 'class', input: '#player-class-0',
    toPrm: (v) => Math.min(2, Math.max(0, pfNum(v) - 1)),
    fromPrm: (v) => pfNum(v) + 1,
    display: (v) => pfLabelFor('player-class-' + (pfNum(v) - 1)),
  },
  pfConvNumField('lf.ship.202.cargo', 'scCapacityIncrease', '#sc-capacity-increase'),
  pfConvNumField('lf.ship.203.cargo', 'lcCapacityIncrease', '#lc-capacity-increase'),
  {
    prm: 'rates', key: 'rates', input: '#rate-md',
    toPrm: (v) => {
      const valid = Array.isArray(v) && v.length === 3 && v.every((r) => Number(r) > 0);
      const trade = ratesToTrade(valid ? v.map(Number) : DEFAULT_RATES);
      const md = tradeRoundRate(trade.md);
      const cd = tradeRoundRate(trade.cd);
      return { md, cd, mc: tradeMcRate(md, cd) };
    },
    fromPrm: (v) => ratesFromTrade({ md: tradeRoundRate(v.md), cd: tradeRoundRate(v.cd) }),
  },
];

/** The options keys the account fields above live in. */
const TRADE_OWNED_KEYS = TRADE_ACCOUNT_FIELDS.map((f) => f.prm);

/** @typedef {typeof tradeApp} TradeApp */

/** @extends {ProfileBinder<TradeApp>} */
class TradeProfiles extends ProfileBinder {
  /**
   * @param {ProfilesUi} pf
   * @param {TradeApp} app
   */
  constructor(pf, app) {
    super(pf, app);
    /** @type {Record<string, *>} The profile-owned options as they were before a profile. */
    this.ownPrm = {};
    this.universe = new PfLockedUniverse({
      read: () => ({ country: options.country, universe: options.universe }),
      write: (country, number) => {
        options.country = country;
        options.universe = number;
      },
    });
    this.bodySelect = new PfCoordsSelect(pf, {
      select: '#pf-body', boxes: ['#pf-body-box'], lastKey: 'trade', nameFallback: '—',
      isAt: (b) => b.isMoon === !!options.moon && sameValue(b.coords, [options.coordg, options.coords, options.coordp].map(Number)),
      move: (b) => this.setCoords(b),
      recalc: () => this.app.recalc(),
    });
    // The original save reads `this`: it has to stay bound to options.
    this.ownSave = options.save.bind(options);
  }

  init() {
    this.describeFields();
    options.save = () => this.save();
    addEvent('#pf-body', 'change', () => this.bodyChosen());
    this.pf.onChange((profile) => this.apply(profile));
    const link = this.app.takeLinkOverrides();
    const active = this.pf.active();
    if (active) this.apply(active, link);
  }

  // -------------------------------------------------------------------------
  // Profile -> calculator
  // -------------------------------------------------------------------------

  /**
   * @param {?Profile} profile
   * @param {TradeLinkOverrides} [link] What the page's link carries; only the first apply on load has any.
   */
  apply(profile, link = TRADE_NO_LINK) {
    if (!profile) {
      this.leave();
      return;
    }
    /** @type {Record<string, any>} */
    const state = options;
    this.applying = true;
    try {
      if (this.profileId === null) {
        this.ownPrm = {};
        TRADE_OWNED_KEYS.forEach((key) => { this.ownPrm[key] = cloneData(state[key]); });
      }
      this.profileId = profile.id;
      this.pf.clearMarks();
      TRADE_ACCOUNT_FIELDS.forEach((f) => {
        if (f.prm === 'rates' && link.rates) return;
        state[f.prm] = f.toPrm(getProfileValue(profile.account, f.key));
      });
      this.applyUniverse(profile, link);
      this.bodySelect.render(profile, link.coords);
      this.app.restoreFromState();
      // Trade's reset would write every default into the profile as an edit.
      pfShow('#reset', false);
      // The recalculation reads the fields back: the snapshot then holds the
      // values exactly as the form gives them, and the next edit compares like with like.
      this.app.recalc();
      this.takeSnapshot();
    } finally {
      this.applying = false;
    }
    this.markAll();
  }

  /**
   * Put the profile's universe into the model, locked: the profile says where
   * it plays. A profile with no universe leaves the picker to the player, and
   * so does a link to another universe, for this view. The form is shown by
   * the caller.
   *
   * @param {Profile} profile
   * @param {TradeLinkOverrides} link
   */
  applyUniverse(profile, link) {
    const wanted = profile.universe;
    if (wanted && link.universe && !this.universe.matches(wanted.country, wanted.number)) {
      this.universe.lock(false);
      return;
    }
    this.universe.apply(profile);
  }

  restoreOwn() {
    this.bodySelect.hide();
    Object.assign(options, cloneData(this.ownPrm));
    this.universe.release();
    this.app.restoreFromState();
  }

  recalc() {
    this.app.recalc();
  }

  takeSnapshot() {
    /** @type {Record<string, any>} */
    const state = options;
    this.snapshot = {};
    TRADE_ACCOUNT_FIELDS.forEach((f) => { this.snapshot[f.key] = f.fromPrm(state[f.prm]); });
  }

  // -------------------------------------------------------------------------
  // Calculator -> profile
  // -------------------------------------------------------------------------

  saveWithoutProfile() {
    this.ownSave();
  }

  saveWithProfile() {
    super.saveWithProfile();
    const profile = this.profile();
    if (profile) this.bodySelect.sync(profile);
  }

  /** Write what changed since the last snapshot into the profile. */
  sync() {
    const profile = this.profile();
    if (!profile) return;
    /** @type {Record<string, any>} */
    const state = options;
    let changed = false;
    TRADE_ACCOUNT_FIELDS.forEach((f) => {
      changed = this.syncValue(profile.account, f.key, f.key, f.fromPrm(state[f.prm])) || changed;
    });
    if (changed) {
      this.pf.save(profile);
      this.markAll();
    }
  }

  /**
   * options_trade gets the calculator's own fields as they are, and the
   * profile-owned ones - and a universe the profile dictates - as they were
   * before the profile.
   */
  saveOwn() {
    /** @type {Record<string, any>} */
    const stored = { ...options, ...cloneData(this.ownPrm) };
    this.universe.overlay(stored);
    // The locale separator is the template's, never the cookie's (see options.load()).
    delete stored.decimalSeparator;
    saveToCookie('options_trade', stored);
  }

  // -------------------------------------------------------------------------
  // The body select: coordinates
  // -------------------------------------------------------------------------

  /** @param {PfCoordsBody} b */
  setCoords(b) {
    options.coordg = b.coords[0];
    options.coords = b.coords[1];
    options.coordp = b.coords[2];
    options.moon = b.isMoon;
    setVal('#coord-g', b.coords[0]);
    setVal('#coord-s', b.coords[1]);
    setVal('#coord-p', b.coords[2]);
    setChecked('#moon', b.isMoon);
  }

  bodyChosen() {
    const profile = this.profile();
    if (profile) this.bodySelect.chosen(profile);
  }

  // -------------------------------------------------------------------------
  // The marks
  // -------------------------------------------------------------------------

  /** Name every value this page binds, in the page's own words. */
  describeFields() {
    this.describeFieldList(TRADE_ACCOUNT_FIELDS);
    // The rates sit in three controls; the page's word for them is the panel heading.
    this.pf.describeField('rates', l.rates);
  }

  /** Mark every field the profile owns, and the ones that differ from the game. */
  markAll() {
    const profile = this.profile();
    if (!profile) return;
    TRADE_ACCOUNT_FIELDS.forEach((f) => {
      this.pf.markField($(f.input), profile, profile.account, f.key, this.restoreAccount(f.key));
    });
  }
}

/**
 * Connect trade to the profiles, when the page has the selector.
 *
 * @returns {?TradeProfiles}
 */
function initTradeProfiles() {
  tradeProfiles = pfBind(TradeProfiles, tradeApp);
  return tradeProfiles;
}

/** @type {?TradeProfiles} Set once the page is wired. */
let tradeProfiles = null;

if (typeof globalThis !== 'undefined') {
  globalThisRecord().initTradeProfiles = initTradeProfiles;
}
