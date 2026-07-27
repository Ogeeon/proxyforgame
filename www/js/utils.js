/**
 * Возвращает содержащееся в переданной строке число, вырезая всё, кроме цифр, знака "-" и десятичного разделителя.
 * Если в переданной строке нет ни одного допустимого символа, возвращает пустую строку.
 * @param s строка, содержащая число
 * @param allowNeg флаг - допустимы ли отрицательные значения
 * @param sepCode код символа, выступающего десятичным разделителем
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
		nextCharCode = (i === sx.length-1) ? 0 : sx.charCodeAt(i+1);
		if ((sx.charCodeAt (i) >= 49 && sx.charCodeAt (i) <= 57) ||
			(sx.charCodeAt (i) === 48 && (sx.length === 1 || !firstDigit || nextCharCode === sepCode))) {
			sxx += sx.charAt (i);
			firstDigit = false;
		}
		else if (sx.charCodeAt (i) === 45 && firstDigit && ! signFound)
			signFound = true;
		else if (sx.charCodeAt (i) === sepCode && firstSeparator) {
			sxx += sx.charAt (i);
			firstSeparator = false;
		}
	}
	if (signFound && allowNeg)
		sxx = "-" + sxx;
	return sxx;
}

/**
 * Проверяет содержащееся в input-e число на соответствие заданным ограничениям (допустимость отрицательных значений, значений с плавающей точкой).
 * Input, для которого вызывается функция, берётся из контекста через this.
 * @param event Данные о событии. Поле event.data может содержать имя функции, которую нужно вызвать по завершению проверки.
 */
function validateInputNumber (event) {
	const input = event.currentTarget;
	const allowNeg = getConstraint(input, 'allowNegative', false);
	const decimalSeparator = getOptionValue('decimalSeparator', '.');
	// Если в поле можно вводить значения с плавающей точкой, то код десятичного разделителя берём из настроек, иначе примем его равным -1, чтобы посимвольное сравнение не приняло его за допустимый символ.
	const sepCode = getConstraint(input, 'allowFloat', false) ? decimalSeparator.charCodeAt(0) : -1;
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
	// После проверки надо вызвать функцию, имя которой передано в свойствах события. На всякий случай вызовем её в контексте обрабатываемого поля ввода
	if (event?.data != null)
		eval(event.data).apply(input);
}

/**
 * Проверяет, что num является числом и попадает в заданый диапазон. Если все ок, возвращается само число, иначе значение по умолчанию.
 * @param num проверяемое число
 * @param min минимальное допустимое значение
 * @param max макисимальное допустимое значение
 * @param def значение по умолчанию
 */
function validateNumber(num, min, max, def) {
	return (!isNaN(num) && num >= min && num <= max) ? num : def;
}

/**
 * Форматирует число в стиле ОГейма - проставляя точку в качестве разделителя тысяч.
 * Если пришло число со значащими цифрами в дробной части, они отбрасываются.
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
 * Обрезает число до диапазона [min, max]. Если число выходит за одну из границ диапазона, то оно обрезается по этой границе.
 * @param n исходное число
 * @param min минимальное допустимое значение числа
 * @param max максимальное допустимое значение числа
 * @return вписанное в указанный диапазон значение
 */
function clampNumber(n, min, max) {
	if (n > max)
		n = max;
	else if (n < min)
		n = min;
	return n;
}

/**
 * Выводит строку str в отладочную консоль.
 */
function consoleLog(str) {
	if (typeof console != 'undefined') console.log(str);
}

/**
 * Проверяет, что значение существует.
 */
function isset(e) {
	return e !== undefined;
}

/**
 * Парсит значение числа из указанного элемента input
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
	return isNaN(n) ? 0 : n;
}

/**
 * Заменяет в строке вхождения вида {n} на элементы массива аргументов функции.
 */
function formatString(str, ...args) {
    const pattern = /\{\d+\}/g;
    return str.replace(pattern, function(capture){ return args[capture.match(/\d+/)]; });
}

/**
 * Возвращает значение из массива options или значение по умолчанию, если элемент options.opt не найден.
 * @param opt ключ для массива options
 * @param def значение по умолчанию
 */
function getOptionValue(opt, def) {
	if (options[opt] === undefined)
		return def;
	else
		return options[opt];
}

