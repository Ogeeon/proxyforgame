// The one place application code reaches Bootstrap's JavaScript through.
//
// Loaded by vendor.tpl right after the bundle and its guard (bootstrap-
// tooltip-guard.js), ahead of sidebar.js and every calculator script, so its
// functions are page globals by the time anything else runs. Lives in www/js/
// rather than next to dom-utils.js because the start page loads sidebar.js but
// not dom-utils.js.
//
// Why a facade: Bootstrap 6 drops the `window.bootstrap` UMD global, renames
// components (Modal -> Dialog, Offcanvas -> Drawer) and their events. Keeping
// every read of the global, every component class, every `*.bs.*` event name
// and every bit of tooltip internals in this file means the migration edits
// this file, not forty call sites. ESLint (`no-restricted-globals`) keeps it
// that way: no file but this one and the guard may read `bootstrap`. See
// docs/bootstrap-6-migration.md.
//
// Contract: every function degrades to a no-op (or returns null / false) when
// the bundle is missing - its request failed - exactly like the inline guards
// it replaced. Callers never have to check for Bootstrap themselves.

/**
 * @returns {boolean} True when the Bootstrap bundle has run on this page.
 */
function bootstrapAvailable() {
    return typeof bootstrap !== 'undefined';
}

// ==========================================================================
// COMPONENT CLASSES - the only reads of the global
// ==========================================================================

/** @returns {typeof bootstrap.Tooltip | null} */
function bsTooltip() {
    return bootstrapAvailable() && bootstrap.Tooltip ? bootstrap.Tooltip : null;
}

/** @returns {typeof bootstrap.Popover | null} */
function bsPopover() {
    return bootstrapAvailable() && bootstrap.Popover ? bootstrap.Popover : null;
}

/** @returns {typeof bootstrap.Modal | null} */
function bsModal() {
    return bootstrapAvailable() && bootstrap.Modal ? bootstrap.Modal : null;
}

/** @returns {typeof bootstrap.Tab | null} */
function bsTab() {
    return bootstrapAvailable() && bootstrap.Tab ? bootstrap.Tab : null;
}

/** @returns {typeof bootstrap.Collapse | null} */
function bsCollapse() {
    return bootstrapAvailable() && bootstrap.Collapse ? bootstrap.Collapse : null;
}

/** @returns {typeof bootstrap.Toast | null} */
function bsToast() {
    return bootstrapAvailable() && bootstrap.Toast ? bootstrap.Toast : null;
}

// ==========================================================================
// EVENT NAMES
// ==========================================================================

/**
 * Bootstrap's component events. Listen through these names - with addEvent()
 * or addEventListener() as before - rather than spelling `*.bs.*` out:
 * removeAllEvents() needs the very same string the handler was added under,
 * and this is where the names change when Bootstrap renames them.
 */
const BS_EVENT = Object.freeze({
    modalShow: 'show.bs.modal',
    modalHidden: 'hidden.bs.modal',
    tabShown: 'shown.bs.tab',
    collapseShown: 'shown.bs.collapse',
    collapseHidden: 'hidden.bs.collapse',
    toastHidden: 'hidden.bs.toast',
    offcanvasShow: 'show.bs.offcanvas',
    offcanvasHide: 'hide.bs.offcanvas',
    offcanvasHidden: 'hidden.bs.offcanvas',
});

// ==========================================================================
// TOOLTIPS AND POPOVERS
// ==========================================================================

const TOOLTIP_SELECTOR = '[data-bs-toggle="tooltip"]';

/**
 * Give every `[data-bs-toggle="tooltip"]` inside `root` its instance.
 * getOrCreateInstance, not `new`: an element initialised twice is not bound
 * twice (SonarQube S1848).
 *
 * @param {ParentNode|null|undefined} root
 * @param {{ refresh?: boolean }} [opts] refresh: dispose an existing instance
 *   first, so the new one picks up a `title` the caller has just rewritten.
 */
function attachTooltips(root, { refresh = false } = {}) {
    const Tooltip = bsTooltip();
    if (!root || !Tooltip) return;
    root.querySelectorAll(TOOLTIP_SELECTOR).forEach((el) => {
        if (refresh) Tooltip.getInstance(el)?.dispose();
        Tooltip.getOrCreateInstance(el);
    });
}

/**
 * Release the tooltips of `root` itself and of everything inside it that
 * matches `selector`. Must run before the anchors leave the DOM: a bubble whose
 * anchor is gone stays on screen and its instance is never released. After an
 * innerHTML write it is a no-op - it would walk the new nodes.
 *
 * @param {(ParentNode & Element)|null|undefined} root
 * @param {string} [selector]
 */
function disposeTooltips(root, selector = TOOLTIP_SELECTOR) {
    const Tooltip = bsTooltip();
    if (!root || !Tooltip) return;
    Tooltip.getInstance(root)?.dispose();
    root.querySelectorAll(selector).forEach((el) => Tooltip.getInstance(el)?.dispose());
}

