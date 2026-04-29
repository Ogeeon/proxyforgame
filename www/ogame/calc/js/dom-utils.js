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
 * @param {string} selector - CSS selector
 * @returns {Element|null}
 */
const $ = (selector) => document.querySelector(selector);

/**
 * Query selector all - returns all matching elements
 * @param {string} selector - CSS selector
 * @returns {NodeList}
 */
const $$ = (selector) => document.querySelectorAll(selector);

// ==========================================================================
// VALUE HELPERS
// ==========================================================================

/**
 * Get the value of an input element
 * @param {string} selector - CSS selector
 * @returns {string}
 */
const getVal = (selector) => {
  const el = $(selector);
  return el ? (el.value || '') : '';
};

/**
 * Set the value of an input element
 * @param {string} selector - CSS selector
 * @param {string|number} value - Value to set
 */
const setVal = (selector, value) => {
  const el = $(selector);
  if (el) el.value = value;
};

/**
 * Get the checked state of a checkbox/radio
 * @param {string} selector - CSS selector
 * @returns {boolean}
 */
const getChecked = (selector) => {
  const el = $(selector);
  return el ? el.checked : false;
};

/**
 * Set the checked state of a checkbox/radio
 * @param {string} selector - CSS selector
 * @param {boolean} checked - Checked state
 */
const setChecked = (selector, checked) => {
  const el = $(selector);
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
 * @param {boolean} force - Optional force state
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
 * @param {Function} handler - Event handler
 * @returns {Function} The handler function for later removal
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
 * @param {Function} handler - Event handler to remove
 */
const removeEvent = (selector, event, handler) => {
  const el = typeof selector === 'string' ? $(selector) : selector;
  if (!el || !el._eventHandlers) return;

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
  if (!el || !el._eventHandlers) return;

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

  // For Bootstrap modals
  if (el.classList.contains('modal')) {
    const modal = new bootstrap.Modal(el);
    modal.show();
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
 * @param {Function} callback - Optional callback
 */
const fadeIn = (selector, duration = 400, callback) => {
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
 * @param {Function} callback - Optional callback
 */
const fadeOut = (selector, duration = 400, callback) => {
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
 * @param {Element} row - TR element
 * @param {number} index - Cell index
 * @returns {Element|null}
 */
const getTableCell = (row, index) => {
  return row.cells[index];
};

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
 * Native-DOM equivalent of validateInputNumberOnBlur from utils.js.
 * Clamps the input value to its _constrains min/max on blur and shows the
 * warning div when a constraint is violated. Use this in Bootstrap 5
 * calculators that do not load jQuery.
 *
 * Relies on validateInputNumber, getConstraint, getOptionValue (utils.js)
 * and the dom-utils fadeIn/fadeOut/setTextContent helpers.
 *
 * @param {Event} event - The blur event
 */
const validateInputNumberOnBlurNative = (event) => {
  validateInputNumber(event);
  let needRecalc = false;
  const input = event.currentTarget;
  const decimalSeparator = getOptionValue('decimalSeparator', '.');

  if (input.value === '-') {
    input.value = '0';
    needRecalc = true;
  }
  if (input.value.charAt(input.value.length - 1) === decimalSeparator) {
    input.value += '0';
    needRecalc = true;
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

  const fieldTitle = input.alt || '';
  const fieldHint = fieldTitle && getOptionValue('fieldHint', null)
    ? getOptionValue('fieldHint', null).format(fieldTitle)
    : '';

  const minConstr = getConstraint(input, 'min', null);
  if (minConstr !== null && value < minConstr) {
    const msgTpl = getOptionValue('msgMinConstraintViolated', null);
    showWarning(msgTpl ? msgTpl.format(fieldHint, input.value, minConstr) : null);
    input.value = (minConstr + '').replace('.', decimalSeparator);
    needRecalc = true;
  }

  const maxConstr = getConstraint(input, 'max', null);
  if (maxConstr !== null && value > maxConstr) {
    const msgTpl = getOptionValue('msgMaxConstraintViolated', null);
    showWarning(msgTpl ? msgTpl.format(fieldHint, input.value, maxConstr) : null);
    input.value = (maxConstr + '').replace('.', decimalSeparator);
    needRecalc = true;
  }

  if (needRecalc && event?.data) {
    // eslint-disable-next-line no-eval
    eval(event.data).apply(input);
  }
};

// ==========================================================================
// EXPORT TO WINDOW
// ==========================================================================

// Make all helper functions available globally for the costs calculator
if (typeof window !== 'undefined') {
  Object.assign(window, {
    // Selectors
    $,
    $$,

    // Values
    getVal,
    setVal,
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

    // Tables
    getTableRows,
    getTableCell,

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
    validateInputNumberOnBlurNative
  });
}