/**
 * Возвращает ограничение, установленное для поля, или значение по умолчанию, если на самом поле и в массиве options такого ограничения нет.
 * @param element id поля, для которого запрашивается ограничение
 * @param constr название ограничения
 * @param def значение по умолчанию
 */
function getConstraint(element, constr, def) {
	const el = (typeof element === 'string') ? document.getElementById(element) : element;
	const constraints = el ? el._constrains : undefined;
	// Если не найдём ограничения в свойствах самого поля, поробуем вязть из options - если и там нет, вернём значение по умолчанию
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
 * Формирует строковое представление для промежутка времени. Если какого-то элемента (нед, д, ч, м, с) нет, он не включается в возвращаемую строку.
 * @param seconds Кол-во секунд в промежутке времени
 * @param w Обозначение недель
 * @param d Обозначение дней
 * @param h Обозначение часов
 * @param m Обозначение минут
 * @param s Обозначение секунд
 * @param minimize Признак того, что нужно отбрасывать минуты и секунды, если промежуток времени больше недели
 * @returns Строка вида [Xw] [Xd] [Xh] [Xm] [Xs]
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
	// Если есть недели, и запрошена минимизация - минуты отбрасываем
	if (minimize && haveWeeks)
		return timeStr;
	if (seconds >= 60 || timeStr.length > 0) {
		timeStr = appendTimespanUnit(timeStr, seconds, 60, m);
		seconds = seconds % 60;
	}
	// Если есть дни, и запрошена минимизация - секунды отбрасываем
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
		suff = suffixes.substr(2, 1);
	} else if (number >= 1000000) {
		value = 0.001 * Math.floor(value / 1000.0);
		suff = suffixes.substr(1, 1);
	}
	value = dropFraction(value, 3);
	return numToOGame(value)+suff;
}

function dropFraction(number, positions) {
	let value = number;
	const parts = (number+'').split(/\./);
	if (parts.length > 1 && parts[1].length > positions) {
		const frac = parts[1].substr(0, positions);
		value = parts[0] + '.' + frac;
		if (parts[1].indexOf('e') > 0){
			const fracParts = parts[1].split(/e/);
			value += 'e'+fracParts[1];
		}
	}
	return value;
}

/**
 * Дополняет строку до указанной длины
 * @param input Входная строка
 * @param pad_length Требуемая длина строки
 * @param pad_string Строка, используемая для дополнения
 * @param pad_type Направление - справа, слева, с обеих сторон. Одна из констант 'STR_PAD_LEFT', 'STR_PAD_RIGHT', 'STR_PAD_BOTH'
 * @returns Изменённая строка
 */