/**
 * Set the text of an element's tooltip, creating the tooltip if it has none.
 *
 * An adopted element no longer has a `title`: Bootstrap moves it into
 * `data-bs-original-title` and reads the bubble text from there on every show,
 * so that attribute is what keeps the text in sync - writing `title` back
 * would give the element a native tooltip next to the Bootstrap one.
 * setContent() covers an instance whose text came from `data-bs-title` (its
 * config, read once) and refreshes a bubble that is on screen; the attribute
 * keeps the text across a later dispose-and-recreate.
 *
 * @param {Element|null|undefined} el
 * @param {string} text
 */
function setTooltipText(el, text) {
    const Tooltip = bsTooltip();
    // Every anchor is an HTML element; the narrowing is what gives `dataset`.
    if (!(el instanceof HTMLElement) || !Tooltip) return;
    const existing = Tooltip.getInstance(el);
    if (existing) {
        el.dataset.bsOriginalTitle = text;
        existing.setContent({ '.tooltip-inner': text });
    } else {
        el.setAttribute('title', text);
        Tooltip.getOrCreateInstance(el);
    }
}

/**
 * Hide the tooltip of `el`, if it has one. Does not create an instance.
 *
 * @param {Element|null|undefined} el
 * @returns {boolean} True when `el` had a tooltip to hide.
 */
function hideTooltip(el) {
    const Tooltip = bsTooltip();
    if (!el || !Tooltip) return false;
    const instance = Tooltip.getInstance(el);
    if (!instance) return false;
    instance.hide();
    return true;
}

/**
 * Give every `[data-bs-toggle="popover"]` inside `root` its instance.
 *
 * @param {ParentNode|null|undefined} root
 */
function attachPopovers(root) {
    const Popover = bsPopover();
    if (!root || !Popover) return;
    root.querySelectorAll('[data-bs-toggle="popover"]').forEach((el) => Popover.getOrCreateInstance(el));
}

// ==========================================================================
// MODALS
// ==========================================================================

/**
 * The modal instance of `el`, created on first use. `opts` only take effect
 * when the instance is created - as with getOrCreateInstance() itself.
 *
 * @param {Element|null|undefined} el
 * @param {Partial<bootstrap.Modal.Options>} [opts]
 * @returns {bootstrap.Modal | null}
 */
function modalFor(el, opts) {
    const Modal = bsModal();
    if (!el || !Modal) return null;
    return Modal.getOrCreateInstance(el, opts);
}

/**
 * Show the modal `el`, creating its instance if needed.
 *
 * @param {Element|null|undefined} el
 * @param {Partial<bootstrap.Modal.Options>} [opts]
 * @returns {boolean} True when the modal was asked to show.
 */
function openModal(el, opts) {
    const modal = modalFor(el, opts);
    if (!modal) return false;
    modal.show();
    return true;
}

/**
 * Hide the modal `el`. Goes through getInstance(): a modal that never had an
 * instance is not open, and creating one only to hide it is not a no-op.
 *
 * @param {Element|null|undefined} el
 * @returns {boolean} True when `el` had an instance to hide.
 */
function hideModal(el) {
    const Modal = bsModal();
    if (!el || !Modal) return false;
    const modal = Modal.getInstance(el);
    if (!modal) return false;
    modal.hide();
    return true;
}

// ==========================================================================
// TABS, COLLAPSE, TOASTS
// ==========================================================================

/**
 * Activate the tab whose trigger is `el`.
 *
 * @param {Element|null|undefined} el
 */
function activateTab(el) {
    const Tab = bsTab();
    if (!el || !Tab) return;
    Tab.getOrCreateInstance(el).show();
}

/**
 * Expand the collapsible section `el`.
 *
 * @param {Element|null|undefined} el
 */
function expandCollapse(el) {
    const Collapse = bsCollapse();
    if (!el || !Collapse) return;
    Collapse.getOrCreateInstance(el).show();
}

/**
 * Show the toast `el` with `opts`, and dispose its instance once it is hidden.
 * Named apart from dom-utils.js showToast(), which builds the element and
 * calls this.
 *
 * @param {Element|null|undefined} el
 * @param {Partial<bootstrap.Toast.Options>} [opts]
 * @returns {boolean} True when the toast was shown.
 */
function openToast(el, opts) {
    const Toast = bsToast();
    if (!el || !Toast) return false;
    const toast = Toast.getOrCreateInstance(el, opts);
    el.addEventListener(BS_EVENT.toastHidden, () => toast.dispose(), { once: true });
    toast.show();
    return true;
}

if (typeof window !== 'undefined') {
    Object.assign(window, {
        bootstrapAvailable,
        bsTooltip,
        bsPopover,
        bsModal,
        bsTab,
        bsCollapse,
        bsToast,
        BS_EVENT,
        attachTooltips,
        disposeTooltips,
        setTooltipText,
        hideTooltip,
        attachPopovers,
        modalFor,
        openModal,
        hideModal,
        activateTab,
        expandCollapse,
        openToast,
    });
}
