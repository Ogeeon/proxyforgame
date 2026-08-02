/**
 * Returns the number contained in the passed string, stripping everything except digits, the "-" sign and the decimal separator.
 * If the passed string has no valid characters at all, returns an empty string.
 * @param s string containing the number
 * @param allowNeg flag - whether negative values are allowed
 * @param sepCode character code acting as the decimal separator
 */
function getCorrectedValue (s, allowNeg, sepCode) {
	let sxx = "";
	s += "";
	const sx = s.toUpperCase ();
	let firstDigit = true;
	let firstSeparator = true;
	let signFound = false;
	let nextCharCode = 0;
	for (let i = 0; i < sx.length; i++) {
		nextCharCode = (i === sx.length-1) ? 0 : sx.codePointAt(i+1);
		if ((sx.codePointAt (i) >= 49 && sx.codePointAt (i) <= 57) ||
			(sx.codePointAt (i) === 48 && (sx.length === 1 || !firstDigit || nextCharCode === sepCode))) {
			sxx += sx.charAt (i);
			firstDigit = false;
		}
		else if (sx.codePointAt (i) === 45 && firstDigit && ! signFound)
			signFound = true;
		else if (sx.codePointAt (i) === sepCode && firstSeparator) {
			sxx += sx.charAt (i);
			firstSeparator = false;
		}
	}
	if (signFound && allowNeg)
		sxx = "-" + sxx;
	return sxx;
}

/**
 * Validates the number contained in the input against the given constraints (whether negative values and floating-point values are allowed).
 * The input the function is called for is taken from the context via this.
 * @param event Event whose currentTarget is the input being validated. Callers that need to recalculate afterwards do so themselves.
 */
function validateInputNumber (event) {
	const input = event.currentTarget;
	const allowNeg = getConstraint(input, 'allowNegative', false);
	const decimalSeparator = getOptionValue('decimalSeparator', '.');
	// If the field allows floating-point values, take the decimal separator code from the settings; otherwise use -1 so the character-by-character comparison never treats it as a valid character.
	const sepCode = getConstraint(input, 'allowFloat', false) ? decimalSeparator.codePointAt(0) : -1;
	if (input.value.charAt(0) === decimalSeparator) {
		input.value = '0' + input.value;
	}
	if (input.value !== getCorrectedValue (input.value, allowNeg, sepCode)) {
		input.value = getCorrectedValue (input.value, allowNeg, sepCode);
	}
	if (input.value === '') {
		input.value = getConstraint(input, 'def', 0);
		input.select();
	}
}

/**
 * Checks that num is a number and falls within the given range. If everything is fine, returns the number itself, otherwise the default value.
 * @param num the number being checked
 * @param min minimum allowed value
 * @param max maximum allowed value
 * @param def default value
 */
function validateNumber(num, min, max, def) {
	return (!Number.isNaN(num) && num >= min && num <= max) ? num : def;
}

/**
 * Formats a number OGame-style, inserting a dot as the thousands separator.
 * If the number has significant digits in the fractional part, they are dropped.
 */
function numToOGame(n) {
	n = dropFraction(n, 3);
	n += '';
	const rgx = /(\d+)(\d{3})/;
	while (rgx.test(n)) {
		n = n.replace(rgx, '$1' + '.' + '$2');
	}
	return n;
}

/**
 * Clamps a number to the [min, max] range. If the number is outside either bound of the range, it is clamped to that bound.
 * @param n the original number
 * @param min minimum allowed value of the number
 * @param max maximum allowed value of the number
 * @return the value fitted into the given range
 */
function clampNumber(n, min, max) {
	if (n > max)
		n = max;
	else if (n < min)
		n = min;
	return n;
}

/**
 * Prints the string str to the debug console.
 */
function consoleLog(str) {
	if (typeof console != 'undefined') console.log(str);
}

/**
 * Checks that the value exists.
 */
function isset(e) {
	return e !== undefined;
}

/**
 * Parses the number value from the given input element
 * @param input
 */
function getInputNumber(input) {
	let decimalSeparator = getOptionValue('decimalSeparator', '.');
	let n = 0;
	try {
		n = Number.parseFloat(input.value.replace(decimalSeparator, '.'));
	} catch (e) {
		consoleLog(e);
	}
	return Number.isNaN(n) ? 0 : n;
}

/**
 * Replaces occurrences of the form {n} in a string with elements from the function's argument array.
 */
