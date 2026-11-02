'use strict';

// The DOM-free half of www/js/interaction-timing.js: how an event timing entry
// becomes an interaction, which interaction stands for the page's INP, and what
// the beacon carries. The observer and sendBeacon wiring needs a real browser
// and only runs on the public site, so it is not exercised here.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

const {
    createInteractionTimingState,
    describeInteractionTarget,
    recordInteractionEntry,
    pickInpInteraction,
    buildInteractionTimingBody,
} = load(['js/interaction-timing.js'], [
    'createInteractionTimingState',
    'describeInteractionTarget',
    'recordInteractionEntry',
    'pickInpInteraction',
    'buildInteractionTimingBody',
]);

/**
 * An event timing entry with the phases spelled out: input at `start`, the
 * handlers from start+delay for `processing` ms, the paint at start+duration.
 * @param {{id: number|undefined, duration: number, start?: number, delay?: number,
 *          processing?: number, name?: string, target?: object|null}} spec
 */
function entry({ id, duration, start = 1000, delay = 0, processing = 0, name = 'click', target = null }) {
    return {
        interactionId: id,
        duration,
        startTime: start,
        processingStart: start + delay,
        processingEnd: start + delay + processing,
        name,
        target,
    };
}

const VISIT = { loadId: 'a'.repeat(32), page: '/pt/costs', lang: 'pt', pointer: 'fine', cores: 8, dcl: 640 };

describe('describeInteractionTarget', () => {
    it('names an element by its id when it has one', () => {
        expect(describeInteractionTarget({ tagName: 'BUTTON', id: 'tabtag-1', className: 'btn btn-primary' }))
            .toBe('button#tabtag-1');
    });

    it('falls back to the first two classes', () => {
        expect(describeInteractionTarget({ tagName: 'INPUT', id: '', className: 'form-control form-control-sm text-end' }))
            .toBe('input.form-control.form-control-sm');
    });

    it('is the bare tag without id or classes, and for an SVG element whose className is not a string', () => {
        expect(describeInteractionTarget({ tagName: 'TD', id: '', className: '' })).toBe('td');
        expect(describeInteractionTarget({ tagName: 'svg', id: '', className: { baseVal: 'x' } })).toBe('svg');
    });

    it('is "(unknown)" once the element is gone', () => {
        expect(describeInteractionTarget(null)).toBe('(unknown)');
        expect(describeInteractionTarget(undefined)).toBe('(unknown)');
        expect(describeInteractionTarget({ nodeType: 3 })).toBe('(unknown)');
    });

    // The server refuses a target outside [A-Za-z0-9#._()-]; replacing keeps
    // two different ids apart, where dropping could merge them.
    it('replaces characters the server does not accept and stays within 96 characters', () => {
        expect(describeInteractionTarget({ tagName: 'DIV', id: 'a b:c', className: '' })).toBe('div#a_b_c');
        expect(describeInteractionTarget({ tagName: 'DIV', id: 'x'.repeat(200), className: '' })).toHaveLength(96);
    });
});

