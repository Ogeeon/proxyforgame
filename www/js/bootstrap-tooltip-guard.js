// Boots after bootstrap.bundle.min.js (see vendor_bs.tpl) and repairs one defect
// in it, so the vendored bundle itself stays byte-identical to the release it
// was copied from (`make vendor-check` hashes it).
//
// Tooltip.hide() has an animated path that hands its callback to
// executeAfterTransition(), which runs it when the tip's fade ends. Dispose the
// tooltip while that callback is still in flight and it wakes up on a component
// BaseComponent.dispose() has already emptied: `dispose()` assigns null to every
// own property of the instance, _activeTrigger and _element among them. The
// callback's first question is then
//
//   Object.values(this._activeTrigger)
//   TypeError: Cannot convert undefined or null to object
//
// Removing a flight-leg row does exactly this - its tooltip is disposed a
// moment after the pointer left it, which is what Hawk has been reporting on
// /es/flight since Bootstrap moved from jsdelivr to www/vendor/ and its frames
// started arriving with the report (twbs/bootstrap#37474, unfixed in 5.3.8, the
// latest release). The same shape recurs in the LF costs table.
//
// Answering the question the callback actually asks - is the user still holding
// this tooltip open? - is enough: a disposed tooltip has nobody hovering it.
// It must answer `true`, not `false`. `false` would only let the callback carry
// on to this._element.removeAttribute(), which dispose() has nulled too, and
// the same TypeError would come back one line further down.
(function () {
    'use strict';

    if (typeof bootstrap === 'undefined' || !bootstrap.Tooltip) {
        return; // no bundle on the page, nothing to repair
    }

    // The cast is the point: _isWithActiveTrigger and _activeTrigger are internal,
    // so @types/bootstrap declares neither and this file's `checkJs` pass would
    // reject the plain property accesses.
    const proto = /** @type {any} */ (bootstrap.Tooltip.prototype);
    const original = proto._isWithActiveTrigger;
    if (typeof original !== 'function') {
        return; // a future Bootstrap renamed or removed it; leave it alone
    }

    proto._isWithActiveTrigger = function () {
        return this._activeTrigger ? original.call(this) : true;
    };
})();
