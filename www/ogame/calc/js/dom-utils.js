// ============================================================================
// DOM UTILITIES - jQuery Replacement Library
// ============================================================================
// Provides native DOM helper functions to replace jQuery dependencies
// in the costs calculator migration to Bootstrap 5 + native JavaScript.

'use strict';

// ==========================================================================
// SELECTOR HELPERS
// ==========================================================================

/**
 * Query selector - returns first matching element
 *
 * Declared as HTMLElement rather than Element: every selector in this project
 * targets page markup, and Element lacks style/dataset/hidden/children, which
 * callers use constantly. Callers that need an input, select or table still
 * cast to the specific interface.
 *
 * @param {string} selector - CSS selector
 * @returns {HTMLElement|null}
 */
const $ = (selector) => document.querySelector(selector);

/**
 * Query selector all - returns all matching elements
 * @param {string} selector - CSS selector
 * @returns {NodeListOf<HTMLElement>}
 */
const $$ = (selector) => document.querySelectorAll(selector);

// $ is deliberately typed as HTMLElement, which is what most callers want. The
// three below are for callers that need a specific interface - value, checked,
// selectedIndex, rows - and would otherwise cast at every use.

/**
 * Query selector for an input element
 * @param {string} selector - CSS selector
 * @returns {HTMLInputElement}
 */
const inputEl = (selector) =>
  /** @type {HTMLInputElement} */ (document.querySelector(selector));

/**
 * Query selector for a select element
 * @param {string} selector - CSS selector
 * @returns {HTMLSelectElement}
 */
const selectEl = (selector) =>
  /** @type {HTMLSelectElement} */ (document.querySelector(selector));

/**
 * Query selector for a table element
 * @param {string} selector - CSS selector
 * @returns {HTMLTableElement}
 */
const tableEl = (selector) =>
  /** @type {HTMLTableElement} */ (document.querySelector(selector));

/**
 * Query selector all, for selectors that pick out inputs. Saves a cast inside
 * every `.forEach(el => el.value = ...)` loop.
 * @param {string} selector - CSS selector
 * @returns {NodeListOf<HTMLInputElement>}
 */
const inputsAll = (selector) =>
  /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll(selector));

/**
 * globalThis as a writable bag of names.
 *
 * The calculators publish their classes and app instances as page globals, but
 * a `class X {}` declaration lives in its script's lexical scope, so TypeScript
 * does not know it as a globalThis property. This is where that cast lives, so
 * the assignment sites stay readable.
 *
 * @returns {Record<string, unknown>}
 */
const globalThisRecord = () =>
  /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (globalThis));

/**
 * The checked radio of a group, or null while none is checked.
 * @param {string} name - value of the radios' name attribute
 * @returns {HTMLInputElement|null}
 */
const checkedRadio = (name) =>
  /** @type {HTMLInputElement|null} */ (
    document.querySelector(`input[name="${name}"]:checked`));

// ==========================================================================
// VALUE HELPERS
// ==========================================================================

/**
 * Get the value of an input element
 * @param {string} selector - CSS selector
 * @returns {string}
 */
const getVal = (selector) => {
  const el = inputEl(selector);
  return el ? (el.value || '') : '';
};

/**
 * Set the value of an input element
 * @param {string} selector - CSS selector
 * @param {string|number} value - Value to set
 */
const setVal = (selector, value) => {
  const el = inputEl(selector);
  if (el) el.value = String(value);
};

/**
 * Set the value of a numeric input, converting the decimal point of the stored
 * number to the separator the locale expects. Without it the numeric input
 * validator strips the "." as an illegal character (e.g. "2.5" becomes "25"
 * in locales that use a comma).
 * @param {string} selector - CSS selector
 * @param {string|number} value - Value to set
 */
const setNumVal = (selector, value) => {
  setVal(selector, String(value).replace('.', getOptionValue('decimalSeparator', '.')));
};

/**
 * Get the checked state of a checkbox/radio
 * @param {string} selector - CSS selector
 * @returns {boolean}
 */