describe('recordInteractionEntry', () => {
    it('skips entries that are not interactions', () => {
        const state = createInteractionTimingState();
        recordInteractionEntry(state, entry({ id: 0, duration: 900 }));
        recordInteractionEntry(state, entry({ id: undefined, duration: 900 }));
        expect(state.ids.size).toBe(0);
        expect(pickInpInteraction(state)).toBeNull();
    });

    it('splits the duration into input delay, processing and presentation', () => {
        const state = createInteractionTimingState();
        recordInteractionEntry(state, entry({ id: 1, duration: 336, start: 5000, delay: 255, processing: 5 }));
        expect(pickInpInteraction(state)).toEqual({
            id: 1, duration: 336, inputDelay: 255, processing: 5, presentation: 76,
            start: 5000, type: 'click', target: '(unknown)',
        });
    });

    // duration is rounded to 8 ms and the phases are not.
    it('clamps a phase that rounding pushed below zero', () => {
        const state = createInteractionTimingState();
        recordInteractionEntry(state, entry({ id: 1, duration: 200, delay: 150, processing: 53 }));
        expect(pickInpInteraction(state)?.presentation).toBe(0);
    });

    it('keeps the longest event of one interaction and counts it once', () => {
        const state = createInteractionTimingState();
        recordInteractionEntry(state, entry({ id: 7, duration: 120, name: 'pointerdown' }));
        recordInteractionEntry(state, entry({ id: 7, duration: 304, name: 'click' }));
        recordInteractionEntry(state, entry({ id: 7, duration: 200, name: 'pointerup' }));
        expect(state.ids.size).toBe(1);
        expect(state.candidates).toHaveLength(1);
        expect(pickInpInteraction(state)?.type).toBe('click');
        expect(pickInpInteraction(state)?.duration).toBe(304);
    });

    // Seen in Chrome: the longest event of a click was its pointerdown, which
    // carried no target, while the click itself named the tab button.
    it('takes the element from whichever event of the interaction names it', () => {
        const tab = { tagName: 'BUTTON', id: 'param-researches-tab', className: '' };
        const longestFirst = createInteractionTimingState();
        recordInteractionEntry(longestFirst, entry({ id: 3, duration: 48, name: 'pointerdown' }));
        recordInteractionEntry(longestFirst, entry({ id: 3, duration: 24, name: 'click', target: tab }));
        expect(pickInpInteraction(longestFirst)?.type).toBe('pointerdown');
        expect(pickInpInteraction(longestFirst)?.target).toBe('button#param-researches-tab');

        const longestLast = createInteractionTimingState();
        recordInteractionEntry(longestLast, entry({ id: 3, duration: 24, name: 'click', target: tab }));
        recordInteractionEntry(longestLast, entry({ id: 3, duration: 48, name: 'pointerup' }));
        expect(pickInpInteraction(longestLast)?.type).toBe('pointerup');
        expect(pickInpInteraction(longestLast)?.target).toBe('button#param-researches-tab');
    });

    it('keeps only the ten slowest interactions but counts all of them', () => {
        const state = createInteractionTimingState();
        for (let id = 1; id <= 30; id++) {
            recordInteractionEntry(state, entry({ id, duration: id * 10 }));
        }
        expect(state.ids.size).toBe(30);
        expect(state.candidates.map((c) => c.duration)).toEqual([300, 290, 280, 270, 260, 250, 240, 230, 220, 210]);
    });
});

describe('pickInpInteraction', () => {
    /** A state with `count` interactions whose durations are 1..count ms. */
    function stateWith(count) {
        const state = createInteractionTimingState();
        for (let id = 1; id <= count; id++) {
            recordInteractionEntry(state, entry({ id, duration: id }));
        }
        return state;
    }

    it('is the slowest interaction below 50 of them', () => {
        expect(pickInpInteraction(stateWith(1))?.duration).toBe(1);
        expect(pickInpInteraction(stateWith(49))?.duration).toBe(49);
    });

    // web-vitals: one outlier is ignored per 50 interactions.
    it('skips one outlier per 50 interactions', () => {
        expect(pickInpInteraction(stateWith(50))?.duration).toBe(49);
        expect(pickInpInteraction(stateWith(120))?.duration).toBe(118);
    });

    it('stops at the last candidate it kept', () => {
        expect(pickInpInteraction(stateWith(2000))?.duration).toBe(1991);
    });
});

describe('buildInteractionTimingBody', () => {
    it('has nothing to send before the first interaction', () => {
        expect(buildInteractionTimingBody(createInteractionTimingState(), VISIT)).toBeNull();
    });

    it('carries the visit and the INP interaction under the names the service reads', () => {
        const state = createInteractionTimingState();
        const target = { tagName: 'BUTTON', id: 'tabtag-1', className: '' };
        recordInteractionEntry(state, entry({ id: 1, duration: 104, start: 900, delay: 40, processing: 8 }));
        recordInteractionEntry(state, entry({ id: 2, duration: 512, start: 2400, delay: 300, processing: 12, target }));
        expect(buildInteractionTimingBody(state, VISIT)).toEqual({
            service: 'interactionTiming',
            loadId: 'a'.repeat(32),
            page: '/pt/costs',
            lang: 'pt',
            pointer: 'fine',
            interactions: '2',
            inp: '512',
            inputDelay: '300',
            processing: '12',
            presentation: '200',
            start: '2400',
            event: 'click',
            target: 'button#tabtag-1',
            cores: '8',
            dcl: '640',
        });
    });

    it('leaves out what the browser could not tell and fits page and lang to the server', () => {
        const state = createInteractionTimingState();
        recordInteractionEntry(state, entry({ id: 1, duration: 64 }));
        const body = buildInteractionTimingBody(state, {
            ...VISIT, page: '/en/flight%20x' + '/y'.repeat(60), lang: 'pt-BR', cores: null, dcl: null,
        });
        expect(body?.page).toBe(('/en/flight_20x' + '/y'.repeat(60)).slice(0, 64));
        expect(body?.lang).toBe('pt-br');
        expect('cores' in (body ?? {})).toBe(false);
        expect('dcl' in (body ?? {})).toBe(false);
    });
});