function formatString(str, ...args) {
    const pattern = /\{\d+\}/g;
    // The index used to be the RegExp match array itself, which worked only
    // because ["3"].toString() is "3". The capture is always "{<digits>}", so
    // stripping the braces gets the same number without a second regex whose
    // result would have to be null-checked.
    return str.replace(pattern, (capture) => args[Number(capture.slice(1, -1))]);
}

/**
 * Returns a value from the options array, or the default value if options.opt is not found.
 * @param opt key into the options array
 * @param def default value
 */
function getOptionValue(opt, def) {
	if (options[opt] === undefined)
		return def;
	else
		return options[opt];
}

/**
 * Returns the constraint set on the field, or the default value if neither the field itself nor the options array has such a constraint.
 * @param element id of the field the constraint is requested for
 * @param constr name of the constraint
 * @param def default value
 */
function getConstraint(element, constr, def) {
	const el = (typeof element === 'string') ? document.getElementById(element) : element;
	const constraints = el ? el._constrains : undefined;
	// If the constraint isn't found on the field's own properties, try to take it from options - if it's not there either, return the default value
	if (constraints === undefined) {
		if (options.defConstraints === undefined)
			return def;
		else
			return options.defConstraints[constr];
	} else {
		return (constraints[constr] === undefined) ? def : constraints[constr];
	}
}

/**
 * Appends "<wholeUnits><label> " to timeStr when the tier holds at least one whole unit;
 * returns timeStr unchanged otherwise (a zero-value middle tier is left out, not shown as "0x").
 */
function appendTimespanUnit(timeStr, seconds, divisor, label) {
	if (seconds / divisor < 1)
		return timeStr;
	return timeStr + dropFraction(Math.floor(seconds / divisor), 3) + label + ' ';
}

/**
 * Builds a string representation of a time span. If some unit (weeks, days, hours, minutes, seconds) is zero, it is omitted from the returned string.
 * @param seconds Number of seconds in the time span
 * @param w Label for weeks
 * @param d Label for days
 * @param h Label for hours
 * @param m Label for minutes
 * @param s Label for seconds
 * @param [minimize] Flag indicating that minutes and seconds should be dropped if the time span is longer than a week
 * @returns String of the form [Xw] [Xd] [Xh] [Xm] [Xs]
 */
function timespanToShortenedString(seconds, w, d, h, m, s, minimize) {
	if (seconds == 0)
		return '0'+s;
	let timeStr = '';
	let haveWeeks = false, haveDays = false;
	if (seconds >= 604800) {
		timeStr = appendTimespanUnit(timeStr, seconds, 604800, w);
		seconds = seconds % 604800;
		haveWeeks = true;
	}
	if (seconds >= 86400 || timeStr.length > 0) {
		timeStr = appendTimespanUnit(timeStr, seconds, 86400, d);
		seconds = seconds % 86400;
		haveDays = true;
	}
	if (seconds >= 3600 || timeStr.length > 0) {
		timeStr = appendTimespanUnit(timeStr, seconds, 3600, h);
		seconds = seconds % 3600;
	}
	// If there are weeks and minimization was requested - drop the minutes
	if (minimize && haveWeeks)
		return timeStr;
	if (seconds >= 60 || timeStr.length > 0) {
		timeStr = appendTimespanUnit(timeStr, seconds, 60, m);
		seconds = seconds % 60;
	}
	// If there are days and minimization was requested - drop the seconds
	if (minimize && haveDays)
		return timeStr;
	if (seconds > 0) {
		timeStr += Math.floor(seconds);
		timeStr += s;
	}
	return timeStr;
}

function numberToShortenedString(number, suffixes) {
	let value = 0, suff = '';
	value = number;
	if (number >= 1000000000) {
		value = 0.001 * Math.floor(value / 1000000.0);
		suff = suffixes.substring(2, 3);
	} else if (number >= 1000000) {
		value = 0.001 * Math.floor(value / 1000.0);
		suff = suffixes.substring(1, 2);
	}
	value = dropFraction(value, 3);
	return numToOGame(value)+suff;
}

/**
 * Format a numeric value either as a full OGame-style number or as a shortened string.
 *
 * The returned format depends on the global flag `options.prm.fullNumbers`:
 * - If truthy, the value is formatted using `numToOGame(num)` (full formatting).
 * - Otherwise, the value is converted using `numberToShortenedString(num, suffix)` (shortened form).
 *
 * @param {number} num - The numeric value to format.
 * @param {string} [suffix] - Optional suffix passed to the shortening helper (e.g. "K", "M").
 *                            Ignored when `options.prm.fullNumbers` is truthy.
 * @returns {string} A formatted string representing the number, either full or shortened.
 * @see options.prm.fullNumbers
 * @see numToOGame
 * @see numberToShortenedString
 * @example
 * // When fullNumbers is true:
 * // ogamizeNum(1234567) -> "1.234.567" (format depends on numToOGame implementation)
 *
 * // When fullNumbers is false:
 * // ogamizeNum(1500000, "M") -> "1.5M" (format depends on numberToShortenedString implementation)
 */