const getChecked = (selector) => {
  const el = inputEl(selector);
  return el ? el.checked : false;
};

/**
 * Set the checked state of a checkbox/radio
 * @param {string} selector - CSS selector
 * @param {boolean} checked - Checked state
 */
const setChecked = (selector, checked) => {
  const el = inputEl(selector);
  if (el) el.checked = checked;
};

// ==========================================================================
// CONTENT HELPERS
// ==========================================================================

/**
 * Get the text content of an element
 * @param {string} selector - CSS selector
 * @returns {string}
 */
const getTextContent = (selector) => {
  const el = $(selector);
  return el ? el.textContent : '';
};

/**
 * Set the text content of an element
 * @param {string} selector - CSS selector
 * @param {string} text - Text content
 */
const setTextContent = (selector, text) => {
  const el = $(selector);
  if (el) el.textContent = text;
};

/**
 * Get the inner HTML of an element
 * @param {string} selector - CSS selector
 * @returns {string}
 */
const getHtml = (selector) => {
  const el = $(selector);
  return el ? el.innerHTML : '';
};

/**
 * Set the inner HTML of an element
 * @param {string} selector - CSS selector
 * @param {string} html - HTML content
 */
const setHtml = (selector, html) => {
  const el = $(selector);
  if (el) el.innerHTML = html;
};

// ==========================================================================
// CLASS HELPERS
// ==========================================================================

/**
 * Add a CSS class to an element
 * @param {string} selector - CSS selector
 * @param {string} className - Class name to add
 */
const addClass = (selector, className) => {
  const el = $(selector);
  if (el) el.classList.add(className);
};

/**
 * Remove a CSS class from an element
 * @param {string} selector - CSS selector
 * @param {string} className - Class name to remove
 */
const removeClass = (selector, className) => {
  const el = $(selector);
  if (el) el.classList.remove(className);
};

/**
 * Toggle a CSS class on an element
 * @param {string} selector - CSS selector
 * @param {string} className - Class name to toggle
 * @param {boolean} [force] - Force state; omit to flip the class
 */
const toggleClass = (selector, className, force) => {
  const el = $(selector);
  if (el) el.classList.toggle(className, force);
};

/**
 * Check if an element has a CSS class
 * @param {string} selector - CSS selector
 * @param {string} className - Class name to check
 * @returns {boolean}
 */
const hasClass = (selector, className) => {
  const el = $(selector);
  return el ? el.classList.contains(className) : false;
};

// ==========================================================================
// EVENT HELPERS
// ==========================================================================

/**
 * Add an event listener with tracking for removal
 * @param {string|Element} selector - CSS selector or element
 * @param {string} event - Event name
 * @param {EventListener} handler - Event handler
 * @returns {EventListener|undefined} The handler function for later removal
 */
const addEvent = (selector, event, handler) => {
  const el = typeof selector === 'string' ? $(selector) : selector;
  if (!el) return;

  // Store handler reference for later removal
  if (!el._eventHandlers) el._eventHandlers = {};
  if (!el._eventHandlers[event]) el._eventHandlers[event] = [];

  el._eventHandlers[event].push(handler);
  el.addEventListener(event, handler);

  return handler;
};

/**
 * Remove a specific event listener
 * @param {string|Element} selector - CSS selector or element
 * @param {string} event - Event name
 * @param {EventListener} handler - Event handler to remove
 */
const removeEvent = (selector, event, handler) => {
  const el = typeof selector === 'string' ? $(selector) : selector;
  if (!el?._eventHandlers) return;

  const handlers = el._eventHandlers[event];
  if (handlers) {
    const idx = handlers.indexOf(handler);
    if (idx > -1) {
      handlers.splice(idx, 1);
    }
  }

  el.removeEventListener(event, handler);
};

/**
 * Remove all event listeners for a specific event
 * @param {string|Element} selector - CSS selector or element
 * @param {string} event - Event name
 */
