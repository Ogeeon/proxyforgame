var resTypes = [
	[1,0,0],
	[0,1,0],
	[0,0,1],
	[1,1,0],
	[1,0,1],
	[0,1,1]
];
var rateLimits = {
	md: { min: 1.8, max: 3.0 },
	cd: { min: 1.0, max: 2.0 },
	mc: { min: 1.5, max: 2.0 }
};

var l = {};
var unis;

var options = {
	metal: 0,
	crystal: 0,
	deuterium: 0,
	fix1: 0,
	fix2: 0,

	rates: {
		md: (rateLimits.md.min + rateLimits.md.max) / 2,
		cd: (rateLimits.cd.min + rateLimits.cd.max) / 2,
		mc: (this.md / this.cd).toFixed(3)
	},

	srcType: 2,
	dstType: 2,
	dstMixType: 0,

	mixBalance: 50,
	mixProp1: 1,
	mixProp2: 1,

	country: 'en',
	universe: 101,
	coordg: 0,
	coords: 0,
	coordp: 0,
	hyperTech: 0,

	validate: function(field, value) {
		switch (field) {
			case 'metal': return validateNumber(Number.parseInt(value), 0, Infinity, 0);
			case 'crystal': return validateNumber(Number.parseInt(value), 0, Infinity, 0);
			case 'deuterium': return validateNumber(Number.parseInt(value), 0, Infinity, 0);
			case 'srcType': return validateNumber(Number.parseInt(value), 0, 5, this.srcType);
			case 'dstType': return validateNumber(Number.parseInt(value), 0, 5, this.dstType);
			case 'dstMixType': return validateNumber(Number.parseInt(value), 0, 3, this.dstMixType);
			case 'mixBalance': return validateNumber(Number.parseFloat(value), 0, 100, this.mixBalance);
			case 'mixProp1': return validateNumber(Number.parseInt(value), 0, 100, this.mixProp1);
			case 'mixProp2': return validateNumber(Number.parseInt(value), 0, 100, this.mixProp2);
			case 'country': return value;
			case 'universe': return validateNumber(Number.parseInt(value), 0, Infinity, 101);
			case 'coordg': return validateNumber(Number.parseInt(value), 0, 12, this.coordg);
			case 'coords': return validateNumber(Number.parseInt(value), 0, 550, this.coords);
			case 'coordp': return validateNumber(Number.parseInt(value), 0, 15, this.coordp);
			case 'hyperTech': return validateNumber(Number.parseInt(value), 0, 50, this.hyperTech);
			case 'moon': return value === true || value === 'true';
			default: return value;
		}
	},

	load: function() {
		try {
			loadFromCookie('options_trade', options);
			// Validate that rates is an object and re-init if needed
			if (typeof this.rates !== 'object' || this.rates === null) {
				this.rates = {
					md: (rateLimits.md.min + rateLimits.md.max) / 2,
					cd: (rateLimits.cd.min + rateLimits.cd.max) / 2,
					mc: 0
				};
			}
			this.rates.mc = (this.rates.md / this.rates.cd).toFixed(3);
			// consoleLog("loaded from cookies: ");
			// consoleLog(options);
		} catch(e) {
			alert(e);
		}
	},

	save: function() {
		saveToCookie('options_trade', options);
	},

	parseFromUri: function() {
		var url = window.location.href.split("#");
		if (url.length > 1) {
			var params = url[1].split('&');
			var p = {};
			for (var ps in params) {
				var t = params[ps].split('=');
				if (t.length == 2) {
					p[unescape(t[0]).toLowerCase()] = unescape(t[1]).toLowerCase();
				}
			}
			if (isset(p['rmd'])) this.rates.md = validateNumber(Number.parseFloat(p['rmd']), 1, 5, this.rates.md);
			if (isset(p['rcd'])) this.rates.cd = validateNumber(Number.parseFloat(p['rcd']), 1, 5, this.rates.cd);
			this.rates.mc = (this.rates.md / this.rates.cd).toFixed(3);
			if (isset(p['st'])) this.srcType = validateNumber(Number.parseInt(p['st']), 0, 5, this.srcType);
			if (isset(p['dt'])) this.dstType = validateNumber(Number.parseInt(p['dt']), 0, 5, this.dstType);
			if (isset(p['dmt'])) this.dstMixType = validateNumber(Number.parseInt(p['dmt']), 0, 3, this.dstMixType);
			if (isset(p['mix'])) this.mixBalance = validateNumber(Number.parseFloat(p['mix']), 0, 100, this.mixBalance);
			if (isset(p['mp1'])) { this.mixProp1 = validateNumber(Number.parseInt(p['mp1']), 0, 100, this.mixProp1); document.getElementById('mix-balance-prop1').value = this.mixProp1 == 0 ? '' : this.mixProp1; }
			if (isset(p['mp2'])) { this.mixProp2 = validateNumber(Number.parseInt(p['mp2']), 0, 100, this.mixProp2); document.getElementById('mix-balance-prop2').value = this.mixProp2 == 0 ? '' : this.mixProp2; }
			if (isset(p['fix1'])) { this.fix1 = validateNumber(Number.parseInt(p['fix1']), 0, Infinity, this.fix1); document.getElementById('mix-fix1').value = this.fix1 == 0 ? '' : this.fix1; }
			if (isset(p['fix2'])) { this.fix2 = validateNumber(Number.parseInt(p['fix2']), 0, Infinity, this.fix2); document.getElementById('mix-fix2').value = this.fix2 == 0 ? '' : this.fix2; }
			if (isset(p['m'])) { var m = validateNumber(Number.parseInt(p['m']), 0, Infinity, 0); document.getElementById('res-src-m').value = m == 0 ? '' : m; }
			if (isset(p['c'])) { var c = validateNumber(Number.parseInt(p['c']), 0, Infinity, 0); document.getElementById('res-src-c').value = c == 0 ? '' : c; }
			if (isset(p['d'])) { var d = validateNumber(Number.parseInt(p['d']), 0, Infinity, 0); document.getElementById('res-src-d').value = d == 0 ? '' : d; }
			if (isset(p['l'])) { var m = p['l'].split(':'); if (m.length == 2) { this.country = checkCountryLang(m[0]); this.universe = validateNumber(Number.parseInt(m[1]), 0, Infinity, 101); } }
			if (isset(p['lc'])) { var m = p['lc'].split(':'); if (m.length == 3) { this.coordg = validateNumber(Number.parseInt(m[0]), 0, 12, 0); this.coords = validateNumber(Number.parseInt(m[1]), 0, 550, 0); this.coordp = validateNumber(Number.parseInt(m[2]), 0, 15, 0); } }
			if (isset(p['lm'])) { var lm = validateNumber(Number.parseInt(p['lm']), 0, 1, 0); document.getElementById('moon').checked = lm !== 0; this.moon = lm !== 0; } else this.moon = false;
		}
	},

	makeUri: function() {
		var l = window.location;
		var url = l.protocol + '//' + l.host + l.pathname + l.search +
				'#rmd=' + this.rates.md + '&rcd=' + this.rates.cd +
				'&st=' + this.srcType + '&dt=' + this.dstType;
		if (this.dstType == 2) {
			url += '&dmt=' + this.dstMixType;
			switch (this.dstMixType) {
				case 0: url += '&mix=' + this.mixBalance; break;
				case 1: url += '&mp1=' + this.mixProp1 + '&mp2=' + this.mixProp2; break;
				case 2: url += this.fix1 ? '&fix1=' + this.fix1 : ''; break;
				case 3: url += this.fix2 ? '&fix2=' + this.fix2 : ''; break;
			}
		}

		if (resTypes[this.srcType][0] == 1 && this.metal) url += '&m=' + this.metal;
		if (resTypes[this.srcType][1] == 1 && this.crystal) url += '&c=' + this.crystal;
		if (resTypes[this.srcType][2] == 1 && this.deuterium) url += '&d=' + this.deuterium;

		url += '&l=' + this.country + ':' + this.universe;
		if (this.coordg && this.coords && this.coordp) {
			url +=  '&lc=' + this.coordg + ':' + this.coords + ':' + this.coordp;
			url += this.moon ? '&lm=1' : '&lm=0';
		}
		return url;
	},

	makeString: function(dm, dc, dd) {
		var txt = l.src + ' ';
		var f = false;
		if (resTypes[this.srcType][0] == 1 && this.metal) { txt += numToOGame(this.metal) + ' ' + l.met; f = true; }
		if (resTypes[this.srcType][1] == 1 && this.crystal) { txt += (f ? ' ' + l.and + ' ' : '') + numToOGame(this.crystal) + ' ' + l.crys; f = true; }
		if (resTypes[this.srcType][2] == 1 && this.deuterium) { txt += (f ? ' ' + l.and + ' ' : '') + numToOGame(this.deuterium) + ' ' + l.deut; }

		txt += '. ';
		if (dm || dc || dd) {
			txt += l.dst + ' ';
			f = false;
			if (dm) { txt += numToOGame(dm) + ' ' + l.met; f = true; }
			if (dc) { txt += (f ? ' ' + l.and + ' ' : '') + numToOGame(dc) + ' ' + l.crys; f = true; }
			if (dd) { txt += (f ? ' ' + l.and + ' ' : '') + numToOGame(dd) + ' ' + l.deut; }
			txt += '. ';
		}

		txt += l.rates + ' ' + options.rates.md + ':' + options.rates.cd + ':1. ';

		if (this.coordg && this.coords && this.coordp) {
			var server = document.querySelector('#country option:checked').textContent.match(/\((.+)\)/)[1];
			var uni = document.querySelector('#universe option:checked').textContent.match(/^(.+) \(/)[1];
			txt += l.coords + ' [' + this.coordg + ':' + this.coords + ':' + this.coordp + ']';
			txt += this.moon ? ', '+ l.moonstr : '';
			txt += ' (' + uni + ', ' + server + ')';
		}
		return txt;
	}
};

/**
 * Заполняет select#universe списоком вселенных для указанной страны и устанавливает текущий элемент в нем.
 * @param lang язык страны: 'ru', 'en', ...
 * @param uni текущая вселенная: 1,2,3,..101,102,...
 */
function setUniList(lang, uni) {
	const universeEl = document.getElementById('universe');
	universeEl.innerHTML = '';
	var ulist = unis[lang] || [];

	// проверяем, имеется ли такая вселенная в указанной стране. если нет, сбрасываем на начало списка
	var fu = false;
	for (var i = 0; i < ulist.length; i++) {
		if (ulist[i][0] == uni) {
			fu = true;
			break;
		}
	}
	if (!fu) {
		options.universe = uni = 101;
		options.save();
	}

	for (var i = 0; i < ulist.length; i++) {
		const option = document.createElement('option');
		option.value = ulist[i][0];
		option.textContent = ulist[i][2] + ' (' + ulist[i][1] + ')';
		universeEl.appendChild(option);
	}
	universeEl.value = uni;
}

/**
 * Возвращает язык, указанный в url. Если не удается распознать язык из урла, возвращается дефолтный.
 */
function getUrlLang() {
	var um = window.location.pathname.match(/^\/(\w\w)\//);
	return um ? um[1] : 'en';
}

/**
 * Проверяет на валидность язык страны из списка #country. Если такого языка не встречается, то ставим дефолтный.
 */
function checkCountryLang(lang) {
	var f = false;
	const options = document.querySelectorAll('#country option');
	options.forEach(function(option) {
		if (option.value === lang) f = true;
	});
	return f ? lang : getUrlLang();
}

/**
 * Возвращает массив доступности типа ресурсов назначения в зависимости от состояния переключателей srcType и dstType.
 */
function getDstInputState(srcType, dstType) {
	var dstEnable = resTypes[srcType].slice(0);
	var cnt = 0;
	if (dstType < 2) {
		for (var d = 0; d < 3; d++) {
			if (dstEnable[d] == 0) {
				if (cnt != dstType) {
					dstEnable[d] = 1;
				}
				cnt++;
			}
		}
	}
	return dstEnable;
}

/**
 * Обрабатывает смену переключателя srcType.
 */
function onUpdateSrcType() {
	var input = document.getElementById('res-src-' + options.srcType);
	if (!input.checked) {
		input.checked = true;
	}
	updateSrcInputState(resTypes[options.srcType]);
	updateDstFromSrc();
	onUpdateDstType();
}

/**
 * Обрабатывает смену переключателя dstType.
 */
function onUpdateDstType() {
	// доп.контроль
	if (options.srcType > 2) {
		options.dstType = 0;
	}
	var input = document.getElementById('res-dst-' + options.dstType);
	if (!input.checked) {
		input.checked = true;
	}
	updateDstInputState(getDstInputState(options.srcType, options.dstType));
	onUpdateDstMixType();
}

/**
 * Обрабатывает смену переключателя dstMixType c учетом состояния переключателя dstType.
 */
function onUpdateDstMixType() {
	if (options.dstType == 2) {
		var input = document.getElementById('res-dst-mix-' + options.dstMixType);
		if (!input.checked) {
			input.checked = true;
		}
	} else {
		const radios = document.querySelectorAll('#dst-mix-block input[type="radio"]');
		radios.forEach(r => r.checked = false);
	}
	updateNumbers();
	options.save();
}

/**
 * Принудительно устанавливает тип dstType в положение 2 (mix).
 * @return true, если произошла смена состояний и нужно обновить зависимые данные
 */
function forceDstMix() {
	if (options.dstType != 2) {
		options.dstType = 2;
		return true;
	} else {
		return false;
	}
}

/**
 * Активизирует определенный тип микса в зависимости от активного поля ввода obj.
 */
function activateDstMixType(obj) {
	var ids = [
		['mix-balance-proc', 0],
		['mix-balance-prop1', 1],
		['mix-balance-prop2', 1],
		['mix-fix1', 2],
		['mix-fix2', 3]
	];
	var type = -1;
	for (var i = 0; i < ids.length; i++) {
		if (obj.id == ids[i][0]) {
			var type = ids[i][1];
			break;
		}
	}
	if (type >= 0) {
		if (options.dstType != 2 || options.dstMixType != type) {
			options.dstMixType = type;
			if (forceDstMix()) {
				onUpdateDstType();
			}
			else {
				onUpdateDstMixType();
			}
		}
	}
}

/**
 * Устанавливает доступность полей ресурсов источника.
 * @param resEnable массив доступности полей с input'ами ресурсов: e.g. [1,0,0]
 */
function updateSrcInputState(resEnable) {
	var classNames = ['res-src-m', 'res-src-c', 'res-src-d'];
	for (var i = 0; i < 3; i++) {
		var elems = document.querySelectorAll('#res-src-panel .' + classNames[i]);
		var inputs = document.querySelectorAll('input.' + classNames[i]);
		if (resEnable[i] == 1) {
			elems.forEach(el => el.classList.remove('ui-state-disabled'));
			inputs.forEach(inp => inp.removeAttribute('disabled'));
		} else {
			elems.forEach(el => el.classList.add('ui-state-disabled'));
			inputs.forEach(inp => inp.disabled = true);
		}
	}
}

/**
 * Обновляет доступность и подписи переключателей типа ресурсов назначения в зависимости от состояния переключателя типа ресурсов источника.
 * Для единичных ресурсов источника доступны все три варианта назначения, для микса - только одно назначение.
 */
function updateDstFromSrc() {
	// ограничиваем возможные значения dstType
	if (options.srcType > 2) {
		options.dstType = 0;
	}
	// обновляем подписи к типу ресурсов
	switch (options.srcType) {
		case 0:
			document.getElementById('res-type-dst-lbl-0').textContent = l.crystal;
			document.getElementById('res-type-dst-lbl-1').textContent = l.deuterium;
			document.getElementById('res-type-dst-lbl-2').textContent = l.crystal + ' + ' + l.deuterium;
			document.getElementById('mix-lbl').textContent = l.crys;
			document.getElementById('mix-prop-lbl').textContent = l.crys + ' / ' + l.deut;
			document.getElementById('mix-fix1-lbl').textContent = l.fix + '. ' + l.crys;
			document.getElementById('mix-fix2-lbl').textContent = l.fix + '. ' + l.deut;
			break;
		case 1:
			document.getElementById('res-type-dst-lbl-0').textContent = l.metal;
			document.getElementById('res-type-dst-lbl-1').textContent = l.deuterium;
			document.getElementById('res-type-dst-lbl-2').textContent = l.metal + ' + ' + l.deuterium;
			document.getElementById('mix-lbl').textContent = l.met;
			document.getElementById('mix-prop-lbl').textContent = l.met + ' / ' + l.deut;
			document.getElementById('mix-fix1-lbl').textContent = l.fix + '. ' + l.met;
			document.getElementById('mix-fix2-lbl').textContent = l.fix + '. ' + l.deut;
			break;
		case 2:
			document.getElementById('res-type-dst-lbl-0').textContent = l.metal;
			document.getElementById('res-type-dst-lbl-1').textContent = l.crystal;
			document.getElementById('res-type-dst-lbl-2').textContent = l.metal + ' + ' + l.crystal;
			document.getElementById('mix-lbl').textContent = l.met;
			document.getElementById('mix-prop-lbl').textContent = l.met + ' / ' + l.crys;
			document.getElementById('mix-fix1-lbl').textContent = l.fix + '. ' + l.met;
			document.getElementById('mix-fix2-lbl').textContent = l.fix + '. ' + l.crys;
			break;
		case 3:
			document.getElementById('res-type-dst-lbl-0').textContent = l.deuterium;
			break;
		case 4:
			document.getElementById('res-type-dst-lbl-0').textContent = l.crystal;
			break;
		case 5:
			document.getElementById('res-type-dst-lbl-0').textContent = l.metal;
			break;
	}
	document.getElementById('dst-block').style.visibility = options.srcType < 3 ? 'visible' : 'hidden';
}

/**
 * Устанавливает доступность полей ресурсов назначения.
 * @param resEnable массив доступности полей с input'ами ресурсов: e.g. [1,0,0]
 */
function updateDstInputState(resEnable) {
	var classNames = ['res-dst-m', 'res-dst-c', 'res-dst-d'];
	for (var i = 0; i < 3; i++) {
		var elems = document.querySelectorAll('#res-dst-panel .' + classNames[i]);
		if (resEnable[i] == 0) {
			elems.forEach(el => el.classList.remove('ui-state-disabled'));
		} else {
			elems.forEach(el => el.classList.add('ui-state-disabled'));
		}
	}
}

function resetParams() {
	options.rates.md = (rateLimits.md.min + rateLimits.md.max) / 2;
	options.rates.cd = (rateLimits.cd.min + rateLimits.cd.max) / 2;
	options.rates.mc = (options.rates.md / options.rates.cd).toFixed(3);
	options.srcType = 2;
	options.dstType = 2;
	options.dstMixType = 0;
	options.mixBalance = 50;
	options.mixProp1 = 1;
	options.mixProp2 = 1;
	options.fix1 = 0;
	options.fix2 = 0;
	options.hyperTech = 0;
	options.moon = false;

	document.getElementById('res-src-m').value = '';
	document.getElementById('res-src-c').value = '';
	document.getElementById('res-src-d').value = '';
	document.getElementById('rate-md').value = options.rates.md;
	document.getElementById('rate-cd').value = options.rates.cd;
	document.getElementById('rate-mc').textContent = options.rates.mc;
	document.getElementById('md-slider').value = options.rates.md;
	document.getElementById('cd-slider').value = options.rates.cd;
	document.getElementById('mc-slider').value = options.rates.mc;
	document.getElementById('mix-balance-proc').value = options.mixBalance;
	document.getElementById('mix-balance-prop1').value = options.mixProp1;
	document.getElementById('mix-balance-prop2').value = options.mixProp2;
	document.getElementById('mix-balance').value = options.mixBalance;
	document.getElementById('mix-fix1').value = '';
	document.getElementById('mix-fix2').value = '';
	document.getElementById('hypertech-lvl').value = 0;
	document.getElementById('moon').checked = false;
	onUpdateSrcType();
	validateRateLimits();
	options.save();
}

/**
 * Проверяет, находятся ли курсы в допустимых пределах, и если это не так - подкрашивает input красным.
 */
function validateRateLimits() {
	const rateMd = document.getElementById('rate-md');
	const rateCd = document.getElementById('rate-cd');
	const rateMc = document.getElementById('rate-mc');
	
	if (options.rates.md >= rateLimits.md.min && options.rates.md <= rateLimits.md.max) {
		rateMd.classList.remove('ui-state-error');
	} else {
		rateMd.classList.add('ui-state-error');
	}
	if (options.rates.cd >= rateLimits.cd.min && options.rates.cd <= rateLimits.cd.max) {
		rateCd.classList.remove('ui-state-error');
	} else {
		rateCd.classList.add('ui-state-error');
	}
	if (options.rates.mc >= rateLimits.mc.min && options.rates.mc <= rateLimits.mc.max) {
		rateMc.classList.remove('ui-state-error');
	} else {
		rateMc.classList.add('ui-state-error');
	}
}

/**
 * Пересчитывает значения ресурсов в соответствии с настройками в модели.
 */
function updateNumbers() {
	// исходные ресурсы
	var sm = clampNumber(getInputNumber(document.getElementById('res-src-m')), 0, Infinity);
	var sc = clampNumber(getInputNumber(document.getElementById('res-src-c')), 0, Infinity);
	var sd = clampNumber(getInputNumber(document.getElementById('res-src-d')), 0, Infinity);

	options.metal = sm;
	options.crystal = sc;
	options.deuterium = sd;

	// расчеты
	var dst = {
		mc: sm / options.rates.mc,	// металл в пересчете на кристалл
		md: sm / options.rates.md,	// металл в пересчете на дейтерий
		cm: sc * options.rates.mc,	// кристалл в пересчете на металл
		cd: sc / options.rates.cd,	// кристалл в пересчете на дейтерий
		dm: sd * options.rates.md,	// дейтерий в пересчете на металл
		dc: sd * options.rates.cd	// дейтерий в пересчете на кристалл
	};

	// целевые ресурсы
	var dm = 0;
	var dc = 0;
	var dd = 0;

	// фиксированные ресурсы из микса
	var fix1 = getInputNumber(document.getElementById('mix-fix1'));
	var fix2 = getInputNumber(document.getElementById('mix-fix2'));
	options.fix1 = fix1;
	options.fix2 = fix2;

	if (options.dstMixType == 0) var p = options.mixBalance;
	else if (options.dstMixType == 1) var p = clampNumber(options.mixProp1 / (options.mixProp1 + options.mixProp2) * 100, 0, 100);

	switch (options.srcType) {
		case 0:
			switch (options.dstType) {
				case 0: dc = dst.mc;
					break;
				case 1: dd = dst.md;
					break;
				case 2:
					switch (options.dstMixType) {
						case 0:
						case 1:
							dc = dst.md / ((100 - p) / p + options.rates.mc / options.rates.md);
							dd = dst.mc / (p / (100 - p) + options.rates.md / options.rates.mc);
							break;
						case 2:
							dc = clampNumber(fix1, 0, dst.mc);
							dd = (sm - (dc * options.rates.mc)) / options.rates.md;
							break;
						case 3:
							dd = clampNumber(fix2, 0, dst.md);
							dc = (sm - (dd * options.rates.md)) / options.rates.mc;
							break;
					}
					break;
			}
			break;
		case 1:
			switch (options.dstType) {
				case 0: dm = dst.cm;
					break;
				case 1: dd = dst.cd;
					break;
				case 2:
					switch (options.dstMixType) {
						case 0:
						case 1:
							dm = dst.cd / ((100 - p) / p + 1 / (options.rates.cd * options.rates.mc));
							dd = dst.cm / (p / (100 - p) + options.rates.mc * options.rates.cd);
							break;
						case 2:
							dm = clampNumber(fix1, 0, dst.cm);
							dd = (sc - (dm / options.rates.mc)) / options.rates.cd;
							break;
						case 3:
							dd = clampNumber(fix2, 0, dst.cd);
							dm = (sc - (dd * options.rates.cd)) * options.rates.mc;
							break;
					}
					break;
			}
			break;
		case 2:
			switch (options.dstType) {
				case 0: dm = dst.dm;
					break;
				case 1: dc = dst.dc;
					break;
				case 2:
					switch (options.dstMixType) {
						case 0:
						case 1:
							dm = dst.dc / ((100 - p) / p + options.rates.cd / options.rates.md);
							dc = dst.dm / (p / (100 - p) + options.rates.md / options.rates.cd);
							break;
						case 2:
							dm = clampNumber(fix1, 0, dst.dm);
							dc = (sd - (dm / options.rates.md)) * options.rates.cd;
							break;
						case 3:
							dc = clampNumber(fix2, 0, dst.dc);
							dm = (sd - (dc / options.rates.cd)) * options.rates.md;
							break;
					}
					break;
			}
			break;
		case 3:
			dd = dst.md + dst.cd;
			break;
		case 4:
			dc = dst.mc + dst.dc;
			break;
		case 5:
			dm = dst.cm + dst.dm;
			break;
	}
	dm = Math.round(dm);
	dc = Math.round(dc);
	dd = Math.round(dd);
	document.getElementById('res-dst-m').textContent = numToOGame(dm);
	document.getElementById('res-dst-c').textContent = numToOGame(dc);
	document.getElementById('res-dst-d').textContent = numToOGame(dd);

	var st = 0;
	switch (options.srcType) {
		case 0: st = sm;
			break;
		case 1: st = sc;
			break;
		case 2: st = sd;
			break;
		case 3: st = sm + sc;
			break;
		case 4: st = sm + sd;
			break;
		case 5: st = sc + sd;
			break;
	}
	
	var ht = clampNumber(getInputNumber(document.getElementById('hypertech-lvl')), 0, Infinity);
	options.hyperTech = ht;
	var capSC = 5000.0 * (1 + 0.05 * ht);
	var capLC = 25000.0 * (1 + 0.05 * ht);
	var mt = st / capSC;
	var bt = st / capLC;
	document.getElementById('res-src-cargo').textContent = numToOGame(Math.ceil(mt)) + ' ' + l.sc + ' / ' + numToOGame(Math.ceil(bt)) + ' ' + l.lc;
	st = dm + dc + dd;
	mt = st / capSC;
	bt = st / capLC;
	document.getElementById('res-dst-cargo').textContent = numToOGame(Math.ceil(mt)) + ' ' + l.sc + ' / ' + numToOGame(Math.ceil(bt)) + ' ' + l.lc;

	if (sm || sc || sd) {
		var uri = options.makeUri();
		var txt = options.makeString(dm, dc, dd);
		const alink = document.getElementById('alink');
		alink.href = uri;
		alink.textContent = uri;
		document.getElementById('atext').textContent = txt;
		setTimeout(function() { document.getElementById('abbcode').textContent = '[url=' + uri + ']' + txt + '[/url]'; }, 200);
	} else {
		const alink = document.getElementById('alink');
		alink.href = '';
		alink.textContent = '';
		document.getElementById('atext').textContent = '';
		document.getElementById('abbcode').textContent = '';
	}
	options.save();
}

/**
 *
 */
document.addEventListener('DOMContentLoaded', function() {
try {
	options.load();
	options.parseFromUri();

	const mdSlider = document.getElementById('md-slider');
	mdSlider.min = rateLimits.md.min;
	mdSlider.max = rateLimits.md.max;
	mdSlider.step = 0.05;
	mdSlider.value = options.rates.md;
	mdSlider.addEventListener('input', function() {
		const val = Number.parseFloat(this.value);
		document.getElementById('rate-md').value = val;
		options.rates.md = val;
		options.rates.mc = (options.rates.md / options.rates.cd).toFixed(3);
		updateNumbers();
		document.getElementById('rate-mc').textContent = options.rates.mc;
		document.getElementById('mc-slider').value = options.rates.mc;
		validateRateLimits();
		options.save();
	});

	const cdSlider = document.getElementById('cd-slider');
	cdSlider.min = rateLimits.cd.min;
	cdSlider.max = rateLimits.cd.max;
	cdSlider.step = 0.05;
	cdSlider.value = options.rates.cd;
	cdSlider.addEventListener('input', function() {
		const val = Number.parseFloat(this.value);
		document.getElementById('rate-cd').value = val;
		options.rates.cd = val;
		options.rates.mc = (options.rates.md / options.rates.cd).toFixed(3);
		updateNumbers();
		document.getElementById('rate-mc').textContent = options.rates.mc;
		document.getElementById('mc-slider').value = options.rates.mc;
		validateRateLimits();
		options.save();
	});

	const mcSlider = document.getElementById('mc-slider');
	mcSlider.min = rateLimits.mc.min;
	mcSlider.max = rateLimits.mc.max;
	mcSlider.step = 0.05;
	mcSlider.value = options.rates.mc;
	mcSlider.disabled = true;

	const mixBalanceSlider = document.getElementById('mix-balance');
	mixBalanceSlider.min = 0;
	mixBalanceSlider.max = 100;
	mixBalanceSlider.step = 5;
	mixBalanceSlider.value = options.mixBalance;
	mixBalanceSlider.addEventListener('input', function() {
		const val = Number.parseFloat(this.value);
		options.mixBalance = val;
		document.getElementById('mix-balance-proc').value = options.mixBalance;
		if (options.dstType != 2 || options.dstMixType != 0) {
			options.dstMixType = 0;
			if (forceDstMix()) onUpdateDstType(); else onUpdateDstMixType();
		}
		updateNumbers();
		options.save();
	});

	document.getElementById('hypertech-lvl').value = options.hyperTech;
	document.getElementById('country').value = options.country;
	setUniList(options.country, options.universe);

	document.getElementById('rate-md-min').textContent = rateLimits.md.min.toFixed(1);
	document.getElementById('rate-md-max').textContent = rateLimits.md.max.toFixed(1);
	document.getElementById('rate-cd-min').textContent = rateLimits.cd.min.toFixed(1);
	document.getElementById('rate-cd-max').textContent = rateLimits.cd.max.toFixed(1);
	document.getElementById('rate-mc-min').textContent = rateLimits.mc.min.toFixed(1);
	document.getElementById('rate-mc-max').textContent = rateLimits.mc.max.toFixed(1);
	document.getElementById('rate-md').value = options.rates.md;
	document.getElementById('rate-cd').value = options.rates.cd;
	document.getElementById('rate-mc').textContent = options.rates.mc;
	document.getElementById('mix-balance-proc').value = options.mixBalance;
	document.getElementById('mix-balance-prop1').value = options.mixProp1;
	document.getElementById('mix-balance-prop2').value = options.mixProp2;
	document.getElementById('coord-g').value = options.coordg ? options.coordg : '';
	document.getElementById('coord-s').value = options.coords ? options.coords : '';
	document.getElementById('coord-p').value = options.coordp ? options.coordp : '';
	document.getElementById('moon').checked = options.moon;

	document.querySelectorAll('input').forEach(function(input) {
		input.addEventListener('focusin', function() {
			this.classList.add('ui-state-focus');
		});
		input.addEventListener('focusout', function() {
			this.classList.remove('ui-state-focus');
		});
	});

	document.getElementById('reset').addEventListener('click', resetParams);

	var rbf = function(r1, r2) {
		options.rates.md = r1;
		options.rates.cd = r2;
		options.rates.mc = (r1 / r2).toFixed(3);
		document.getElementById('rate-md').value = options.rates.md;
		document.getElementById('rate-cd').value = options.rates.cd;
		document.getElementById('rate-mc').textContent = options.rates.mc;
		document.getElementById('md-slider').value = options.rates.md;
		document.getElementById('cd-slider').value = options.rates.cd;
		document.getElementById('mc-slider').value = options.rates.mc;
		updateNumbers();
		validateRateLimits();
		options.save();
	}
	document.getElementById('rb1').addEventListener('click', function() { rbf(4, 2); });
	document.getElementById('rb2').addEventListener('click', function() { rbf(3, 2); });
	document.getElementById('rb3').addEventListener('click', function() { rbf(3, 1.5); });
	document.getElementById('rb4').addEventListener('click', function() { rbf(2.5, 1.5); });
	document.getElementById('rb5').addEventListener('click', function() { rbf(2, 1.5); });
	document.getElementById('rb6').addEventListener('click', function() { rbf(2.4, 1.5); });

	validateRateLimits();

	document.querySelectorAll('#res-src input[type="radio"]').forEach(function(radio) {
		radio.addEventListener('change', function() { options.srcType = Number.parseInt(this.value); onUpdateSrcType(); });
	});
	document.querySelectorAll('#res-dst input[name="dst"]').forEach(function(radio) {
		radio.addEventListener('change', function() { options.dstType = Number.parseInt(this.value); onUpdateDstType(); });
	});
	document.querySelectorAll('#dst-mix-block input[type="radio"]').forEach(function(radio) {
		radio.addEventListener('change', function() { options.dstMixType = Number.parseInt(this.value); if (forceDstMix()) onUpdateDstType(); else onUpdateDstMixType(); });
	});
	document.getElementById('mix-balance-proc').addEventListener('keyup', function() { var n = clampNumber(getInputNumber(this), 0, 100); document.getElementById('mix-balance').value = n; options.mixBalance = n; options.save(); });
	document.getElementById('mix-balance-prop1').addEventListener('keyup', function() { options.mixProp1 = clampNumber(getInputNumber(this), 0, 100); options.save(); });
	document.getElementById('mix-balance-prop2').addEventListener('keyup', function() { options.mixProp2 = clampNumber(getInputNumber(this), 0, 100); options.save(); });
	document.querySelectorAll('#res-src-panel input[type="text"]').forEach(function(input) {
		input.addEventListener('keyup', updateNumbers);
	});
	document.querySelectorAll('#dst-mix-block input[type="text"]').forEach(function(input) {
		input.addEventListener('keyup', updateNumbers);
		input.addEventListener('focusin', function() { activateDstMixType(this); });
	});
	var cev = function() { options.country = document.getElementById('country').value; setUniList(options.country, options.universe); updateNumbers(); options.save(); }
	document.getElementById('country').addEventListener('change', cev);
	document.getElementById('country').addEventListener('keyup', cev);
	var uev = function() { options.universe = document.getElementById('universe').value; updateNumbers(); options.save(); }
	document.getElementById('universe').addEventListener('change', uev);
	document.getElementById('universe').addEventListener('keyup', uev);
	document.getElementById('coord-g').addEventListener('keyup', function() { options.coordg = clampNumber(getInputNumber(this), 0, 12); updateNumbers(); options.save(); });
	document.getElementById('coord-s').addEventListener('keyup', function() { options.coords = clampNumber(getInputNumber(this), 0, 550); updateNumbers(); options.save(); });
	document.getElementById('coord-p').addEventListener('keyup', function() { options.coordp = clampNumber(getInputNumber(this), 0, 15); updateNumbers(); options.save(); });
	document.getElementById('rate-md').addEventListener('keyup', function() { options.rates.md = clampNumber(getInputNumber(this), 1, 5); document.getElementById('md-slider').value = options.rates.md; options.rates.mc = (options.rates.md / options.rates.cd).toFixed(3); document.getElementById('rate-mc').textContent = options.rates.mc; document.getElementById('mc-slider').value = options.rates.mc; updateNumbers(); validateRateLimits(); options.save(); });
	document.getElementById('rate-cd').addEventListener('keyup', function() { options.rates.cd = clampNumber(getInputNumber(this), 1, 5); document.getElementById('cd-slider').value = options.rates.cd; options.rates.mc = (options.rates.md / options.rates.cd).toFixed(3); document.getElementById('rate-mc').textContent = options.rates.mc; document.getElementById('mc-slider').value = options.rates.mc; updateNumbers(); validateRateLimits(); options.save(); });
	var event = {currentTarget: document.getElementById('hypertech-lvl'), data: 'updateNumbers'};
	document.getElementById('hypertech-lvl').addEventListener('keyup', function() { validateInputNumber.call(this, event); });
	document.getElementById('moon').addEventListener('click', function() { options.moon = document.getElementById('moon').checked; updateNumbers(); options.save(); });

	let theme = { value: 'light', validate: function(key, val) { return val; } };
	loadFromCookie('theme', theme);
	toggleLight(theme.value === 'light');
	const cbLightTheme = document.getElementById('cb-light-theme');
	if (cbLightTheme) {
		cbLightTheme.addEventListener('click', function() { toggleLight(this.checked); });
	}
	
	onUpdateSrcType();
} catch (e) {
	alert('Exception: ' + e);
}
});
