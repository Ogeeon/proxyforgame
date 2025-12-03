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
			case 'metal': return validateNumber(parseInt(value), 0, Infinity, 0);
			case 'crystal': return validateNumber(parseInt(value), 0, Infinity, 0);
			case 'deuterium': return validateNumber(parseInt(value), 0, Infinity, 0);
			case 'srcType': return validateNumber(parseInt(value), 0, 5, this.srcType);
			case 'dstType': return validateNumber(parseInt(value), 0, 5, this.dstType);
			case 'dstMixType': return validateNumber(parseInt(value), 0, 3, this.dstMixType);
			case 'mixBalance': return validateNumber(parseFloat(value), 0, 100, this.mixBalance);
			case 'mixProp1': return validateNumber(parseInt(value), 0, 100, this.mixProp1);
			case 'mixProp2': return validateNumber(parseInt(value), 0, 100, this.mixProp2);
			case 'country': return value;
			case 'universe': return validateNumber(parseInt(value), 0, Infinity, 101);
			case 'coordg': return validateNumber(parseInt(value), 0, 12, this.coordg);
			case 'coords': return validateNumber(parseInt(value), 0, 550, this.coords);
			case 'coordp': return validateNumber(parseInt(value), 0, 15, this.coordp);
			case 'hyperTech': return validateNumber(parseInt(value), 0, 50, this.hyperTech);
			case 'moon': return value === true || value === 'true';
			default: return value;
		}
	},

	load: function() {
		try {
			loadFromCookie('options_trade', options);
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
			if (isset(p['rmd'])) this.rates.md = validateNumber(parseFloat(p['rmd']), 1, 5, this.rates.md);
			if (isset(p['rcd'])) this.rates.cd = validateNumber(parseFloat(p['rcd']), 1, 5, this.rates.cd);
			this.rates.mc = (this.rates.md / this.rates.cd).toFixed(3);
			if (isset(p['st'])) this.srcType = validateNumber(parseInt(p['st']), 0, 5, this.srcType);
			if (isset(p['dt'])) this.dstType = validateNumber(parseInt(p['dt']), 0, 5, this.dstType);
			if (isset(p['dmt'])) this.dstMixType = validateNumber(parseInt(p['dmt']), 0, 3, this.dstMixType);
			if (isset(p['mix'])) this.mixBalance = validateNumber(parseFloat(p['mix']), 0, 100, this.mixBalance);
			if (isset(p['mp1'])) { this.mixProp1 = validateNumber(parseInt(p['mp1']), 0, 100, this.mixProp1); $('#mix-balance-prop1').val(this.mixProp1 == 0 ? '' : this.mixProp1); }
			if (isset(p['mp2'])) { this.mixProp2 = validateNumber(parseInt(p['mp2']), 0, 100, this.mixProp2); $('#mix-balance-prop2').val(this.mixProp2 == 0 ? '' : this.mixProp2); }
			if (isset(p['fix1'])) { this.fix1 = validateNumber(parseInt(p['fix1']), 0, Infinity, this.fix1); $('#mix-fix1').val(this.fix1 == 0 ? '' : this.fix1); }
			if (isset(p['fix2'])) { this.fix2 = validateNumber(parseInt(p['fix2']), 0, Infinity, this.fix2); $('#mix-fix2').val(this.fix2 == 0 ? '' : this.fix2); }
			if (isset(p['m'])) { var m = validateNumber(parseInt(p['m']), 0, Infinity, 0); $('#res-src-m').val(m == 0 ? '' : m); }
			if (isset(p['c'])) { var c = validateNumber(parseInt(p['c']), 0, Infinity, 0); $('#res-src-c').val(c == 0 ? '' : c); }
			if (isset(p['d'])) { var d = validateNumber(parseInt(p['d']), 0, Infinity, 0); $('#res-src-d').val(d == 0 ? '' : d); }
			if (isset(p['l'])) { var m = p['l'].split(':'); if (m.length == 2) { this.country = checkCountryLang(m[0]); this.universe = validateNumber(parseInt(m[1]), 0, Infinity, 101); } }
			if (isset(p['lc'])) { var m = p['lc'].split(':'); if (m.length == 3) { this.coordg = validateNumber(parseInt(m[0]), 0, 12, 0); this.coords = validateNumber(parseInt(m[1]), 0, 550, 0); this.coordp = validateNumber(parseInt(m[2]), 0, 15, 0); } }
			if (isset(p['lm'])) { var lm = validateNumber(parseInt(p['lm']), 0, 1, 0); $('#moon')[0].checked = lm !== 0; this.moon = lm !== 0; } else this.moon = false;
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
			var server = $('#country :selected').text().match(/\((.+)\)/)[1];
			var uni = $('#universe :selected').text().match(/^(.+) \(/)[1];
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
	$('#universe').empty();
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
		$('#universe').append($('<option value="' + ulist[i][0] + '">' + ulist[i][2] + ' (' + ulist[i][1] + ')</option>'));
	}
	$('#universe').val(uni);
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
	$('#country option').each(function() {
		if (this.value === lang) f = true;
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
	var input = $('#res-src-' + options.srcType);
	if (!input.is(':checked')) {
		input.attr('checked', true);
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
	var input = $('#res-dst-' + options.dstType);
	if (!input.is(':checked')) {
		input.attr('checked', true);
	}
	updateDstInputState(getDstInputState(options.srcType, options.dstType));
	onUpdateDstMixType();
}

/**
 * Обрабатывает смену переключателя dstMixType c учетом состояния переключателя dstType.
 */
function onUpdateDstMixType() {
	if (options.dstType == 2) {
		var input = $('#res-dst-mix-' + options.dstMixType);
		if (!input.is(':checked')) {
			input.attr('checked', true);
		}
	} else {
		$('#dst-mix-block input:radio').attr('checked', false);
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
		var elems = $('#res-src-panel .' + classNames[i]);
		if (resEnable[i] == 1) {
			elems.removeClass('ui-state-disabled');
			$('input.' + classNames[i]).removeAttr('disabled');
		} else {
			elems.addClass('ui-state-disabled');
			$('input.' + classNames[i]).attr('disabled', true);
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
			$('#res-type-dst-lbl-0').text(l.crystal);
			$('#res-type-dst-lbl-1').text(l.deuterium);
			$('#res-type-dst-lbl-2').text(l.crystal + ' + ' + l.deuterium);
			$('#mix-lbl').text(l.crys);
			$('#mix-prop-lbl').text(l.crys + ' / ' + l.deut);
			$('#mix-fix1-lbl').text(l.fix + '. ' + l.crys);
			$('#mix-fix2-lbl').text(l.fix + '. ' + l.deut);
			break;
		case 1:
			$('#res-type-dst-lbl-0').text(l.metal);
			$('#res-type-dst-lbl-1').text(l.deuterium);
			$('#res-type-dst-lbl-2').text(l.metal + ' + ' + l.deuterium);
			$('#mix-lbl').text(l.met);
			$('#mix-prop-lbl').text(l.met + ' / ' + l.deut);
			$('#mix-fix1-lbl').text(l.fix + '. ' + l.met);
			$('#mix-fix2-lbl').text(l.fix + '. ' + l.deut);
			break;
		case 2:
			$('#res-type-dst-lbl-0').text(l.metal);
			$('#res-type-dst-lbl-1').text(l.crystal);
			$('#res-type-dst-lbl-2').text(l.metal + ' + ' + l.crystal);
			$('#mix-lbl').text(l.met);
			$('#mix-prop-lbl').text(l.met + ' / ' + l.crys);
			$('#mix-fix1-lbl').text(l.fix + '. ' + l.met);
			$('#mix-fix2-lbl').text(l.fix + '. ' + l.crys);
			break;
		case 3:
			$('#res-type-dst-lbl-0').text(l.deuterium);
			break;
		case 4:
			$('#res-type-dst-lbl-0').text(l.crystal);
			break;
		case 5:
			$('#res-type-dst-lbl-0').text(l.metal);
			break;
	}
	$('#dst-block').css('visibility', options.srcType < 3 ? 'visible' : 'hidden');
}

/**
 * Устанавливает доступность полей ресурсов назначения.
 * @param resEnable массив доступности полей с input'ами ресурсов: e.g. [1,0,0]
 */
function updateDstInputState(resEnable) {
	var classNames = ['res-dst-m', 'res-dst-c', 'res-dst-d'];
	for (var i = 0; i < 3; i++) {
		var elems = $('#res-dst-panel .' + classNames[i]);
		if (resEnable[i] == 0) {
			elems.removeClass('ui-state-disabled');
		} else {
			elems.addClass('ui-state-disabled');
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

	$('#res-src-m').val('');
	$('#res-src-c').val('');
	$('#res-src-d').val('');
	$('#rate-md').val(options.rates.md);
	$('#rate-cd').val(options.rates.cd);
	$('#rate-mc').text(options.rates.mc);
	$('#md-slider').slider('value', options.rates.md);
	$('#cd-slider').slider('value', options.rates.cd);
	$('#mc-slider').slider('value', options.rates.mc);
	$('#mix-balance-proc').val(options.mixBalance);
	$('#mix-balance-prop1').val(options.mixProp1);
	$('#mix-balance-prop2').val(options.mixProp2);
	$('#mix-balance').slider('value', options.mixBalance);
	$('#mix-fix1').val('');
	$('#mix-fix2').val('');
	$('#hypertech-lvl').val(0);
	$('#moon')[0].checked = false;
	onUpdateSrcType();
	validateRateLimits();
	options.save();
}

/**
 * Проверяет, находятся ли курсы в допустимых пределах, и если это не так - подкрашивает input красным.
 */
function validateRateLimits() {
	if (options.rates.md >= rateLimits.md.min && options.rates.md <= rateLimits.md.max) {
		$('#rate-md').removeClass('ui-state-error');
	} else {
		$('#rate-md').addClass('ui-state-error');
	}
	if (options.rates.cd >= rateLimits.cd.min && options.rates.cd <= rateLimits.cd.max) {
		$('#rate-cd').removeClass('ui-state-error');
	} else {
		$('#rate-cd').addClass('ui-state-error');
	}
	if (options.rates.mc >= rateLimits.mc.min && options.rates.mc <= rateLimits.mc.max) {
		$('#rate-mc').removeClass('ui-state-error');
	} else {
		$('#rate-mc').addClass('ui-state-error');
	}
}

/**
 * Пересчитывает значения ресурсов в соответствии с настройками в модели.
 */
function updateNumbers() {
	// исходные ресурсы
	var sm = clampNumber(getInputNumber($('#res-src-m')[0]), 0, Infinity);
	var sc = clampNumber(getInputNumber($('#res-src-c')[0]), 0, Infinity);
	var sd = clampNumber(getInputNumber($('#res-src-d')[0]), 0, Infinity);

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
	var fix1 = getInputNumber($('#mix-fix1')[0]);
	var fix2 = getInputNumber($('#mix-fix2')[0]);
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
	$('#res-dst-m').text(numToOGame(dm));
	$('#res-dst-c').text(numToOGame(dc));
	$('#res-dst-d').text(numToOGame(dd));

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
	
	var ht = clampNumber(getInputNumber($('#hypertech-lvl')[0]), 0, Infinity);
	options.hyperTech = ht;
	var capSC = 5000.0 * (1 + 0.05 * ht);
	var capLC = 25000.0 * (1 + 0.05 * ht);
	var mt = st / capSC;
	var bt = st / capLC;
	$('#res-src-cargo').text(numToOGame(Math.ceil(mt)) + ' ' + l.sc + ' / ' + numToOGame(Math.ceil(bt)) + ' ' + l.lc);
	st = dm + dc + dd;
	mt = st / capSC;
	bt = st / capLC;
	$('#res-dst-cargo').text(numToOGame(Math.ceil(mt)) + ' ' + l.sc + ' / ' + numToOGame(Math.ceil(bt)) + ' ' + l.lc);

	if (sm || sc || sd) {
		var uri = options.makeUri();
		var txt = options.makeString(dm, dc, dd);
		$('#alink').attr('href', uri).text(uri);
		$('#atext').text(txt);
		setTimeout(function() { $('#abbcode').text('[url=' + uri + ']' + txt + '[/url]'); }, 200);
	} else {
		$('#alink').attr('href', '').text('');
		$('#atext').text('');
		$('#abbcode').text('');
	}
	options.save();
}

/**
 *
 */
$(document).ready(function() {
try {
	$("button").button();
	options.load();
	options.parseFromUri();

	$('#md-slider').slider({
		range: 'min', value: options.rates.md, min: rateLimits.md.min, max: rateLimits.md.max, step: 0.05,
		slide: function(event, ui) {
			$('#rate-md').val(ui.value);
			options.rates.md = parseFloat(ui.value);
			options.rates.mc = (options.rates.md / options.rates.cd).toFixed(3);
			updateNumbers();
			$('#rate-mc').text(options.rates.mc);
			$('#mc-slider').slider('value', options.rates.mc);
			validateRateLimits();
			options.save();
		}
	});
	$('#cd-slider').slider({
		range: 'min', value: options.rates.cd, min: rateLimits.cd.min, max: rateLimits.cd.max, step: 0.05,
		slide: function(event, ui) {
			$('#rate-cd').val(ui.value);
			options.rates.cd = parseFloat(ui.value);
			options.rates.mc = (options.rates.md / options.rates.cd).toFixed(3);
			updateNumbers();
			$('#rate-mc').text(options.rates.mc);
			$('#mc-slider').slider('value', options.rates.mc);
			validateRateLimits();
			options.save();
		}
	});
	$('#mc-slider').slider({
		range: 'min', value: options.rates.mc, min: rateLimits.mc.min, max: rateLimits.mc.max, step: 0.05,
		disabled: true
	});
	$('#mix-balance').slider({
		range: 'min', value: options.mixBalance, min: 0, max: 100, step: 5,
		slide: function(event, ui) {
			options.mixBalance = parseFloat(ui.value);
			$('#mix-balance-proc').val(options.mixBalance);
			if (options.dstType != 2 || options.dstMixType != 0) {
				options.dstMixType = 0;
				if (forceDstMix()) onUpdateDstType(); else onUpdateDstMixType();
			}
			updateNumbers();
			options.save();
		}
	});

	$('#hypertech-lvl').val(options.hyperTech);
	$('#country').val(options.country);
	setUniList(options.country, options.universe);

	$('#rate-md-min').text(rateLimits.md.min.toFixed(1));
	$('#rate-md-max').text(rateLimits.md.max.toFixed(1));
	$('#rate-cd-min').text(rateLimits.cd.min.toFixed(1));
	$('#rate-cd-max').text(rateLimits.cd.max.toFixed(1));
	$('#rate-mc-min').text(rateLimits.mc.min.toFixed(1));
	$('#rate-mc-max').text(rateLimits.mc.max.toFixed(1));
	$('#rate-md').val(options.rates.md);
	$('#rate-cd').val(options.rates.cd);
	$('#rate-mc').text(options.rates.mc);
	$('#mix-balance-proc').val(options.mixBalance);
	$('#mix-balance-prop1').val(options.mixProp1);
	$('#mix-balance-prop2').val(options.mixProp2);
	$('#coord-g').val(options.coordg ? options.coordg : '');
	$('#coord-s').val(options.coords ? options.coords : '');
	$('#coord-p').val(options.coordp ? options.coordp : '');
	$('#moon')[0].checked = options.moon;

	$('input').focusin(function() {
		$(this).addClass('ui-state-focus');
	});
	$('input').focusout(function() {
		$(this).removeClass('ui-state-focus');
	});

	$('#reset').click(resetParams);

	var rbf = function(r1, r2) {
		options.rates.md = r1;
		options.rates.cd = r2;
		options.rates.mc = (r1 / r2).toFixed(3);
		$('#rate-md').val(options.rates.md);
		$('#rate-cd').val(options.rates.cd);
		$('#rate-mc').text(options.rates.mc);
		$('#md-slider').slider('value', options.rates.md);
		$('#cd-slider').slider('value', options.rates.cd);
		$('#mc-slider').slider('value', options.rates.mc);
		updateNumbers();
		validateRateLimits();
		options.save();
	}
	$('#rb1').click(function() { rbf(4, 2); });
	$('#rb2').click(function() { rbf(3, 2); });
	$('#rb3').click(function() { rbf(3, 1.5); });
	$('#rb4').click(function() { rbf(2.5, 1.5); });
	$('#rb5').click(function() { rbf(2, 1.5); });
	$('#rb6').click(function() { rbf(2.4, 1.5); });

	validateRateLimits();

	$('#res-src input:radio').change(function(ev) { options.srcType = parseInt($(this).val()); onUpdateSrcType(); });
	$('#res-dst input[name=dst]').change(function(ev) { options.dstType = parseInt($(this).val()); onUpdateDstType(); });
	$('#dst-mix-block input:radio').change(function(ev) { options.dstMixType = parseInt($(this).val()); if (forceDstMix()) onUpdateDstType(); else onUpdateDstMixType(); });
	$('#mix-balance-proc').keyup(function(ev) { var n = clampNumber(getInputNumber(this), 0, 100); $('#mix-balance').slider('value', n); options.mixBalance = n; options.save(); });
	$('#mix-balance-prop1').keyup(function(ev) { options.mixProp1 = clampNumber(getInputNumber(this), 0, 100); options.save(); });
	$('#mix-balance-prop2').keyup(function(ev) { options.mixProp2 = clampNumber(getInputNumber(this), 0, 100); options.save(); });
	$('#res-src-panel input:text').keyup(updateNumbers);
	$('#dst-mix-block input:text').keyup(updateNumbers);
	$('#dst-mix-block input:text').focusin(function(ev) { activateDstMixType(this); });
	var cev = function(ev) { options.country = $('#country').val(); setUniList(options.country, options.universe); updateNumbers(); options.save(); }
	$('#country').change(cev).keyup(cev);
	var uev = function(ev) { options.universe = $('#universe').val(); updateNumbers(); options.save(); }
	$('#universe').change(uev).keyup(uev);
	$('#coord-g').keyup(function(ev) { options.coordg = clampNumber(getInputNumber(this), 0, 12); updateNumbers(); options.save(); });
	$('#coord-s').keyup(function(ev) { options.coords = clampNumber(getInputNumber(this), 0, 550); updateNumbers(); options.save(); });
	$('#coord-p').keyup(function(ev) { options.coordp = clampNumber(getInputNumber(this), 0, 15); updateNumbers(); options.save(); });
	$('#rate-md').keyup(function(ev) { options.rates.md = clampNumber(getInputNumber(this), 1, 5); $('#md-slider').slider('value', options.rates.md); options.rates.mc = (options.rates.md / options.rates.cd).toFixed(3); $('#rate-mc').text(options.rates.mc); $('#mc-slider').slider('value', options.rates.mc); updateNumbers(); validateRateLimits(); options.save(); });
	$('#rate-cd').keyup(function(ev) { options.rates.cd = clampNumber(getInputNumber(this), 1, 5); $('#cd-slider').slider('value', options.rates.cd); options.rates.mc = (options.rates.md / options.rates.cd).toFixed(3); $('#rate-mc').text(options.rates.mc); $('#mc-slider').slider('value', options.rates.mc); updateNumbers(); validateRateLimits(); options.save(); });
	$('#hypertech-lvl').keyup('updateNumbers', validateInputNumber);
	$('#moon').click(function(ev) { options.moon = $('#moon')[0].checked; updateNumbers(); options.save(); });

	var theme = $.cookie("theme");
	toggleLight(theme == 'light');
	$('#cb-light-theme').click(function(){toggleLight($('#cb-light-theme')[0].checked);});
	
	onUpdateSrcType();
} catch (e) {
	alert('Exception: ' + e);
}
});