const removeAllEvents = (selector, event) => {
  const el = typeof selector === 'string' ? $(selector) : selector;
  if (!el?._eventHandlers) return;

  const handlers = el._eventHandlers[event];
  if (handlers) {
    handlers.forEach(handler => {
      el.removeEventListener(event, handler);
    });
    el._eventHandlers[event] = [];
  }
};

// ==========================================================================
// SHOW/HIDE HELPERS
// ==========================================================================

/**
 * Show an element (supports Bootstrap modals)
 * @param {string} selector - CSS selector
 */
const show = (selector) => {
  const el = $(selector);
  if (!el) return;

  // For Bootstrap modals. getOrCreateInstance, not `new´: a second instance
  // would take the element over while the first one keeps its listeners.
  if (el.classList.contains('modal')) {
    bootstrap.Modal.getOrCreateInstance(el).show();
  } else {
    el.style.display = '';
  }
};

/**
 * Hide an element (supports Bootstrap modals)
 * @param {string} selector - CSS selector
 */
const hide = (selector) => {
  const el = $(selector);
  if (!el) return;

  // For Bootstrap modals
  if (el.classList.contains('modal')) {
    const modal = bootstrap.Modal.getInstance(el);
    if (modal) modal.hide();
  } else {
    el.style.display = 'none';
  }
};

// ==========================================================================
// FADE ANIMATIONS
// ==========================================================================

/**
 * Fade in an element
 * @param {string} selector - CSS selector
 * @param {number} duration - Duration in ms
 * @param {Function|null} [callback] - Optional callback
 */
const fadeIn = (selector, duration = 400, callback = null) => {
  const el = $(selector);
  if (!el) return;

  el.style.opacity = '0';
  el.style.display = 'block';
  el.style.transition = `opacity ${duration}ms`;

  requestAnimationFrame(() => {
    el.style.opacity = '1';
  });

  if (callback) {
    setTimeout(callback, duration);
  }
};

/**
 * Fade out an element
 * @param {string} selector - CSS selector
 * @param {number} duration - Duration in ms
 * @param {Function|null} [callback] - Optional callback
 */
const fadeOut = (selector, duration = 400, callback = null) => {
  const el = $(selector);
  if (!el) return;

  el.style.transition = `opacity ${duration}ms`;
  el.style.opacity = '0';

  setTimeout(() => {
    el.style.display = 'none';
    if (callback) callback();
  }, duration);
};

// ==========================================================================
// TOASTS
// ==========================================================================

/**
 * The stack every toast is dropped into, created on the first call so that no
 * template needs a container of its own.
 * @returns {HTMLElement}
 */
const toastContainer = () => {
  const existing = $('.toast-container');
  if (existing) return existing;

  const container = document.createElement('div');
  container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
  document.body.appendChild(container);
  return container;
};

/**
 * Reports a failure the user did not ask for - a background request that came
 * back empty or broken. An explicit action the user started keeps using
 * showAlertModal()/showConfirmModal(): see docs/patterns.md (g).
 * @param {string} message - Localised prose, already translated by the caller
 * @param {string} [level] - Bootstrap contextual name: danger, warning, info, success
 */
const showToast = (message, level = 'info') => {
  const el = document.createElement('div');
  el.className = `toast align-items-center text-bg-${level} border-0`;
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');
  el.setAttribute('aria-atomic', 'true');

  const row = document.createElement('div');
  row.className = 'd-flex';

  const body = document.createElement('div');
  body.className = 'toast-body';
  body.textContent = message;

  // text-bg-warning and text-bg-info are light fills carrying dark text, so the
  // white cross Bootstrap ships for dark toasts would be invisible on them.
  const closeSkin = level === 'warning' || level === 'info' ? '' : ' btn-close-white';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = `btn-close${closeSkin} me-2 m-auto`;
  close.dataset.bsDismiss = 'toast';
  close.setAttribute('aria-label', 'Close');

  row.appendChild(body);
  row.appendChild(close);
  el.appendChild(row);
  toastContainer().appendChild(el);

  // A failure leaves the page holding wrong numbers, so it waits for the user
  // to acknowledge it; anything milder clears itself.
  const toast = bootstrap.Toast.getOrCreateInstance(el, {
    autohide: level !== 'danger',
    delay: 7000
  });
  el.addEventListener('hidden.bs.toast', () => {
    toast.dispose();
    el.remove();
  });
  toast.show();
};

