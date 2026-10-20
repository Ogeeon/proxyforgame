// ============================================================================
// TRADE CALCULATOR - PLAYER PROFILE BINDING
// ============================================================================
// Connects the trade calculator to the active player profile (ADR-0004).
// Trade keeps its settings in the flat `options` object; this file projects
// the profile into it and writes the changes back:
//   - apply(): profile -> options (hyperspace technology, class, the cargo
//     bonuses of the small and large transporter, the exchange rates) and the
//     profile's universe into the universe picker, locked;
//   - writeBack(): options -> profile, called from options.save(), writing
//     only what changed since the last apply or write-back, so a lossy mapping (a profile
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

/** @type {ProfilePrmField[]} */
const TRADE_ACCOUNT_FIELDS = [
  pfConvNumField('research.114', 'hyperTech', '#hypertech-lvl'),
  pfCollectorClassField('playerClass', 'player-class-'),
  pfConvNumField('lf.ship.202.cargo', 'scCapacityIncrease', '#sc-capacity-increase'),
  pfConvNumField('lf.ship.203.cargo', 'lcCapacityIncrease', '#lc-capacity-increase'),
  pfPrmField('rates', 'rates', '#rate-md',
    (v) => {
      const valid = Array.isArray(v) && v.length === 3 && v.every((r) => Number(r) > 0);
      const trade = ratesToTrade(valid ? v.map(Number) : DEFAULT_RATES);
      const md = tradeRoundRate(trade.md);
      const cd = tradeRoundRate(trade.cd);
      return { md, cd, mc: tradeMcRate(md, cd) };
    },
    (v) => ratesFromTrade({ md: tradeRoundRate(v.md), cd: tradeRoundRate(v.cd) })),
];

/** The options keys the account fields above live in. */
const TRADE_OWNED_KEYS = TRADE_ACCOUNT_FIELDS.map((f) => f.prm);

/** @typedef {typeof tradeApp} TradeApp */

/** @extends {FlatSettingsBinder<ProfilePrmField, TradeApp>} */
class TradeProfiles extends FlatSettingsBinder {
  /**
   * @param {ProfilesUi} pf
   * @param {TradeApp} app
   */
  constructor(pf, app) {
    /** @type {Record<string, any>} */
    const state = options;
    super(pf, app, {
      fields: TRADE_ACCOUNT_FIELDS,
      settings: () => state,
      ownedKeys: TRADE_OWNED_KEYS,
      cookie: 'options_trade',
      // The original save reads `this`: it has to stay bound to options.
      ownSave: options.save.bind(options),
    });
    /** @type {TradeLinkOverrides} What the page's link carries, for the apply in progress. */
    this.link = TRADE_NO_LINK;
    this.universe = new PfLockedUniverse({
      read: () => ({ country: options.country, universe: options.universe }),
      write: (country, number) => {
        options.country = country;
        options.universe = number;
      },
    });
    this.coordsSelect = new PfCoordsSelect(pf, {
      select: '#pf-body', boxes: ['#pf-body-box'], lastKey: 'trade', nameFallback: '—',
      isAt: (b) => b.isMoon === !!options.moon && sameValue(b.coords, [options.coordg, options.coords, options.coordp].map(Number)),
      move: (b) => this.setCoords(b),
      recalc: () => this.app.recalc(),
    });
  }

  /** @param {?Profile} active */
  applyInitial(active) {
    const link = this.app.takeLinkOverrides();
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
    this.link = link;
    super.apply(profile);
  }

  /**
   * @param {ProfilePrmField} field
   * @param {*} value
   */
  writeField(field, value) {
    // A link's rates win over the profile's, for this view.
    if (field.prm === 'rates' && this.link.rates) return;
    super.writeField(field, value);
  }

  /**
   * Put the profile's universe into the model, locked: the profile says where
   * it plays. A profile with no universe leaves the picker to the player, and
   * so does a link to another universe, for this view. The form is shown below.
   *
   * @param {Profile} profile
   */
  showSettings(profile) {
    const wanted = profile.universe;
    if (wanted && this.link.universe && !this.universe.matches(wanted.country, wanted.number)) {
      this.universe.lock(false);
    } else {
      this.universe.apply(profile);
    }
    this.coordsSelect?.render(profile, this.link.coords);
    this.app.restoreFromState();
  }

  showOwn() {
    this.universe.release();
    this.app.restoreFromState();
  }

  recalc() {
    this.app.recalc();
  }

  /** @param {Record<string, any>} stored */
  storable(stored) {
    // The locale separator is the template's, never the cookie's (see options.load()).
    delete stored.decimalSeparator;
    return stored;
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

  // -------------------------------------------------------------------------
  // The marks
  // -------------------------------------------------------------------------

  /** Name every value this page binds, in the page's own words. */
  describeFields() {
    super.describeFields();
    // The rates sit in three controls; the page's word for them is the panel heading.
    this.pf.describeField('rates', l.rates);
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
