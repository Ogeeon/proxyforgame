// Field INP for our own database. CrUX says the 75th percentile of
// interaction latency is slow but not on which calculator, which control or in
// which phase; this measures it on every page load of the public site and
// sends one row per load to the interactionTiming service
// (www/api/interaction-timing.inc.php). analitics.tpl loads it, so it only runs
// where the Metrica counter does - not locally, in CI or under the e2e suite.
//
// INP is picked the way Chrome's web-vitals library picks it: the slowest
// interaction, except that one outlier per 50 interactions is ignored. Only a
// selector (tag, id, two classes) and timings leave the page, never a value
// typed into a field. The beacon carries a random id minted per page load and
// stored nowhere, so a second beacon of the same load replaces the first one
// instead of counting the visit twice.

/**
 * One interaction, reduced to what is sent: the longest of the events that
 * make it up (a click is pointerdown + pointerup + click under one id).
 * @typedef {object} TimedInteraction
 * @property {number} id            the browser's interactionId
 * @property {number} duration      ms from input to the next paint
 * @property {number} inputDelay    ms the main thread was busy before the handlers ran
 * @property {number} processing    ms the handlers ran
 * @property {number} presentation  ms from the handlers' end to the next paint
 * @property {number} start         ms from navigation start to the input
 * @property {string} type          the event name, e.g. "click"
 * @property {string} target        a selector for the element hit
 */

/**
 * The parts of a PerformanceEventTiming entry the measurement reads - typed
 * apart from the DOM interface so the unit tests can hand in plain objects.
 * @typedef {object} EventTimingLike
 * @property {number} [interactionId]
 * @property {number} duration
 * @property {number} startTime
 * @property {number} processingStart
 * @property {number} processingEnd
 * @property {string} name
 * @property {Node|null} [target]
 */

/**
 * @typedef {object} InteractionTimingState
 * @property {Set<number>} ids                  every interaction seen, for the count
 * @property {TimedInteraction[]} candidates    the slowest ones, slowest first
 */

// web-vitals keeps this many; with one outlier skipped per 50 interactions it
// covers a visit of 500 before the pick runs off the end of the list.
const INTERACTION_TIMING_CANDIDATES = 10;

// The server's limits on the two free-text fields (interaction-timing.inc.php).
const INTERACTION_TIMING_MAX_TARGET = 96;
const INTERACTION_TIMING_MAX_PAGE = 64;

/** @returns {InteractionTimingState} */
function createInteractionTimingState() {
    return { ids: new Set(), candidates: [] };
}

/**
 * A short, stable selector for the element an interaction hit: the tag and its
 * id, or the tag and its first two classes. "(unknown)" when the element was
 * gone by the time the entry was read - a re-rendered row, say.
 * Characters outside the server's alphabet are replaced, not dropped, so two
 * different ids stay two different selectors.
 * @param {Node|null|undefined} node
 * @returns {string}
 */