// ==========================================================================
// BLOCKING DIALOGS (alert / confirm replacement)
// ==========================================================================

/**
 * Fills a dialog body with one or more localised lines. A single string
 * renders as a paragraph; an array (e.g. a batch of validation errors)
 * renders as a bulleted list.
 * @param {HTMLElement} body
 * @param {string|string[]} message
 */
const renderDialogMessage = (body, message) => {
  const lines = Array.isArray(message) ? message : [message];
  if (lines.length > 1) {
    const ul = document.createElement('ul');
    ul.className = 'mb-0 ps-3';
    for (const line of lines) {
      const li = document.createElement('li');
      li.textContent = line;
      ul.appendChild(li);
    }
    body.appendChild(ul);
  } else {
    const p = document.createElement('p');
    p.className = 'mb-0';
    p.textContent = lines[0] ?? '';
    body.appendChild(p);
  }
};

/**
 * Builds one throwaway modal - the same per-call, dispose-on-hidden idiom
 * showToast() uses for its elements, so two overlapping calls never share
 * mutable state. A cancel button is only added in confirm mode.
 * @param {string|string[]} message
 * @param {boolean} withCancel
 * @returns {{el: HTMLElement, okBtn: HTMLButtonElement, cancelBtn: HTMLButtonElement|null}}
 */
const buildDialogModal = (message, withCancel) => {
  // A short, translated heading rather than a blank bar - together with the
  // colour it names what the bar itself only hints at: a separate dialog
  // landed on top of whatever was already open (e.g. the own-api reader
  // modal), which two same-size, same-position modals stacked on each other
  // would not make obvious on their own.
  const header = document.createElement('div');
  header.className = 'modal-header py-2 bg-warning-subtle';
  const headerText = document.createElement('span');
  headerText.className = 'fw-semibold';
  headerText.textContent = getOptionValue('dialogAttentionLabel', 'Attention');
  header.appendChild(headerText);

  const body = document.createElement('div');
  body.className = 'modal-body';
  renderDialogMessage(body, message);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  let cancelBtn = null;
  if (withCancel) {
    cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.dataset.bsDismiss = 'modal';
    footer.appendChild(cancelBtn);
  }

  const okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.className = 'btn btn-primary';
  okBtn.dataset.bsDismiss = 'modal';
  footer.appendChild(okBtn);

  const content = document.createElement('div');
  // border-2 - thicker than the 1px a Bootstrap modal-content carries by
  // default, so the edge itself reads as a separate surface against whatever
  // is behind it, not just the backdrop dimming.
  content.className = 'modal-content border border-2';
  content.appendChild(header);
  content.appendChild(body);
  content.appendChild(footer);

  const dialog = document.createElement('div');
  // modal-sm - deliberately smaller than the reader modals this can land on
  // top of (own-api-reader, lf-bonuses-reader), so it reads as a popup over
  // them rather than a continuation of the same dialog.
  dialog.className = 'modal-dialog modal-dialog-centered modal-sm';
  dialog.appendChild(content);

  const el = document.createElement('div');
  // dyn-dialog marks this as a dom-utils-built modal, distinct from any
  // template-authored one that might be open at the same time (e.g. the
  // own-api reader stays open behind a validation error).
  el.className = 'modal fade dyn-dialog';
  el.tabIndex = -1;
  el.setAttribute('aria-hidden', 'true');
  el.appendChild(dialog);
  document.body.appendChild(el);

  return { el, okBtn, cancelBtn };
};