function str_pad_repeater(s, len) {
	let collect = '';

	while (collect.length < len) collect += s;
	collect = collect.substr(0, len);

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
			input = input.substr(0, pad_length);
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
 * Парсит дату/время из строки. Заточено для поля inputmask с определениями 'm.d.y H:s:s' и 'd.m.y H:s:s'
 * @param str Содержимое поля, полученное методом inputmask('unmaskedvalue')
 * @param template Определение даты
 * @returns Кол-во миллисекунд с начала эпохи (результат работы Date.parse() на обработанной строке)
 */
function parseDate(str, template) {
	// Поскольку у нас в inputmask используются только два определения даты - 'm.d.y H:s:s' и 'd.m.y H:s:s',
	// достаточно сравнить переданный шаблон с эталоном и определиться, как парсить дату
	// Метод inputmask('unmaskedvalue') возвращает содержимое то в виде "ddmmyyyyhhmmss", то "dd.mm.yyyy hh:mm:ss". Регекспы надо использовать соответствующие
	const rgx1 = /^(\d{2})(\d{2})(\d{4})(\d{2})(\d{2})(\d{2})$/;
	const rgx2 = /^(\d{2})\.(\d{2})\.(\d{4})\s(\d{2}):(\d{2}):(\d{2})$/;
	let pts;
	if (str.search(/\./)>0) {
		pts = str.match(rgx2);
	}
	else {
		pts = str.match(rgx1);
	}
	if (pts == null){
		return 0;
	}
	const h = Number.parseInt(pts[4], 10), m = Number.parseInt(pts[5], 10), s = Number.parseInt(pts[6], 10);
	if (h > 23 || m > 59 || s > 59)
		return 0;
	let t;
	// Распарсим дату/время, расположив элементы на нужных позициях. Если сочетание день+месяц неадекватное, считаем, что дата не распарсилась.
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
 * Формирует строку с датой/временем
 * @param time Кол-во миллисекунд с начала эпохи
 * @param template Определение даты для поля inputmask ('m.d.y H:s:s' или 'd.m.y H:s:s')
 * @returns Строковое представление даты с нужным порядком элементов
 */
function getDateStr(time, template) {
	if (time == 0)
		return '';
	// Поскольку у нас в inputmask используются только два определения даты - 'm.d.y H:s:s' и 'd.m.y H:s:s',
	// достаточно сравнить переданный шаблон с эталоном и определиться, как формировать дату
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
 * Формирует строку с временем в формате ЧЧ:ММ
 * @param time Кол-во секунд
 * @returns Строковое представление времени по формату H:s 
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
 * Сохраняет поля переданного объекта в куке с именем name.
 * Сохраняются пары "ключ;значение", разделённые запятыми. Если поле объекта - массив, ключ имеет вид "property|index1|index2". Функции игнорируютя. 
 * @param name - имя куки, в которую будут сохранены данные
 * @param data - объект, свойства (поля) которого требуется сохранить в куку
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
	saveStr = saveStr.substring(0, saveStr.length-1); // последний символ - запятая, она не нужна
	if (supports_html5_storage()) {
		try {
			localStorage.setItem(name, saveStr);
			// Clear old cookie if exists
			document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
		} catch (e) {
			// Quota exceeded - fallback to cookie
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


/**
 * Загружает из куки с именем name данные и складывает их в объект params.
 * В куке ожидаются пары "ключ;значение", разделённые запятыми. Если целевое поле объекта - массив, ключ должен иметь вид "property|index1|index2". Максимальная размерность массива - 2.
 * Целевой объект должен содержать функцию validate, принимающую имя целевого поля объекта и значение-кандидат, и возвращающую проверенное значение, которое можно записывать в поле.
 * Если в куке отстутствует подстрока "key-value", загрузка не производится. 
 * @param name имя куки, из которой будут загружены данные
 * @param params объект, свойства (поля) которого требуется загрузить из куки
 */
/** Reads a value previously written by saveToCookie: localStorage first, legacy cookie as fallback. */
function readSavedData(name) {
	const stored = loadFromStorage(name);
	if (stored !== null)
		return stored;
	const cookies = document.cookie.split(';');
	for (let i = 0; i < cookies.length; i++) {
		const cookie = cookies[i].trim();
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
		}
	}
	params[parts[0]] = params.validate(parts[0], parts[1]);
}

function loadFromCookie(name, params) {
	const data = readSavedData(name);
	if (!data || data.indexOf('key-value') == -1)
		return;
	data.split(',').forEach(function(entry) {
		applyCookieEntry(params, entry);
	});
}

/**
* Пытается считать запрошенные данные из локального HTML5 хранилища.
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
	for (let i = 0; i < cookies.length; i++) {
		const cookie = cookies[i].trim();
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

function toggleLight(on) {
	const theme = { value: 'light' };
	if (on) {
		document.getElementById('cb-light-theme').checked = true;		
		document.getElementById('dark-theme').disabled = true;
		document.getElementById('light-theme').disabled = false;
		theme.value = 'light';
		saveToCookie("theme", theme);
	} else {
		document.getElementById('cb-light-theme').checked = false;
		document.getElementById('dark-theme').disabled = false;		
		document.getElementById('light-theme').disabled = true;
		theme.value = 'dark';
		saveToCookie("theme", theme);
	}	
}

/**
 * Заменяет десятичный разделитель в строковом представлении полученного числа на указанный в настройках
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
		document.getElementById('cb-light-theme').checked = true;
		html.dataset.bsTheme = 'light';
		theme.value = 'light';
		saveToCookie("theme", theme);
	} else {
		document.getElementById('cb-light-theme').checked = false;
		html.dataset.bsTheme = 'dark';
		theme.value = 'dark';
		saveToCookie("theme", theme);
	}	
}

function frac(x, n) {
    const pow = Math.pow(10, n);
    return Math.round(x * pow) / pow;
}