function ogamizeNum(num, suffix) {
	if (options.prm.fullNumbers)
		return numToOGame(num);
	else
		return numberToShortenedString(num, suffix);
}

function dropFraction(number, positions) {
	let value = number;
	const parts = (number+'').split(/\./);
	if (parts.length > 1 && parts[1].length > positions) {
		const frac = parts[1].substring(0, positions);
		value = parts[0] + '.' + frac;
		if (parts[1].indexOf('e') > 0){
			const fracParts = parts[1].split(/e/);
			value += 'e'+fracParts[1];
		}
	}
	return value;
}

/**
 * Pads a string to the given length
 * @param input Input string
 * @param pad_length Required string length
 * @param pad_string String used for padding
 * @param pad_type Direction - right, left, both sides. One of the constants 'STR_PAD_LEFT', 'STR_PAD_RIGHT', 'STR_PAD_BOTH'
 * @returns The padded string
 */
function str_pad_repeater(s, len) {
	let collect = '';

	while (collect.length < len) collect += s;
	collect = collect.substring(0, len);

	return collect;
}

function strPad(input, pad_length, pad_string, pad_type) {
	let half = '', pad_to_go;
	input += '';
	if (pad_type != 'STR_PAD_LEFT' && pad_type != 'STR_PAD_RIGHT' && pad_type != 'STR_PAD_BOTH') { pad_type = 'STR_PAD_RIGHT'; }
	if ((pad_length - input.length) > 0) {
		pad_to_go = pad_length - input.length;
		if (pad_type == 'STR_PAD_LEFT') { input = str_pad_repeater(pad_string, pad_to_go) + input; }
		else if (pad_type == 'STR_PAD_RIGHT') { input = input + str_pad_repeater(pad_string, pad_to_go); }
		else if (pad_type == 'STR_PAD_BOTH') {
			half = str_pad_repeater(pad_string, Math.ceil(pad_to_go/2));
			input = half + input + half;
			input = input.substring(0, pad_length);
		}
	}
	return input;
}

function dayOfMonth(day, month, year) {
	const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	if (month < 1 || month > 12)
		return false;
	const isLeap = (year % 400 === 0) || (year % 4 === 0 && year % 100 !== 0);
	if (isLeap)
		days[1] = 29;
	if (day < 1 || day > days[month-1])
		return false;
	return true;
}

/**
 * Parses a date/time from a string. Tailored for an inputmask field with definitions 'm.d.y H:s:s' and 'd.m.y H:s:s'
 * @param str Field content obtained via the inputmask('unmaskedvalue') method
 * @param template Date definition
 * @returns Number of milliseconds since the epoch (result of Date.parse() on the processed string)
 */
function parseDate(str, template) {
	// Since only two date definitions are used with inputmask here - 'm.d.y H:s:s' and 'd.m.y H:s:s' -
	// it is enough to compare the passed template against the reference and decide how to parse the date
	// The inputmask('unmaskedvalue') method returns the content either as "ddmmyyyyhhmmss" or "dd.mm.yyyy hh:mm:ss". The regexes must match accordingly
	const rgx1 = /^(\d{2})(\d{2})(\d{4})(\d{2})(\d{2})(\d{2})$/;
	const rgx2 = /^(\d{2})\.(\d{2})\.(\d{4})\s(\d{2}):(\d{2}):(\d{2})$/;
	let pts;
	if (str.search(/\./)>0) {
		pts = rgx2.exec(str);
	}
	else {
		pts = rgx1.exec(str);
	}
	if (pts == null){
		return 0;
	}
	const h = Number.parseInt(pts[4], 10), m = Number.parseInt(pts[5], 10), s = Number.parseInt(pts[6], 10);
	if (h > 23 || m > 59 || s > 59)
		return 0;
	let t;
	// Parse the date/time, placing the elements in the required positions. If the day+month combination is invalid, consider the date unparsed.
	if (template == 'm.d.y H:s:s') {
		t = Date.parse(pts[1] + "/" + pts[2] + "/" + pts[3] + " " + pts[4] + ":" + pts[5]  + ":" + pts[6]);
		if (!dayOfMonth(pts[2], pts[1], pts[3]))
			t = 0;
	}
	else {
		t = Date.parse(pts[2] + "/" + pts[1] + "/" + pts[3] + " " + pts[4] + ":" + pts[5]  + ":" + pts[6]);
		if (!dayOfMonth(pts[1], pts[2], pts[3]))
			t = 0;
	}
	return t;
}