/**
 * Blocking replacement for window.alert() - the user pressed something and
 * is waiting for the answer, so a modal backdrop keeps the page inert until
 * it is acknowledged. See docs/patterns.md (g).
 * @param {string|string[]} message - Localised prose (or several lines), already translated by the caller
 * @param {string} [okLabel] - Localised label for the acknowledge button
 * @returns {Promise<void>} resolves once the dialog is dismissed
 */
const showAlertModal = (message, okLabel = 'OK') => new Promise((resolve) => {
  const { el, okBtn } = buildDialogModal(message, false);
  okBtn.textContent = okLabel;

  const modal = bootstrap.Modal.getOrCreateInstance(el, { backdrop: 'static' });
  el.addEventListener('hidden.bs.modal', () => {
    modal.dispose();
    el.remove();
    resolve();
  });
  modal.show();
});

/**
 * Blocking replacement for window.confirm() - see docs/patterns.md (g).
 * Unlike the native dialog this is asynchronous: callers must await it.
 * @param {string|string[]} message - Localised prose, already translated by the caller
 * @param {string} [confirmLabel] - Localised label for the affirmative button
 * @param {string} [cancelLabel] - Localised label for the cancel button
 * @returns {Promise<boolean>} true when the user confirmed, false on cancel/dismiss
 */
const showConfirmModal = (message, confirmLabel = 'Confirm', cancelLabel = 'Cancel') => new Promise((resolve) => {
  const { el, okBtn, cancelBtn } = buildDialogModal(message, true);
  okBtn.textContent = confirmLabel;
  if (cancelBtn) cancelBtn.textContent = cancelLabel;

  let confirmed = false;
  okBtn.addEventListener('click', () => { confirmed = true; });

  const modal = bootstrap.Modal.getOrCreateInstance(el, { backdrop: 'static' });
  el.addEventListener('hidden.bs.modal', () => {
    modal.dispose();
    el.remove();
    resolve(confirmed);
  });
  modal.show();
});

// ==========================================================================
// TABLE HELPERS
// ==========================================================================

/**
 * Get all rows from a table
 * @param {string} tableId - Table ID selector
 * @returns {Array} Array of table row elements
 */
const getTableRows = (tableId) => {
  const table = $(tableId);
  return table ? Array.from(table.querySelectorAll('tr')) : [];
};

/**
 * Get a cell from a table row
 * @param {HTMLTableRowElement} row - TR element
 * @param {number} index - Cell index
 * @returns {HTMLTableCellElement|null}
 */
const getTableCell = (row, index) => {
  return row.cells[index];
};

// The calculator tables put exactly one control in each cell, and the callers
// address it as row.children[n].children[0]. HTMLCollection yields Element,
// which has no value/selectedIndex/style, so these three name the shape the
// markup guarantees instead of casting at every call site.

/**
 * The cell at `column` of a table row.
 * @param {HTMLElement} row - TR element
 * @param {number} column - Cell index
 * @returns {HTMLElement}
 */
const cellAt = (row, column) =>
  /** @type {HTMLElement} */ (row.children[column]);

/**
 * The <input> inside the cell at `column`.
 * @param {HTMLElement} row - TR element
 * @param {number} column - Cell index
 * @returns {HTMLInputElement}
 */
const cellInput = (row, column) =>
  /** @type {HTMLInputElement} */ (row.children[column].children[0]);

/**
 * The <select> inside the cell at `column`.
 * @param {HTMLElement} row - TR element
 * @param {number} column - Cell index
 * @returns {HTMLSelectElement}
 */
const cellSelect = (row, column) =>
  /** @type {HTMLSelectElement} */ (row.children[column].children[0]);

// ==========================================================================
// INSERTION HELPERS
// ==========================================================================

/**
 * Insert HTML at the end of an element
 * @param {string} selector - CSS selector
 * @param {string} html - HTML to insert
 */
const append = (selector, html) => {
  const el = $(selector);
  if (el) el.insertAdjacentHTML('beforeend', html);
};

/**
 * Insert HTML before an element
 * @param {string} selector - CSS selector
 * @param {string} html - HTML to insert
 */