function describeInteractionTarget(node) {
    const element = /** @type {Element|null|undefined} */ (node);
    if (!element?.tagName) {
        return '(unknown)';
    }
    let text = element.tagName.toLowerCase();
    if (element.id) {
        text += '#' + element.id;
    } else {
        const className = typeof element.className === 'string' ? element.className : '';
        const classes = className.split(/\s+/).filter(Boolean);
        if (classes.length > 0) {
            text += '.' + classes.slice(0, 2).join('.');
        }
    }
    return text.replace(/[^A-Za-z0-9#._()-]/g, '_').slice(0, INTERACTION_TIMING_MAX_TARGET);
}

/**
 * Folds one event timing entry into the state. Entries without an
 * interactionId (a mousemove, a scroll) are not interactions and are skipped.
 * @param {InteractionTimingState} state
 * @param {EventTimingLike} entry
 */
function recordInteractionEntry(state, entry) {
    const id = entry.interactionId;
    if (!id) {
        return;
    }
    state.ids.add(id);

    // The events of one interaction do not all name the element: a pointerdown
    // often has no target where the click that follows has one. Whichever
    // event is the longest, the element is taken from any that knows it.
    let target = describeInteractionTarget(entry.target);
    const known = state.candidates.find(function (c) { return c.id === id; });
    if (known && known.duration >= entry.duration) {
        if (known.target === '(unknown)') {
            known.target = target;
        }
        return;
    }
    if (known && target === '(unknown)') {
        target = known.target;
    }
    const smallest = state.candidates.at(-1);
    if (!known && state.candidates.length >= INTERACTION_TIMING_CANDIDATES
        && smallest && smallest.duration >= entry.duration) {
        return;
    }

    // Durations are rounded to 8 ms and the phases are not, so the last phase
    // can come out a few ms below zero; it is clamped rather than sent negative.
    /** @type {TimedInteraction} */
    const timed = {
        id: id,
        duration: Math.round(entry.duration),
        inputDelay: Math.max(0, Math.round(entry.processingStart - entry.startTime)),
        processing: Math.max(0, Math.round(entry.processingEnd - entry.processingStart)),
        presentation: Math.max(0, Math.round(entry.startTime + entry.duration - entry.processingEnd)),
        start: Math.max(0, Math.round(entry.startTime)),
        type: entry.name,
        target: target,
    };
    const rest = state.candidates.filter(function (c) { return c.id !== id; });
    rest.push(timed);
    rest.sort(function (a, b) { return b.duration - a.duration; });
    state.candidates = rest.slice(0, INTERACTION_TIMING_CANDIDATES);
}

/**
 * The interaction that defines the page's INP: the slowest, skipping one per
 * 50 interactions so a single hiccup in a long visit does not stand for it.
 * @param {InteractionTimingState} state
 * @returns {TimedInteraction|null}
 */
function pickInpInteraction(state) {
    if (state.candidates.length === 0) {
        return null;
    }
    const index = Math.min(state.candidates.length - 1, Math.floor(state.ids.size / 50));
    return state.candidates[index];
}

/**
 * The beacon's body for the current state, or null when there is nothing to
 * send yet. Everything but the interaction is passed in, so the unit tests do
 * not need a browser.
 * @param {InteractionTimingState} state
 * @param {{loadId: string, page: string, lang: string, pointer: string, cores: number|null, dcl: number|null}} visit
 * @returns {Record<string, string>|null}
 */
function buildInteractionTimingBody(state, visit) {
    const inp = pickInpInteraction(state);
    if (inp === null) {
        return null;
    }
    /** @type {Record<string, string>} */
    const body = {
        service: 'interactionTiming',
        loadId: visit.loadId,
        page: visit.page.replace(/[^A-Za-z0-9/._-]/g, '_').slice(0, INTERACTION_TIMING_MAX_PAGE),
        lang: visit.lang.toLowerCase().replace(/[^a-z-]/g, '').slice(0, 8),
        pointer: visit.pointer,
        interactions: String(Math.min(state.ids.size, 65535)),
        inp: String(inp.duration),
        inputDelay: String(inp.inputDelay),
        processing: String(inp.processing),
        presentation: String(inp.presentation),
        start: String(inp.start),
        event: inp.type.toLowerCase().replace(/[^a-z]/g, '').slice(0, 16) || 'unknown',
        target: inp.target,
    };
    if (visit.cores !== null) {
        body.cores = String(visit.cores);
    }
    if (visit.dcl !== null) {
        body.dcl = String(visit.dcl);
    }
    return body;
}

/**
 * Starts measuring and sends a beacon each time the page is hidden with more
 * interactions behind it than the last beacon carried. A browser without
 * event timing (Safari, for one) is left alone.
 * @param {string} endpoint
 */
function startInteractionTiming(endpoint) {
    try {
        if (typeof PerformanceObserver !== 'function'
            || !PerformanceObserver.supportedEntryTypes
            || !PerformanceObserver.supportedEntryTypes.includes('event')
            || typeof navigator.sendBeacon !== 'function') {
            return;
        }
        const state = createInteractionTimingState();
        const loadId = Array.from(crypto.getRandomValues(new Uint8Array(16)), function (b) {
            return b.toString(16).padStart(2, '0');
        }).join('');
        let sentCount = 0;

        const observe = function (/** @type {PerformanceObserverEntryList} */ list) {
            list.getEntries().forEach(function (entry) {
                recordInteractionEntry(state, /** @type {PerformanceEventTiming} */ (entry));
            });
        };
        // 16 ms is the lowest threshold the browser accepts: a fast interaction
        // still counts towards the 1-in-50 rule. first-input is reported
        // whatever its duration, so a visit with one quick click is not lost.
        // The buffer replays what happened before this deferred script ran.
        new PerformanceObserver(observe).observe(/** @type {PerformanceObserverInit} */ ({ type: 'event', buffered: true, durationThreshold: 16 }));
        if (PerformanceObserver.supportedEntryTypes.includes('first-input')) {
            new PerformanceObserver(observe).observe({ type: 'first-input', buffered: true });
        }

        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState !== 'hidden' || state.ids.size <= sentCount) {
                return;
            }
            const navigation = /** @type {PerformanceNavigationTiming|undefined} */ (performance.getEntriesByType('navigation')[0]);
            const dcl = navigation && navigation.domContentLoadedEventEnd > 0 ? Math.round(navigation.domContentLoadedEventEnd) : null;
            const cores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency > 0
                ? navigator.hardwareConcurrency : null;
            let pointer = 'none';
            if (matchMedia('(pointer: coarse)').matches) {
                pointer = 'coarse';
            } else if (matchMedia('(pointer: fine)').matches) {
                pointer = 'fine';
            }
            const body = buildInteractionTimingBody(state, {
                loadId: loadId,
                page: location.pathname,
                lang: document.documentElement.lang || '',
                pointer: pointer,
                cores: cores,
                dcl: dcl,
            });
            // URLSearchParams goes out as a urlencoded form, which PHP reads into $_POST.
            if (body !== null && navigator.sendBeacon(endpoint, new URLSearchParams(body))) {
                sentCount = state.ids.size;
            }
        });
    } catch (e) {
        // Measuring must never break the page.
    }
}

if (typeof document !== 'undefined') {
    startInteractionTiming('/ajax.php');
}