/**
 * Builds a date/time string
 * @param time Number of milliseconds since the epoch
 * @param template Date definition for the inputmask field ('m.d.y H:s:s' or 'd.m.y H:s:s')
 * @returns String representation of the date with the elements in the required order
 */
function getDateStr(time, template) {
	if (time == 0)
		return '';
	// Since only two date definitions are used with inputmask here - 'm.d.y H:s:s' and 'd.m.y H:s:s' -
	// it is enough to compare the passed template against the reference and decide how to build the date
	const date = new Date();
	date.setTime(time);
	const year = date.getFullYear();
	const month = strPad(date.getMonth() + 1, 2, '0', 'STR_PAD_LEFT');
	const day = strPad(date.getDate(), 2, '0', 'STR_PAD_LEFT');
	const hours = strPad(date.getHours(), 2, '0', 'STR_PAD_LEFT');
	const minutes = strPad(date.getMinutes(), 2, '0', 'STR_PAD_LEFT');
	const seconds = strPad(date.getSeconds(), 2, '0', 'STR_PAD_LEFT');
	if (template == 'm.d.y H:s:s')
		return month+'.'+day+'.'+year+' '+hours+':'+minutes+':'+seconds;
	else
		return day+'.'+month+'.'+year+' '+hours+':'+minutes+':'+seconds;
}

/**
 * Builds a time string in HH:MM format
 * @param time Number of seconds
 * @returns String representation of the time in H:s format
 */
function getTimeStr(time) {
	const date = new Date();
	date.setTime(0);
	date.setSeconds(time, 0);
	const hours = strPad(date.getUTCHours(), 2, '0', 'STR_PAD_LEFT');
	const minutes = strPad(date.getUTCMinutes(), 2, '0', 'STR_PAD_LEFT');
	return hours+':'+minutes;
}

function supports_html5_storage() {
	try {
		return 'localStorage' in window && window['localStorage'] !== null;
	} catch (e) {
		return false;
	}
}

/**
 * Saves the fields of the passed object into a cookie named name.
 * "key;value" pairs are saved, separated by commas. If an object field is an array, the key takes the form "property|index1|index2". Functions are ignored.
 * @param name - name of the cookie the data will be saved into
 * @param data - object whose properties (fields) need to be saved into the cookie
 */
function saveToCookie(name, data) {
	let saveStr = 'key-value;true,';
	Object.keys(data).forEach(function(key) {
			if (typeof data[key] === 'function') {
				return;
			}
			if (typeof data[key] === 'object' && data[key] !== null && !Array.isArray(data[key])) {
				// Handle plain objects by JSON encoding
				saveStr += key+';__JSON__'+JSON.stringify(data[key])+',';
				return;
			}
			if (Array.isArray(data[key])) {
				const arr = data[key];
				for (let i = 0; i < arr.length; i++) {
					if (Array.isArray(arr[i])) {
						const row = arr[i];
						for (let j = 0; j < row.length; j++) {
							saveStr += key+'|'+i+'|'+j+';'+row[j]+',';
						}
					}
					else {
						saveStr += key+'|'+i+';'+arr[i]+',';
					}
				}
				return;
			}
			saveStr += key+';'+data[key]+',';
		}
	);
	saveStr = saveStr.substring(0, saveStr.length-1); // the last character is a comma and is not needed
	if (supports_html5_storage()) {
		try {
			localStorage.setItem(name, saveStr);
			// Clear old cookie if exists
			document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
		} catch (e) {
			// Quota exceeded - fallback to cookie
			consoleLog(e);
			const d = new Date();
			d.setTime(d.getTime() + (365*24*60*60*1000));
			document.cookie = name + '=' + encodeURIComponent(saveStr) + '; expires=' + d.toUTCString() + '; path=/';
		}
	} else {
		const d = new Date();
		d.setTime(d.getTime() + (365*24*60*60*1000));
		document.cookie = name + '=' + encodeURIComponent(saveStr) + '; expires=' + d.toUTCString() + '; path=/';
	}
}