const before = (selector, html) => {
  const el = $(selector);
  if (el) el.insertAdjacentHTML('beforebegin', html);
};

/**
 * Insert HTML after an element
 * @param {string} selector - CSS selector
 * @param {string} html - HTML to insert
 */
const after = (selector, html) => {
  const el = $(selector);
  if (el) el.insertAdjacentHTML('afterend', html);
};

/**
 * Remove an element
 * @param {string} selector - CSS selector
 */
const remove = (selector) => {
  const el = $(selector);
  if (el) el.remove();
};

// ==========================================================================
// ATTRIBUTE HELPERS
// ==========================================================================

/**
 * Get an attribute value
 * @param {string} selector - CSS selector
 * @param {string} attr - Attribute name
 * @returns {string|null}
 */
const getAttr = (selector, attr) => {
  const el = $(selector);
  return el ? el.getAttribute(attr) : null;
};

/**
 * Set an attribute value
 * @param {string} selector - CSS selector
 * @param {string} attr - Attribute name
 * @param {string} value - Attribute value
 */
const setAttr = (selector, attr, value) => {
  const el = $(selector);
  if (el) el.setAttribute(attr, value);
};

/**
 * Remove an attribute
 * @param {string} selector - CSS selector
 * @param {string} attr - Attribute name
 */
const removeAttr = (selector, attr) => {
  const el = $(selector);
  if (el) el.removeAttribute(attr);
};

// ==========================================================================
// VALIDATION HELPERS
// ==========================================================================

/**
 * Attach numeric constraints to an input, by id.
 *
 * The blur validator reads them back off the element as `_constrains`. Setting
 * them through this helper keeps the setup blocks - a dozen fields in a row in
 * some calculators - free of a null check per line, and skips a field the
 * template does not render instead of throwing halfway through the block.
 *
 * @param {string} id - element id
 * @param {Record<string, any>} constrains - min/max/def/allowFloat/allowNegative
 */
const setConstrains = (id, constrains) => {
  const el = document.getElementById(id);
  if (el) el._constrains = constrains;
};

/**
 * Native-DOM equivalent of validateInputNumberOnBlur from utils.js.
 * Clamps the input value to its _constrains min/max on blur and shows the
 * warning div when a constraint is violated. Use this in Bootstrap 5
 * calculators that do not load jQuery.
 *
 * Relies on validateInputNumber, getConstraint, getOptionValue (utils.js)
 * and the dom-utils fadeIn/fadeOut/setTextContent helpers.
 *
 * @param {ValidationEvent} event - The blur event, or a synthesised stand-in
 */
const validateInputNumberOnBlurNative = (event) => {
  validateInputNumber(event);
  const input = /** @type {HTMLInputElement} */ (event.currentTarget);
  const decimalSeparator = getOptionValue('decimalSeparator', '.');

  if (input.value === '-') {
    input.value = '0';
  }
  if (input.value.at(-1) === decimalSeparator) {
    input.value += '0';
  }

  const rawValue = input.value.replace(decimalSeparator, '.');
  const value = Number.parseFloat(rawValue);

  const showWarning = (msg) => {
    const warnDivId = getOptionValue('warnindDivId', null);
    const warnMsgId = getOptionValue('warnindMsgDivId', null);
    if (warnDivId && warnMsgId && msg) {
      const warnDiv = document.getElementById(warnDivId);
      const warnMsgDiv = document.getElementById(warnMsgId);
      if (warnDiv && warnMsgDiv) {
        warnMsgDiv.textContent = msg;

        // Show the warning by adding the visible class
        warnDiv.classList.add('visible');

        // Hide after 5 seconds by removing the visible class
        setTimeout(() => {
          warnDiv.classList.remove('visible');
        }, 3000);
      }
    }
  };

  // Field title for the constraint-warning message. `data-field-title`
  // replaced the invalid `alt` attribute on inputs; keep `alt` as a fallback
  // for inputs that never had the attribute renamed.
  const fieldTitle = input.dataset.fieldTitle || input.alt || '';
  const fieldHint = fieldTitle && getOptionValue('fieldHint', null)
    ? formatString(getOptionValue('fieldHint', null), fieldTitle)
    : '';

  const minConstr = getConstraint(input, 'min', null);
  if (minConstr !== null && value < minConstr) {
    const msgTpl = getOptionValue('msgMinConstraintViolated', null);
    showWarning(msgTpl ? formatString(msgTpl, fieldHint, input.value, minConstr) : null);
    input.value = (minConstr + '').replace('.', decimalSeparator);
  }

  const maxConstr = getConstraint(input, 'max', null);
  if (maxConstr !== null && value > maxConstr) {
    const msgTpl = getOptionValue('msgMaxConstraintViolated', null);
    showWarning(msgTpl ? formatString(msgTpl, fieldHint, input.value, maxConstr) : null);
    input.value = (maxConstr + '').replace('.', decimalSeparator);
  }
};

// ==========================================================================
// INPUT MASKS
// ==========================================================================

/** The character an unfilled digit slot shows. Kept in sync with the
 *  '__.__.____ __:__:__' literals the flight calculator compares against. */
const MASK_BLANK = '_';

/** How many digit slots each token of a locale date/time format stands for. */
const MASK_TOKEN_WIDTHS = { d: 2, m: 2, y: 4, H: 2, s: 2, 9: 1 };

/**
 * Expand a locale format ('d.m.y H:s:s', '99 H:s:s', 'H:s') into a per-character
 * pattern where '9' marks a digit slot and every other character is a literal
 * the caret jumps over.
 * @param {string} format - Format from the locale files
 * @returns {string} e.g. '99.99.9999 99:99:99'
 */
const maskPatternFromFormat = (format) => format.split('')
  .map((ch) => (MASK_TOKEN_WIDTHS[ch] ? '9'.repeat(MASK_TOKEN_WIDTHS[ch]) : ch))
  .join('');

/**
 * Turn a text input into an overtype mask: the field always holds the full
 * skeleton, a typed digit replaces the one under the caret instead of pushing
 * the rest of the text right, and the caret hops over the separators.
 *
 * The field is left genuinely empty while untouched, so its placeholder still
 * shows and the callers' "no value" checks keep working; the skeleton appears
 * on focus and is taken back on blur when nothing was typed.
 *
 * Only the skeleton is enforced — ranges are not, so an out-of-range 99 hours
 * still reaches the calculator's own validation.
 *
 * @param {HTMLInputElement} input - The field to mask
 * @param {string} format - Format from the locale files, e.g. 'd.m.y H:s:s'
 */