/** Reads a value previously written by saveToCookie: localStorage first, legacy cookie as fallback. */
function readSavedData(name) {
	const stored = loadFromStorage(name);
	if (stored !== null)
		return stored;
	const cookies = document.cookie.split(';');
	for (const rawCookie of cookies) {
		const cookie = rawCookie.trim();
		if (cookie.startsWith(name + '=')) {
			return decodeURIComponent(cookie.substring(name.length + 1));
		}
	}
	return null;
}

/** Applies a "property|index1|index2;value" entry (array/matrix field) onto params. */
function applyCookieArrayEntry(params, parts) {
	const arrparts = parts[0].split('|');
	if (!(arrparts[0] in params))
		return;
	if (arrparts.length == 2) {
		params[arrparts[0]][arrparts[1]] = params.validate(arrparts[0], parts[1]);
	}
	if (arrparts.length == 3) {
		if (params[arrparts[0]][arrparts[1]] === undefined)
			params[arrparts[0]].push([]);
		params[arrparts[0]][arrparts[1]][arrparts[2]] = params.validate(arrparts[0], parts[1]);
	}
}

/** Applies one "key;value" entry from a loadFromCookie payload onto params. */
function applyCookieEntry(params, entry) {
	const parts = entry.split(';');
	if (parts[0].indexOf('|') > 0) {
		applyCookieArrayEntry(params, parts);
		return;
	}
	if (!(parts[0] in params))
		return;
	if (parts[1]?.indexOf('__JSON__') === 0) {
		try {
			// Remove __JSON__ prefix and rejoin in case semicolons were in the JSON
			const jsonStr = parts.slice(1).join(';').substring(8);
			params[parts[0]] = JSON.parse(jsonStr);
			return;
		} catch (e) {
			// If JSON parsing fails, fall through to validate below
			consoleLog(e);
		}
	}
	params[parts[0]] = params.validate(parts[0], parts[1]);
}

function loadFromCookie(name, params) {
	const data = readSavedData(name);
	if (!data?.includes('key-value'))
		return;
	data.split(',').forEach(function(entry) {
		applyCookieEntry(params, entry);
	});
}

/**
* Tries to read the requested data from local HTML5 storage.
*/
function loadFromStorage(name) {
	let data = null;
	if (supports_html5_storage())
		data = localStorage.getItem(name);
	return data;
}

/**
 * Reads a single cookie value by name. Returns null when the cookie is absent.
 * @param name - cookie name
 */
function getCookie(name) {
	const prefix = name + '=';
	const cookies = document.cookie.split(';');
	for (const rawCookie of cookies) {
		const cookie = rawCookie.trim();
		if (cookie.startsWith(prefix)) {
			return decodeURIComponent(cookie.substring(prefix.length));
		}
	}
	return null;
}

/**
 * Writes a cookie that expires in the given number of days.
 * @param name - cookie name
 * @param value - cookie value (URI-encoded before storing)
 * @param days - lifetime in days
 */
function setCookie(name, value, days) {
	const d = new Date();
	d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
	document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + d.toUTCString() + '; path=/';
}

/**
 * The light/dark theme checkbox in the sidebar.
 * @returns {HTMLInputElement}
 */
function themeCheckbox() {
	return /** @type {HTMLInputElement} */ (document.getElementById('cb-light-theme'));
}

/**
 * Replaces the decimal separator in the string representation of the given number with the one set in the settings
 */
function localizeFloat(input, decimalDigits) {
	let result = String(input);
	let decimalSeparator = getOptionValue('decimalSeparator', '.');
	
	// Handle decimal digit limiting if specified
	if (decimalDigits !== undefined) {
		const dotIndex = result.indexOf('.');
		if (dotIndex !== -1) {
			result = result.substring(0, dotIndex + decimalDigits + 1);
		}
	}
	
	// Replace decimal separator if needed
	if (decimalSeparator != '.') {
		result = result.replace('.', decimalSeparator);
	}
	
	return result;
}

function toggleLightBS(on) {
	const theme = { value: 'light' };
	const html = document.documentElement;
	if (on) {
		themeCheckbox().checked = true;
		html.dataset.bsTheme = 'light';
		theme.value = 'light';
		saveToCookie("theme", theme);
	} else {
		themeCheckbox().checked = false;
		html.dataset.bsTheme = 'dark';
		theme.value = 'dark';
		saveToCookie("theme", theme);
	}	
}

function frac(x, n) {
    const pow = Math.pow(10, n);
    return Math.round(x * pow) / pow;
}