const attachInputMask = (input, format) => {
  if (!input || !format || input._inputMask) {
    return;
  }
  const pattern = maskPatternFromFormat(format);
  const blank = pattern.replaceAll('9', MASK_BLANK);
  const isSlot = (i) => pattern[i] === '9';

  /** First digit slot at or after `from`, or the end of the pattern. */
  const nextSlot = (from) => {
    let i = Math.max(0, from);
    while (i < pattern.length && !isSlot(i)) i += 1;
    return i;
  };

  /** Last digit slot before `from`, or -1 when there is none. */
  const prevSlot = (from) => {
    let i = Math.min(from, pattern.length) - 1;
    while (i >= 0 && !isSlot(i)) i -= 1;
    return i;
  };

  /** The current text, padded to the skeleton so slicing is always in range. */
  const current = () => (input.value.length === pattern.length ? input.value : blank);

  const write = (value, pos, ch) => value.slice(0, pos) + ch + value.slice(pos + 1);

  /** Replace every digit slot of [from, to) with the blank character. */
  const erase = (value, from, to) => {
    let out = value;
    for (let i = from; i < to; i += 1) {
      if (isSlot(i)) {
        out = write(out, i, MASK_BLANK);
      }
    }
    return out;
  };

  /** Write `digits` into the slots from `pos` on, skipping the literals. */
  const fill = (value, pos, digits) => {
    let out = value;
    let i = pos;
    for (const digit of digits) {
      i = nextSlot(i);
      if (i >= pattern.length) {
        break;
      }
      out = write(out, i, digit);
      i += 1;
    }
    return { value: out, caret: nextSlot(i) };
  };

  const apply = (value, caret) => {
    input.value = value;
    input.setSelectionRange(caret, caret);
    // The native edit was cancelled, so the listeners the calculator hangs on
    // the field have to be woken up by hand.
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  input.addEventListener('focus', () => {
    if (input.value === '') {
      input.value = blank;
      input.setSelectionRange(0, 0);
    }
  });

  input.addEventListener('blur', () => {
    if (input.value === blank) {
      input.value = '';
    }
  });

  /** Handle a pasted/typed/composed insertion of new text into the field. */
  const handleInsertion = (type, event, value, start, end) => {
    const pastedText = event.dataTransfer ? event.dataTransfer.getData('text') : '';
    const text = type === 'insertFromPaste' ? pastedText : (event.data || '');
    const digits = text.replace(/\D/g, '');
    if (digits === '') {
      return;
    }
    const cleared = end > start ? erase(value, start, end) : value;
    const result = fill(cleared, start, digits);
    apply(result.value, result.caret);
  };

  /** Handle a selection erase or a forward/backward single-slot delete. */
  const handleDeletion = (type, value, start, end) => {
    if (end > start) {
      apply(erase(value, start, end), start);
      return;
    }
    if (type.endsWith('Forward')) {
      const slot = nextSlot(start);
      if (slot < pattern.length) {
        apply(write(value, slot, MASK_BLANK), slot);
      }
      return;
    }
    const slot = prevSlot(start);
    if (slot >= 0) {
      apply(write(value, slot, MASK_BLANK), slot);
    }
  };

  input.addEventListener('beforeinput', (event) => {
    const type = event.inputType;
    const value = current();
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    event.preventDefault();

    if (type === 'insertText' || type === 'insertFromPaste' || type === 'insertCompositionText') {
      handleInsertion(type, event, value, start, end);
      return;
    }
    if (type.startsWith('delete')) {
      handleDeletion(type, value, start, end);
    }
  });

  input._inputMask = { pattern, blank };
};

/**
 * Whether a masked field carries no digits yet — either untouched or wiped back
 * to the bare skeleton. Unmasked fields count as blank when empty.
 * @param {HTMLInputElement} input - The field to test
 * @returns {boolean}
 */
const isMaskBlank = (input) => !input || input.value === '' || !/\d/.test(input.value);

// ==========================================================================
// EXPORT TO WINDOW
// ==========================================================================

// Make all helper functions available globally for the costs calculator
if (typeof window !== 'undefined') {
  Object.assign(window, {
    // Selectors
    $,
    $$,
    inputEl,
    selectEl,
    tableEl,
    inputsAll,
    checkedRadio,
    globalThisRecord,

    // Values
    getVal,
    setVal,
    setNumVal,
    getChecked,
    setChecked,

    // Content
    getTextContent,
    setTextContent,
    getHtml,
    setHtml,

    // Classes
    addClass,
    removeClass,
    toggleClass,
    hasClass,

    // Events
    addEvent,
    removeEvent,
    removeAllEvents,

    // Visibility
    show,
    hide,
    fadeIn,
    fadeOut,

    // Toasts
    showToast,

    // Blocking dialogs
    showAlertModal,
    showConfirmModal,

    // Tables
    getTableRows,
    getTableCell,
    cellAt,
    cellInput,
    cellSelect,

    // Insertion
    append,
    before,
    after,
    remove,

    // Attributes
    getAttr,
    setAttr,
    removeAttr,

    // Validation
    setConstrains,
    validateInputNumberOnBlurNative,

    // Input masks
    maskPatternFromFormat,
    attachInputMask,
    isMaskBlank
  });
}
