let options = {
	defConstraints: {
		min: -Infinity,
		max: Infinity,
		def: 0,
		allowFloat: false,
		allowNegative: false
	},
	rowsToTechs: [1, 2, 3, 4, 12, 212, 218, 0, 0, 0, 0, 0, 0, 0],
	minPlanetsCount: 1,
	maxPlanetsCount: 99,
	defPlanetsCount: 8,
	metStorageCap: 0,
	crysStorageCap: 0,
	deutStorageCap: 0,
	storageBlinkCount: 0,
	storagesBlinking: false,
	storagesToBlink: [0, 0, 0],
	editedPln: 0,

	prm: {
		energyTechLevel: 0,
		plasmaTechLevel: 0,
		universeSpeed: 1,
		geologist: false,
		engineer: false,
		technocrat: false,
		admiral: false,
		commander: false,
		maxTempEntered: false,
		maxPlanetTemp: 0,
		onePlnExtView: false,
		oPPP: [[0, 100, 0], [0, 100, 0], [0, 100, 0], [0, 100, 0], [0, 100, 0], [0, 100, 0], [0, 100, 0]],
		metStorageLvl: 0,
		crysStorageLvl: 0,
		deutStorageLvl: 0,
		currPlanetsCount: 8,
		aPPP: [[]],
		aPB: [[]],
		playerClass: 0,
		planetPos: 0,
		energyBoost: 0,
		aPS: [],
		aPNames: [],
		showAddInf: false,
		inclSats: 0,
		rates: [3, 2, 1],
		isTrader: false,

		validate: function (field, value) {
			switch (field) {
				case 'energyTechLevel':
					return validateNumber(parseFloat(value), 0, 50, 0);
				case 'plasmaTechLevel':
					return validateNumber(parseFloat(value), 0, 50, 0);
				case 'universeSpeed':
					return validateNumber(parseFloat(value), 1, 10, 1);
				case 'geologist':
					return value === 'true';
				case 'engineer':
					return value === 'true';
				case 'technocrat':
					return value === 'true';
				case 'admiral':
					return value === 'true';
				case 'commander':
					return value === 'true';
				case 'maxTempEntered':
					return value === 'true';
				case 'maxPlanetTemp':
					return validateNumber(parseFloat(value), -272, Infinity, 0);
				case 'onePlnExtView':
					return value === 'true';
				case 'oPPP':
					return validateNumber(parseFloat(value), -272, Infinity, 0);
				case 'currPlanetsCount':
					return validateNumber(parseFloat(value), 1, 99, 1);
				case 'aPPP':
					return validateNumber(parseFloat(value), -272, Infinity, 0);
				case 'aPB':
					return validateNumber(parseFloat(value), 0, 3, 0);
				case 'playerClass':
					return validateNumber(parseFloat(value), 0, 2, 0);
				case 'planetPos':
					return validateNumber(parseFloat(value), 1, 16, 8);
				case 'energyBoost':
					return validateNumber(Number.parseInt(value), 0, 4, 0);
				case 'aPS':
					return validateNumber(Number.parseInt(value), -272, Infinity, 0);
				case 'showAddInf':
					return value === 'true';
				case 'inclSats':
					return value === 'true';
				case 'rates':
					return validateNumber(parseFloat(value), 1, 4, 1);
				case 'isTrader':
					return value === 'true';
				default:
					return value;
			}
		}
	},

	load: function (key) {
		try {
			loadFromCookie(key, options.prm);
		} catch (e) {
			consoleLog(e);
			resetParams();
		}
//		consoleLog("loaded from cookies: ");
		try {
			if (options.prm.aPS.length === 0)
				convertAllPlanetParams();
		} catch(e) {
			resetParams();
		}

		populateParams();
		if (options.prm.planetPos === 0)
			resetParams();

		setOnePlanetProdData();
		setOnePlanetView(options.prm.onePlnExtView);

		$('#planetsSpin').val(options.prm.currPlanetsCount);
		prepAllPlanetsTable();
	},

	save: function () {
		saveToCookie('options_production', options.prm);
//		consoleLog('saved to cookie');
//		consoleLog(options.prm);
	}
};

function convertAllPlanetParams() {
	let prm = [];
	options.prm.aPS = [];
	let names = [];
	for (let i = 0; i < options.prm.currPlanetsCount; i++) {
		prm = [];
		names[i] = options.planetNumStr + (i + 1);
		// 0 - температура, 1-6 - шахты, электростанции и лампочки, 7 - гусеничники, 8 - позиция
		prm[0] = options.prm.aPPP[i][0]; // температура
		prm[1] = options.prm.aPPP[i][8]; // позиция
		prm[2] = 0; // бустер энергии
		for (let j = 1; j < 8; j++) {
			if (options.prm.aPPP[i][j] === undefined) {
				prm[j*3] = 0;
			} else {
				prm[j*3] = options.prm.aPPP[i][j]; // уровень (исторически сложившийся порядок)
			}
			prm[j*3 + 1] = 100; // коэффициент производства
			prm[j*3 + 2] = 0; // бустер
		}
		options.prm.aPS[i] = prm;
	}
	options.prm.aPNames = names;
	options.prm.aPPP = [[]];
	options.prm.aPB = [[]];
}

function createEmptyPlanet() {
	let prm = [];
	// 0 - температура, 1-6 - шахты, электростанции и лампочки, 7 - гусеничники, 8 - позиция
	prm[0] = 0; // температура
	prm[1] = 8; // позиция
	prm[2] = 0; // бустер энергии
	for (let j = 1; j < 8; j++) {
		prm[j*3] = 0;
		prm[j*3 + 1] = 100; // коэффициент производства
		prm[j*3 + 2] = 0; // бустер
	}
	return prm;
}

function populateParams() {
	$('#universe-speed').val(options.prm.universeSpeed);
	$('#energy-tech-level')[0].value = options.prm.energyTechLevel;
	$('#plasma-tech-level')[0].value = options.prm.plasmaTechLevel;
	$('#max-planet-temp')[0].value = options.prm.maxPlanetTemp;
	$('#one-pln-extended-view')[0].checked = options.prm.onePlnExtView;
	$('#planet-pos')[0].value = options.prm.planetPos;
	$('#engineer')[0].checked = options.prm.engineer;
	$('#geologist')[0].checked = options.prm.geologist;
	$('#technocrat')[0].checked = options.prm.technocrat;
	$('#admiral')[0].checked = options.prm.admiral;
	$('#commander')[0].checked = options.prm.commander;
	$('#class-'+options.prm.playerClass).attr('checked', true);
	$('#energy-boost').val(options.prm.energyBoost);
	$('#all-pln-addtnl-info')[0].checked = options.prm.showAddInf;
	$('#exchange-rates-m').val(String(options.prm.rates[0]).replace('.', options.decimalSeparator));
	$('#exchange-rates-c').val(String(options.prm.rates[1]).replace('.', options.decimalSeparator));
	$('#exchange-rates-d').val(String(options.prm.rates[2]).replace('.', options.decimalSeparator));
	$('#include-SS-'+(options.prm.inclSats ? 'y' : 'n')).attr('checked', true);
	$('#is-trader')[0].checked = options.prm.isTrader;
}

function setOnePlanetProdData() {
	let rows = $('#one-planet-prod tr');
	for (let i = 0; i < options.prm.oPPP.length; i++) {
		rows[i+2].children[2].children[0].value = options.prm.oPPP[i][0]; 
		if (i < 6)
			rows[i+2].children[7].children[0].selectedIndex = (100 - options.prm.oPPP[i][1])/10;
		if (i === 6)
			rows[i+2].children[7].children[0].selectedIndex = (150 - options.prm.oPPP[i][1])/10;
		if (i < 3)
			rows[i+2].children[1].children[0].selectedIndex = options.prm.oPPP[i][2];
	}

	$('#storage-met')[0].value = options.prm.metStorageLvl;
	$('#storage-crys')[0].value = options.prm.crysStorageLvl;
	$('#storage-deut')[0].value = options.prm.deutStorageLvl;
}

function prepAllPlanetsTable() {
	let targetTbl = $('#all-planets-prod tr');
	let rowCount = targetTbl.length;
	let footer = targetTbl.slice(rowCount - 5).detach();
	targetTbl.slice(1).remove();
	let prodTbl = $('#all-planets-prod');
	let inputClass;

	for (let i = 0; i < options.prm.currPlanetsCount; i++) {
		let tr = '<tr class="'+((i % 2) === 0 ? 'odd' : 'even')+'">';
		tr += '<td>&nbsp;' + (i+1) +'&nbsp;</td>';
		tr += '<td>' + options.prm.aPNames[i] +'</td>';
		// температура и позиция
		tr += '<td><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-3columns temperature-input centered" value="'+options.prm.aPS[i][0]+'" alt="'+options.maxTempAlt+'"/></td>';
		tr += '<td><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-2columns position-input centered" value="'+options.prm.aPS[i][1]+'" alt="'+options.positionAlt+'"/></td>';
		for (let j = 1; j < 8; j++) {
			// заготовка: уровень и нулевое производство
			inputClass = 'ui-state-default ui-corner-all ui-input no-mp input-' + (j < 6 ? '2columns centered' : '4columns centered');
			tr += '<td class="centered"><input type="text" class="' + inputClass + '" value="'+options.prm.aPS[i][j*3]+'"/></td>';
			if (j < 4) {
				tr += '<td class="centered">0</td>';
			}
		}
		tr += '<td class="centered">0</td>'; // коэффициент - тоже заготовка
		tr += '<td><div id="control-' + i + '"><button id="control-' + i + '-e" class="control-btn"></button>';
		tr += '<button id="control-' + i + '-d" class="control-btn"></button></div></td>';
		prodTbl.append(tr);
		let newInputs = $('#all-planets-prod tr:eq(' + (i * 2 + 1) + ') input:text');
		newInputs.keyup('updateAllPlnTab', validateInputNumber);
		newInputs.blur('updateAllPlnTab', validateInputNumberOnBlur);
		newInputs[0]._constrains = {'min': -134, 'def': 0, 'allowNegative': true};
		newInputs[1]._constrains = {'min': 1, 'max': 16, 'def': 8, 'allowNegative': false};

		$('#control-' + i).buttonset();
		let editBtn = $('#control-' + i + '-e');
		editBtn.button( { icons: {primary:'ui-icon-pencil'} } );
		editBtn.click(i, editRow);
		let deleteBtn = $('#control-' + i + '-d');
		deleteBtn.button( { icons: {primary:'ui-icon-close'} } );
		deleteBtn.click(i, deleteRow);
		// дополнительная информационная строка
		tr = '<tr class="'+((i % 2) === 0 ? 'odd' : 'even')+'">';
		let spanType = options.prm.showAddInf ? 'visible-span' : 'hidden-span';
		tr += '<td></td><td><span class="' + spanType + '">' + options.addtnlRowHeader +'</span></td><td colspan="2"><span class="' + spanType + '"></span></td>';
		for (let i = 0; i < 10; i++)
			tr += '<td><span class="' + spanType + '"></span></td>';
		tr += '<td colspan="3"></td>';
		prodTbl.append(tr);
	}
	$('#all-planets-accordion select').keyup(updateAllPlnTab);
	$('#all-planets-accordion select').change(updateAllPlnTab);
	footer.appendTo('#all-planets-prod');
}

function resetParams() {
	options.prm.energyTechLevel = 0;
	options.prm.plasmaTechLevel = 0;
	options.prm.universeSpeed = 1;
	options.prm.geologist = false;
	options.prm.engineer = false;
	options.prm.technocrat = false;
	options.prm.admiral = false;
	options.prm.commander = false;
	options.prm.maxTempEntered = false;
	options.prm.maxPlanetTemp = 0;
	options.prm.planetPos = 8;
	options.prm.onePlnExtView = false;
	options.prm.oPPP = [[0, 100, 0], [0, 100, 0], [0, 100, 0], [0, 100, 0], [0, 100, 0], [0, 100, 0], [0, 100, 0]];
	options.prm.metStorageLvl = 0;
	options.prm.crysStorageLvl = 0;
	options.prm.deutStorageLvl = 0;
	options.prm.currPlanetsCount = 8;
	options.prm.playerClass = 0;
	options.prm.energyBoost = 0;
	options.prm.showAddInf = false;
	options.prm.inclSats = false;
	options.prm.rates = [3, 2, 1];
	options.prm.isTrader = false;

	populateParams();
	$('#storage-met')[0].value = 0;
	$('#storage-crys')[0].value = 0;
	$('#storage-deut')[0].value = 0;
	$('#onepln-curr-met')[0].value = 0;
	$('#onepln-curr-crys')[0].value = 0;
	$('#onepln-curr-deut')[0].value = 0;
	$('#onepln-accumwhat-d')[0].value = 0;
	$('#onepln-accumwhat-h')[0].value = 0;
	$('#onepln-accumwhat-m')[0].value = 0;
	$('#onepln-accumwhen-met')[0].value = 0;
	$('#onepln-accumwhen-crys')[0].value = 0;
	$('#onepln-accumwhen-deut')[0].value = 0;
	$('#one-pln-extended-view')[0].checked = options.prm.onePlnExtView;
	setOnePlanetProdData();
	updateOnePlnTab();
	setOnePlanetView(options.prm.onePlnExtView);

	$('#all-pln-addtnl-info')[0].checked = options.prm.showAddInf;
	options.prm.currPlanetsCount = options.defPlanetsCount;
	$('#planetsSpin')[0].value = options.defPlanetsCount;
	options.prm.aPS = [];
	options.prm.aPNames = [];
	for (let i = 0; i < options.prm.currPlanetsCount; i++) {
		options.prm.aPNames.push(options.planetNumStr + (i+1));
		options.prm.aPS.push(createEmptyPlanet());
	}

	prepAllPlanetsTable();
	updateAllPlnTab();
}

//Учитывает изменения в параметрах: энерготеха, скорость вселенной, офицеры и класс.
function updateParams() {
	let uniSpeed = $('#universe-speed')[0].value;
	let energyTechLevel = getInputNumber($('#energy-tech-level')[0]);
	let plasmaTechLevel = getInputNumber($('#plasma-tech-level')[0]);
	let engineer = $('#engineer')[0].checked;
	let geologist = $('#geologist')[0].checked;
	let technocrat = $('#technocrat')[0].checked;
	let admiral = $('#admiral')[0].checked;
	let commander = $('#commander')[0].checked;
	if ($('#class-2').attr('checked'))
		options.prm.playerClass = 2;
	else {
		if ($('#class-1').attr('checked'))
			options.prm.playerClass = 1;
		else 
			options.prm.playerClass = 0;
	}
	let isTrader = $('#is-trader')[0].checked;
	
	options.prm.universeSpeed = uniSpeed;
	options.prm.energyTechLevel = energyTechLevel;
	options.prm.plasmaTechLevel = plasmaTechLevel;
	options.prm.geologist = geologist;
	options.prm.engineer = engineer;
	options.prm.technocrat = technocrat;
	options.prm.admiral = admiral;
	options.prm.commander = commander;
	options.prm.energyBoost = $('#energy-boost')[0].value;
	options.prm.isTrader = isTrader;
	
	updateOnePlnTab();
	updateAllPlnTab();
}

function updateAccumulation(tab, production) {
	if (tab !== 'one' && tab !== 'all')
		return;
	// Панелька "Сколько накопится"
	let currMet = getInputNumber($('#' + tab + 'pln-curr-met')[0]);
	let currCrys = getInputNumber($('#' + tab + 'pln-curr-crys')[0]);
	let currDeut = getInputNumber($('#' + tab + 'pln-curr-deut')[0]);
	let days = getInputNumber($('#' + tab + 'pln-accumwhat-d')[0]);
	let hours = getInputNumber($('#' + tab + 'pln-accumwhat-h')[0]);
	let minutes = getInputNumber($('#' + tab + 'pln-accumwhat-m')[0]);
	let totalHours = days * 24 + hours + minutes / 60.0;

	let deutAccum = Math.round(currDeut + totalHours * production[2]);
	if (deutAccum < 0)
		deutAccum = 0;
		
	if (tab === 'one') {
		$('#'+tab+'pln-accumwhat-met')[0].innerHTML = numToOGame(Math.min(options.metStorageCap, Math.round(currMet + totalHours * production[0])));
		$('#'+tab+'pln-accumwhat-crys')[0].innerHTML = numToOGame(Math.min(options.crysStorageCap, Math.round(currCrys + totalHours * production[1])));
		$('#'+tab+'pln-accumwhat-deut')[0].innerHTML = numToOGame(Math.min(options.deutStorageCap, deutAccum));
	} else {
		$('#'+tab+'pln-accumwhat-met')[0].innerHTML = numToOGame(Math.round(currMet + totalHours * production[0]));
		$('#'+tab+'pln-accumwhat-crys')[0].innerHTML = numToOGame(Math.round(currCrys + totalHours * production[1]));
		$('#'+tab+'pln-accumwhat-deut')[0].innerHTML = numToOGame(deutAccum);
	}

	// Панелька "Когда накопится"
	let needMet = getInputNumber($('#' + tab + 'pln-accumwhen-met')[0]);
	let needCrys = getInputNumber($('#' + tab + 'pln-accumwhen-crys')[0]);
	let needDeut = getInputNumber($('#' + tab + 'pln-accumwhen-deut')[0]);

//	Если что-то превышено, отметим, что надо поморгать максимальным объёмом конкретного хранилища, и сбросим счётчик морганий, чтобы процесс начался снова
	if (options.metStorageCap < Math.round(currMet + totalHours * production[0]) || needMet > options.metStorageCap) {
		options.storagesToBlink[0] = 1;
		options.storageBlinkCount = 0;
	} else {
		options.storagesToBlink[0] = 0;
	}
	if (options.crysStorageCap < Math.round(currCrys + totalHours * production[1]) || needCrys > options.crysStorageCap) {
		options.storagesToBlink[1] = 1;
		options.storageBlinkCount = 0;
	} else {
		options.storagesToBlink[1] = 0;
	}
	if (options.deutStorageCap < deutAccum || needDeut > options.deutStorageCap) {
		options.storagesToBlink[2] = 1;
		options.storageBlinkCount = 0;
	} else {
		options.storagesToBlink[2] = 0;
	}
	if ((options.storagesToBlink[0] === 1 || options.storagesToBlink[1] === 1 || options.storagesToBlink[2] === 1) && !options.storagesBlinking) {
		options.storagesBlinking = true;
		blinkMaxStorage(options.storagesToBlink);
	}

	let t = 0;
	// вычислим время в часах, за которое накопится требуемое кол-во каждого из ресурсов и возьмём максимум из этих интервалов
	if (needMet > currMet) {
		t = (needMet - currMet) / production[0];
	}
	if (needCrys > currCrys) {
		t = Math.max(t, (needCrys - currCrys) / production[1]);
	}
	if (needDeut > currDeut) {
		if (production[2] <= 0) { // есть два варианта, почему производство отрицательное или нулевое:
			if (options.prm.oPPP[2][0] === 0) // вообще нет синтезатора
				t = Number.POSITIVE_INFINITY
			else // ...или термояд забирает больше, чем производится
				t = Number.NEGATIVE_INFINITY;
		} else {
			t = Math.max(t, (needDeut - currDeut) / production[2]);
		}
	}

	if (!Number.isFinite(t)) {
		if (t === Number.POSITIVE_INFINITY) {
			$('#'+tab+'pln-accumwhen-msg')[0].innerHTML = options.resWillNotAccumMsg;
		} else {
			$('#'+tab+'pln-accumwhen-msg')[0].innerHTML = options.resWillNotAccumMsg1;
		}
	} else {
		if (t > 0) {
			$('#'+tab+'pln-accumwhen-msg')[0].innerHTML = options.resReadyInMsg + timespanToShortenedString(t*3600, options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true);
		} else {
			$('#'+tab+'pln-accumwhen-msg')[0].innerHTML = options.enoughResAlreadyMsg;
		}
	}
}

function updateProduction(tab, production) {
	if (tab !== 'one' && tab !== 'all')
		return;
	let durations = [1, 24, 168];	// продолжительность накопления ресов: час, день, неделя
	let fleetRows = $('#' + tab + '-pln-fleet-prod tr').slice(1);
	let defenseRows = $('#' + tab + '-pln-defense-prod tr').slice(1);
	let minCount = Number.POSITIVE_INFINITY;
	for (let d = 0; d < 3; d++) {
		let duration = durations[d];
		let idx = 0;
		for (let i in options.fleetCosts) {
			minCount = Number.POSITIVE_INFINITY;
			for (var res = 0; res < 3; res++) {
				var producedRes = duration*production[res];
				if (producedRes < 0)
					producedRes = 0;
				if (options.fleetCosts[i][res] > 0)
					minCount = Math.min(minCount, Math.floor(producedRes/options.fleetCosts[i][res]));
			}
			fleetRows[idx++].children[d+1].innerHTML = minCount;
		}
		idx = 0;
		for (let i in options.defenseCosts) {
            minCount = Number.POSITIVE_INFINITY;
            for (let res = 0; res < 3; res++) {
                let producedRes = duration * production[res];
                if (producedRes < 0)
					producedRes = 0;
				if (options.defenseCosts[i][res] > 0)
					minCount = Math.min(minCount, Math.floor(producedRes/options.defenseCosts[i][res]));
			}
			// Куполов больше одного всё равно не построишь
			if (i === '407' || i === '408') // Индексы свойств объекта - строковые
				minCount = Math.min(minCount, 1);
			defenseRows[idx++].children[d+1].innerHTML = minCount;
		}
	}
}

function updateOnePlnTab() {
	let i;
	options.prm.maxPlanetTemp = getInputNumber($('#max-planet-temp')[0]);
	options.prm.planetPos = getInputNumber($('#planet-pos')[0]);
	options.prm.energyBoost = $('#energy-boost')[0].value;
	let plnData = [options.prm.maxPlanetTemp, options.prm.planetPos, options.prm.energyBoost];
	//            Met. mine Crys. mine  Deut. syn  Sol.plant  Fus.plant  Sol.sat.   Crawler 
	let params = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]; // Level/Count, PowerFactor, Booster
	let rows = $('#one-planet-prod tr');
	for (i = 2; i < 9; i++) {
		params[i-2][0] = getInputNumber(rows[i].children[2].children[0]);
		params[i-2][1] = rows[i].children[7].children[0].value;
		if (i > 4) { // У электростанций, лампочек и Гусеничников нет бустеров
			params[i-2][2] = 0.0; 
		} else {
			params[i-2][2] = rows[i].children[1].children[0].value;
		}
	}

	let prodData = calculateProduction(params, plnData, false);
	let results = prodData[0];
	let production = prodData[1];
	let totalEnergyProduced = prodData[2];
	let totalEnergyUsed = prodData[3];
	let koeff = prodData[4];
	
	$('#prod-coeff')[0].innerHTML = '<b>'+Math.floor(koeff * 100)+'%</b>';
	let theme = { value: 'light', validate: function(key, val) { return val; } };
	loadFromCookie('theme', theme);
	let color = koeff < 1 ? "brown" : (theme.value === "light" ? "black" : "white");
	$('#prod-coeff').css('color', color);
	
	// Выведем данные о текущем производстве и подведем итоги
	let resultRow = options.rowsToTechs.length + 3;
	let val, cons = 0;
	for (let row = 0; row < 15; row++) {
		for (let col = 0; col < 4; col++) {
			if (row > 0 && row < 4 && col === 3) {
				cons = results[row][4];
				if (cons > 0)
					$(rows[row + 1].children[6]).html(numToOGame(Math.round(koeff * cons))+'/'+numToOGame(cons));
				else
					$(rows[row + 1].children[6]).html('');
				continue;
			}
			val = results[row][col] >= 0 ? numToOGame(results[row][col]) : '<span style="color: brown;">'+numToOGame(-1 * results[row][col])+'</span>';
			if (results[row][col] === 0)
				val = '';
			$(rows[row + 1].children[col + 3]).html(val);
		}
	}

	let lb, rb, s;
	for (i = 1; i < 4; i++) {
		if (production[i - 1] < 0) {
			lb = '<span style="color: brown;">';
			rb = '</span>';
			s = -1;
		} else {
			lb = '';
			rb = '';
			s = 1;
		}
		$(rows[resultRow].children[2 + i]).html(lb + numberToShortenedString(s * production[i - 1], options.unitSuffix) + rb);
		$(rows[resultRow + 1].children[2 + i]).html(lb + numberToShortenedString(24 * s * production[i - 1], options.unitSuffix) + rb);
		$(rows[resultRow + 2].children[2 + i]).html(lb + numberToShortenedString(7 * 24 * s * production[i - 1], options.unitSuffix) + rb);
	}
	//var energyLeft = numberToShortenedString(Math.round(totalEnergyProduced - totalEnergyUsed), options.unitSuffix);
	let energyLeft = Math.round(totalEnergyProduced - totalEnergyUsed);
	let spanColor = energyLeft < 0 ? "brown" : (theme === "light" ? "black" : "white");
	energyLeft =  numberToShortenedString(Math.abs(energyLeft), options.unitSuffix);
	$(rows[resultRow].children[6]).html('<span style="color: '+spanColor+';">'+energyLeft+'</span>');
	$(rows[resultRow + 1].children[6]).html('<span style="color: '+spanColor+';">'+energyLeft+'</span>');
	$(rows[resultRow + 2].children[6]).html('<span style="color: '+spanColor+';">'+energyLeft+'</span>');
	options.prm.oPPP = params;

	rows = $('#mines-amort-tbl tr');
	let currProd = calculateProduction(params, plnData, true);
	let paramsCopy = params.map(function(arr) {
		return arr.slice();
	});
	paramsCopy[0][0] = paramsCopy[0][0]+1; paramsCopy[1][0] = paramsCopy[1][0]+1; paramsCopy[2][0] = paramsCopy[2][0]+1;
	let newProd = calculateProduction(paramsCopy, plnData, true);
	let increase;
	let rates = [];
	rates[0] = getInputNumber($('#exchange-rates-m')[0]);
	if (rates[0] === 0) rates[0] = 3;
	rates[1] = getInputNumber($('#exchange-rates-c')[0]);
	if (rates[1] === 0) rates[1] = 2;
	rates[2] = getInputNumber($('#exchange-rates-d')[0]);
	if (rates[2] === 0) rates[2] = 1;
	options.prm.rates = rates;
	let totalCost;
	let amortTime;
	let satsCost = [];
	let resMult;
	options.prm.inclSats = $('#include-SS-y').attr('checked');
	for (let i = 1; i < 4; i++)	{
		let costs = getBuildCost_C(i, options.prm.oPPP[i-1][0], options.prm.oPPP[i-1][0] + 1, options.bldCosts, 0);
		if (options.prm.inclSats) {
			satsCost = getSSCost(i, options.prm.oPPP[i-1][0], plnData);
			costs[1] += satsCost[1];
			costs[2] += satsCost[2];
			$(rows[i].children[1]).html(numberToShortenedString(costs[0], options.unitSuffix) + ' ' + options.metal + ', ' +
				numberToShortenedString(costs[1], options.unitSuffix) + ' ' + options.crystal + ', ' +
				numberToShortenedString(costs[2], options.unitSuffix) + ' ' + options.deuterium);
			totalCost = costs[0] + (rates[0] / rates[1]) * costs[1]  + (rates[0] / rates[2]) * costs[2];
		} else {
			$(rows[i].children[1]).html(numberToShortenedString(costs[0], options.unitSuffix) + ' ' + options.metal + ', ' +
				numberToShortenedString(costs[1], options.unitSuffix) + ' ' + options.crystal);
			totalCost = costs[0] + (rates[0] / rates[1]) * costs[1];
		}
		switch (i) {
			case 1: resMult = 1; break;
			case 2: resMult = rates[0] / rates[1]; break;
			case 3: resMult = rates[0] / rates[2]; break;
			default: resMult = 1;
		}
		increase = newProd[1][i-1] - currProd[1][i-1];
		$(rows[i].children[2]).html(numberToShortenedString(increase, options.unitSuffix));
		amortTime = totalCost / (increase  * resMult);
		$(rows[i].children[3]).html(timespanToShortenedString(Math.ceil(amortTime*3600), options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true));
	}

	options.prm.metStorageLvl = getInputNumber($('#storage-met')[0]);
	options.metStorageCap = getStorageCapacity(options.prm.metStorageLvl);
	$('#storage-cap-met')[0].innerHTML = numToOGame(options.metStorageCap);
	
	options.prm.crysStorageLvl = getInputNumber($('#storage-crys')[0]);
	options.crysStorageCap = getStorageCapacity(options.prm.crysStorageLvl);
	$('#storage-cap-crys')[0].innerHTML = numToOGame(options.crysStorageCap);
	
	options.prm.deutStorageLvl = getInputNumber($('#storage-deut')[0]);
	options.deutStorageCap = getStorageCapacity(options.prm.deutStorageLvl);
	$('#storage-cap-deut')[0].innerHTML = numToOGame(options.deutStorageCap);

	updateAccumulation('one', production);
	updateProduction('one', production);
	options.save();
}

function getSSCost(techID, currLvl, plnData) {
	let currCons = getHourlyConsumption(techID, currLvl, options.prm.uniSpeed, 1);
	let newCons = getHourlyConsumption(techID, currLvl + 1, options.prm.uniSpeed, 1);
	//consoleLog( currCons+', '+ newCons);
	let energyReq = newCons - currCons;
	let fullCrew = options.prm.geologist && options.prm.engineer && options.prm.admiral && options.prm.commander && options.prm.technocrat;
	// plnData = [темп., поз., бустер]
	let oneSSProd = getProductionRate(212, 1, options.prm.energyTechLevel, options.prm.plasmaTechLevel, plnData[0], plnData[1],
		options.prm.uniSpeed, options.prm.geologist, options.prm.engineer, 1, 1, fullCrew, options.prm.playerClass);
	let boosterFactor = 0.1 * plnData[2];
	let engineerFactor = (options.prm.engineer === true) ? 0.1 : 0;
	let allStaffFactor = fullCrew === true ? 0.02 : 0;
	let classFactor = options.prm.playerClass === 0 ? 0.1 : 0;
	let allianceClassFactor = options.prm.isTrader ? 0.05 : 0;
	let totalEnergyProd = oneSSProd;
	totalEnergyProd += Math.round(oneSSProd * boosterFactor);
	totalEnergyProd += Math.round(oneSSProd * engineerFactor);
	totalEnergyProd += Math.round(oneSSProd * allStaffFactor);
	totalEnergyProd += Math.round(oneSSProd * classFactor);
	totalEnergyProd += Math.round(oneSSProd * allianceClassFactor);
	let satsCount = Math.ceil(energyReq / totalEnergyProd);
	//consoleLog(techID +', '+ currLvl +', '+ satsCount);
	let techData = {212: [0, 2000, 500, 1]};
	return getBuildCost_C(212, 0, satsCount, techData);
}

function calculateProduction(prodParams, plnData) {
	return calculateProduction(prodParams, plnData, false);
}

function calculateProduction(prodParams, plnData, normalized) {
	let results = [];
	let production = [0, 0, 0];
	// 0-нат.пр-во, 1-шахта мет., 2-шахта крис., 3-синт.дейт., 4-сол.эл/ст,
	// 5--термояд.эл/ст., 6-сол.спут., 7-гусен., 8-плазм.тех., 9-предметы,
	// 10-геолог, 11-инженер, 12-ком.состав, 13-класс
	for (var i = 0; i < 15; i++) { results.push([0, 0, 0, 0, 0]);} // мет, крис, дейт, энергии производится, энергии требуется
	var energy = 0, level = 0, perCent = 0, deutCons = 0, totalEnergyProduced = 0, totalEnergyUsed = 0, booster = 0;	
	var fullCrew = options.prm.geologist && options.prm.engineer && options.prm.admiral && options.prm.commander && options.prm.technocrat;
	let energyArray;
	for (var i = 3; i < 6; i++) {
		// Сначала вычислим произоводимую энергию
		// Возьмём из таблицы данные об уровне постройки и проценте мощности, на который она работает
		level = prodParams[i][0];
		perCent = prodParams[i][1];
		// Для расчёта коэффициента производства нам нужны неокруглённые значения производимой энергии, поэтому на процент мощности умножаем после - FIXME? это действительно нужно?
		if (level > 0) {
			energyArray = getProductionRateSplit(options.rowsToTechs[i], level, options.prm.energyTechLevel, 0, plnData[0], plnData[1], options.prm.universeSpeed, options.prm.geologist,
				options.prm.engineer, 1, perCent / 100.0, 0, fullCrew, options.prm.playerClass, options.prm.isTrader);
			energy = energyArray[1];
			// базовую производимую энергию запишем в строку для эл.станции/спутника
			results[i + 1][3] = energyArray[1];
		} else {
			energy = 0;
		}
		totalEnergyProduced += energy;
		// Для термоядерной электростанции надо показать, сколько дейтерия она потребляет
		if (options.rowsToTechs[i] === 12) {
			if (level > 0) {
				deutCons = getHourlyConsumption(12, level, options.prm.universeSpeed, perCent / 100.0);
			} else {
				deutCons = 0;
			}
			results[i + 1][2] = -deutCons;
			production[2] = -deutCons;
		}
	}
		
	var energyBalance = totalEnergyProduced; // базу для расчёта бонусов энергии нужно считать до Гусеничников
	if (energyBalance < 0 ) energyBalance = 0;
	var boosterFactor = 0.1 * plnData[2];
	var engineerFactor = (options.prm.engineer === true) ? 0.1 : 0;
	var allStaffFactor = fullCrew === true ? 0.02 : 0;
	var classFactor = options.prm.playerClass === 0 ? 0.1 : 0;
	let allianceClassFactor = options.prm.isTrader ? 0.05 : 0;
	results[9][3] = Math.round(energyBalance * boosterFactor);
	results[11][3] = Math.round(energyBalance * engineerFactor);
	results[12][3] = Math.round(energyBalance * allStaffFactor);
	results[13][3] = Math.round(energyBalance * classFactor);
	results[14][3] = Math.round(energyBalance * allianceClassFactor);
	totalEnergyProduced += results[9][3] + results[11][3] + results[12][3] + results[13][3] + results[14][3];
	
	// Мы знаем, сколько всего производится энергии на планете - теперь нужно узнать, сколько её потребляется
	for (var i = 0; i < 3; i++) {
		level = prodParams[i][0];
		perCent = prodParams[i][1];
		if (level > 0) {
			energy = getHourlyConsumption(options.rowsToTechs[i], level, options.prm.universeSpeed, perCent / 100.0);
		} else {
			energy = 0;
		}
		results[i+1][4] = energy;
		totalEnergyUsed += energy;
	}
	// Гусеничники в 6й строке
	var cralwersPwrPcnt = prodParams[6][1] / 100.0;
	var crawlersOlPcnt = 0;
	if (cralwersPwrPcnt > 1) {
		crawlersOlPcnt = cralwersPwrPcnt - 1;
		cralwersPwrPcnt = 1;
	}
	let crawlersEenergyCons = Math.round((prodParams[6][0] * (cralwersPwrPcnt + crawlersOlPcnt * 2)) * 50);
	results[7][3] = -crawlersEenergyCons;
	totalEnergyUsed += crawlersEenergyCons;
	
	var koeff = 1.0;
	if (totalEnergyUsed > 0)
		koeff = totalEnergyProduced / (totalEnergyUsed);
	if (koeff > 1) {
		koeff = 1;
	}

	var prod = 0;
	let prodFactor = normalized ? 1 : koeff;

	for (var i = 0; i < 3; i++) {
		let pwrFactor = normalized ? 1 : prodParams[i][1] / 100.0;
		prod = getProductionRateSplit(options.rowsToTechs[i], prodParams[i][0], options.prm.energyTechLevel, options.prm.plasmaTechLevel, plnData[0], plnData[1], 
				options.prm.universeSpeed, options.prm.geologist, options.prm.engineer, prodFactor, pwrFactor, prodParams[i][2], fullCrew, options.prm.playerClass, options.prm.isTrader);
		//console.log(prod);		
		// Сохраним данные о производстве ресурсов
		results[0][i] += prod[0];  // естественное производство
		production[i] += prod[0];
		results[i + 1][i] += prod[1];  // производство на руднике
		production[i] += prod[1];
		for (var line = 8; line < 15; line++) {
				results[line][i] += prod[line - 6];
				production[i] += prod[line - 6];
		}
	}
	//console.log(results);
	let crMult = options.prm.playerClass === 0 ? 1.5 : 1;
	results[7][0] = Math.round(results[1][0] * prodParams[6][0] * 0.0002 * crMult * prodParams[6][1]/100.0);
	production[0] += results[7][0];
	results[7][1] = Math.round(results[2][1] * prodParams[6][0] * 0.0002 * crMult * prodParams[6][1]/100.0);
	production[1] += results[7][1];
	results[7][2] = Math.round(results[3][2] * prodParams[6][0] * 0.0002 * crMult * prodParams[6][1]/100.0);
	production[2] += results[7][2];

	return [results, production, totalEnergyProduced, totalEnergyUsed, koeff];
}

function changePlanetsCount(newVal, oldVal) {
	if (newVal < options.minPlanetsCount || newVal > options.maxPlanetsCount)
		return;
	if (newVal < oldVal) {
		if (!isPlnEmpty(oldVal-1) && confirm(options.plnDelConfMsg) === false) {
			$('#planetsSpin').val(oldVal);
			return;
		}
		let plnID = oldVal - 1;
		options.prm.aPNames.splice(plnID, 1);
		options.prm.aPS.splice(plnID, 1);
		options.prm.currPlanetsCount--;
	} else {
		let plnID = options.prm.currPlanetsCount;
		options.prm.currPlanetsCount++;
		options.prm.aPNames[plnID] = options.planetNumStr + newVal;
		options.prm.aPS[plnID] = createEmptyPlanet();
	}
	prepAllPlanetsTable();
	updateAllPlnTab();
}

function updateAllPlnTab() {
	let planetsCount = options.prm.currPlanetsCount;
	let plnData;
	let prodParams;
	let rows = $('#all-planets-prod tr');
	let totalProd = [0, 0, 0];
	let levelColumns = [4, 6, 8, 10, 11, 12, 13];
	for (let i = 0; i < planetsCount; i++) {
		// считаем в массив данные из input-ов таблицы на случай, если имело место прямое редактирование
		options.prm.aPS[i][0] = getInputNumber(rows[i*2 + 1].children[2].children[0]);
		options.prm.aPS[i][1] = getInputNumber(rows[i*2 + 1].children[3].children[0]);
		for (let j = 1; j < 8; j++) {
			options.prm.aPS[i][j*3] = rows[i*2 + 1].children[levelColumns[j - 1]].children[0].value;
		}

		prodParams = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
		for (let j = 1; j < 8; j++) {
			prodParams[j-1][0] = options.prm.aPS[i][j*3];
			prodParams[j-1][1] = options.prm.aPS[i][j*3 + 1];
			prodParams[j-1][2] = options.prm.aPS[i][j*3 + 2];
		}
		plnData = [options.prm.aPS[i][0], options.prm.aPS[i][1], options.prm.aPS[i][2]];

		let prodData = calculateProduction(prodParams, plnData);
		let production = prodData[1];
		let koeff = prodData[4];
		//consoleLog(prodData);
		$(rows[i*2 + 1].children[14]).html(Math.floor(koeff * 100) + '%'); // в последний столбец таблицы запишем коэффициент производства

		// Покажем бустер энергии планеты
		$(rows[i*2 + 2].children[2].children[0]).html(options.energyShort + 10*options.prm.aPS[i][2] + '%');
		for (let j = 0; j < 3; j++) {
			// Покажем производство ресурсов с учётом выбранных процентов мощности работы рудников
			$(rows[i*2 + 1].children[levelColumns[j] + 1]).html(numToOGame(production[j]));
			// ...а также бустеры и факторы производства
			$(rows[i*2 + 2].children[levelColumns[j] - 1].children[0]).html(// поправка на colspan=2
				10 * options.prm.aPS[i][(j + 1)*3 + 2] + '% / ' + options.prm.aPS[i][(j + 1)*3 + 1] + '%');
		}
		for (let j = 3; j < 7; j++) {
			// Для электростанций, лампочек и Гусеничников - только факторы производства
			$(rows[i*2 + 2].children[levelColumns[j] - 1].children[0]).html(options.prm.aPS[i][(j + 1)*3 + 1] + '%');
		}
		// Расчёты по текущей планете закончили, надо добавить полученные значения производства ресурсов к итогу
		totalProd[0] += production[0];
		totalProd[1] += production[1];
		totalProd[2] += production[2];
	}
	
	// Закончен расчёт производства ресурсов на планетах, можно подводить итоги
	for (let i = 0; i < 3; i++) {
		$(rows[planetsCount*2 + 2].children[levelColumns[i+1] - 1]).html(numberToShortenedString(totalProd[i], options.unitSuffix));
		$(rows[planetsCount*2 + 3].children[levelColumns[i+1] - 1]).html(numberToShortenedString(24 * totalProd[i], options.unitSuffix));
		$(rows[planetsCount*2 + 4].children[levelColumns[i+1] - 1]).html(numberToShortenedString(7 * 24 * totalProd[i], options.unitSuffix));
	}

	// Обновим данные в нижних панельках
	updateAccumulation('all', totalProd);
	updateProduction('all', totalProd);
	options.save();

	let techData = {122 : [2000, 4000, 1000, 2]};
	let costs = getBuildCost_C(122, options.prm.plasmaTechLevel, options.prm.plasmaTechLevel+1, techData, 0);
	let rates = [];
	rates[0] = getInputNumber($('#exchange-rates-m')[0]);
	if (rates[0] === 0) rates[0] = 3;
	rates[1] = getInputNumber($('#exchange-rates-c')[0]);
	if (rates[1] === 0) rates[1] = 2;
	rates[2] = getInputNumber($('#exchange-rates-d')[0]);
	if (rates[2] === 0) rates[2] = 1;
	let normCost = costs[0] + (rates[0] / rates[1]) * costs[1] + (rates[0] / rates[2]) * costs[2];
	options.prm.plasmaTechLevel += 1;
	let newProd = [0, 0, 0];
	for (let i = 0; i < planetsCount; i++) {
		prodParams = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
		for (let j = 1; j < 8; j++) {
			prodParams[j-1][0] = options.prm.aPS[i][j*3];
			prodParams[j-1][1] = options.prm.aPS[i][j*3 + 1];
			prodParams[j-1][2] = options.prm.aPS[i][j*3 + 2];
		}
		plnData = [options.prm.aPS[i][0], options.prm.aPS[i][1], options.prm.aPS[i][2]];

		let prodData = calculateProduction(prodParams, plnData);
		newProd[0] += prodData[1][0];
		newProd[1] += prodData[1][1];
		newProd[2] += prodData[1][2];
	}
	let increase = [];
	increase[0] = newProd[0] - totalProd[0];
	increase[1] = newProd[1] - totalProd[1];
	increase[2] = newProd[2] - totalProd[2];
	let normIncrease = increase[0] + (rates[0] / rates[1]) * increase[1] + (rates[0] / rates[2]) * increase[2];
	let amortTime = normCost / normIncrease;
	options.prm.plasmaTechLevel -= 1;
	rows = $('#plasma-amort-tbl tr');
	for (let i = 0; i < 3; i++) {
		$(rows[1].children[i + 1]).html(numToOGame(costs[i]));
		$(rows[2].children[i + 1]).html(numToOGame(increase[i]));
	}
	if (normIncrease > 0)
		$(rows[3].children[1]).html(timespanToShortenedString(Math.ceil(amortTime*3600), options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true));
}

let maxTempBlinkCount = 0;
function blinkMaxTemp() {
	if (options.prm.maxTempEntered)
		return;
	if (maxTempBlinkCount++ < 10) {
		setTimeout(function() { 
					if ($('#max-planet-temp').hasClass('red-border')) 
						$('#max-planet-temp').removeClass('red-border'); 
					else 
						$('#max-planet-temp').addClass('red-border');
					blinkMaxTemp();
					},
					200);
	} else {
		maxTempBlinkCount = 0;
		$('#max-planet-temp').removeClass('red-border');
		return;
	}
}

function blinkMaxStorage(storages) {
	if (options.storageBlinkCount++ < 10) {
		setTimeout(function() {
				var spans = ['#storage-cap-met', '#storage-cap-crys', '#storage-cap-deut'];
				for (var i = 0; i < 3; i++) {
					if (storages[i] == 1) {
						if ($(spans[i]).hasClass('red-border')) 
							$(spans[i]).removeClass('red-border'); 
						else 
							$(spans[i]).addClass('red-border');
					} else
						$(spans[i]).removeClass('red-border');
				}
				blinkMaxStorage(storages);
				},
				200);
	} else {
		options.storageBlinkCount = 0;
		options.storagesBlinking = false;
		var spans = ['#storage-cap-met', '#storage-cap-crys', '#storage-cap-deut'];
		for (var i = 0; i < 3; i++)
			$(spans[i]).removeClass('red-border'); 
		return;
	}
}

function toggleOnePlanetView() {
	options.prm.onePlnExtView = !options.prm.onePlnExtView;
	setOnePlanetView(options.prm.onePlnExtView);
	options.save();
}

function setOnePlanetView(extended) {
	var rows = $('#one-planet-prod tr');
	var newMode = extended?'table-cell':'none';
	for (var row = 0; row < rows.length; row++) {
		if (rows[row].children.length < 8)
			continue;
		$(rows[row].children[1]).css('display', newMode);
		$(rows[row].children[7]).css('display', newMode);
	}
}

function editRow(event) {
	let input = event.currentTarget;
	$(input).trigger('blur');
	let plnID = arguments[0].data;
	options.editedPln = plnID;
	$('#planet-name').val(options.prm.aPNames[plnID]);
	$('#max-planet-temp').val(options.prm.aPS[plnID][0]);
	$('#planet-pos').val(options.prm.aPS[plnID][1]);
	$('#energy-boost').val(options.prm.aPS[plnID][2]);
	let rows = $('#one-planet-prod tr');
	for (let i = 1; i < 8; i++) {
		rows[i + 1].children[2].children[0].value = options.prm.aPS[plnID][i*3];
		if (i < 7)
			rows[i + 1].children[7].children[0].selectedIndex = (100 - options.prm.aPS[plnID][i*3 + 1])/10;
		if (i === 7)
			rows[i + 1].children[7].children[0].selectedIndex = (150 - options.prm.aPS[plnID][i*3 + 1])/10;
		if (i < 4)
			rows[i + 1].children[1].children[0].selectedIndex = options.prm.aPS[plnID][i*3 + 2];
	}
	$('#tabs').tabs('select', 0);
	$('#planet-save-div').show();
	updateOnePlnTab();
}

function deleteRow(event) {
	let input = event.currentTarget;
	$(input).trigger('blur');
	let plnID = arguments[0].data;
	if (!isPlnEmpty(plnID) && confirm(options.plnDelConfMsg) === false) {
		return;
	}
	options.prm.aPNames.splice(plnID, 1);
	options.prm.aPS.splice(plnID, 1);
	options.prm.currPlanetsCount--;
	$('#planetsSpin').val(options.prm.currPlanetsCount);
	prepAllPlanetsTable();
	updateAllPlnTab();
}

function isPlnEmpty(plnID) {
	let plnData = options.prm.aPS[plnID];
	// в первой тройке индекс 1 это позиция, в остальных - фактор производства, он по умолчанию 100
	for (let i = 0; i < 8; i++) {
		if (plnData[3*i] !== 0 || plnData[3*i + 2] !== 0)
			return false;
	}
	return true;
}

function savePlnData() {
	options.prm.aPNames[options.editedPln] = stripHTMLTags($('#planet-name').val());
	let target = options.prm.aPS[options.editedPln];
	let rows = $('#one-planet-prod tr');
	target[0] = Number($('#max-planet-temp').val());
	target[1] = Number($('#planet-pos').val());
	target[2] = Number($('#energy-boost').val());
	for (let i = 1; i < 8; i++) {
		target[i*3] = getInputNumber(rows[i + 1].children[2].children[0]);
		target[i*3 + 1] = Number(rows[i + 1].children[7].children[0].value);
		if (i > 3) { // У электростанций, лампочек и Гусеничников нет бустеров
			target[i*3 + 2] = 0;
		} else {
			target[i*3 + 2] = Number(rows[i + 1].children[1].children[0].value);
		}
	}
	//consoleLog(options.prm.aPS);
	prepAllPlanetsTable();
	options.editedPln = 0;
	$('#tabs').tabs('select', 1);
	$('#planet-save-div').hide();
	updateAllPlnTab();
}

function clonePlnData() {
	if (confirm(options.cloneConfMsg) === false) {
		return;
	}
	let rows = $('#one-planet-prod tr');
	for (let pln = 0; pln < options.prm.currPlanetsCount; pln++) {
		let p = options.prm.aPS[pln];
		for (let i = 1; i < 8; i++) {
			p[i * 3] = getInputNumber(rows[i + 1].children[2].children[0]);
			p[i * 3 + 1] = Number(rows[i + 1].children[7].children[0].value);
			if (i > 3) { // У электростанций, лампочек и Гусеничников нет бустеров
				p[i * 3 + 2] = 0;
			} else {
				p[i * 3 + 2] = Number(rows[i + 1].children[1].children[0].value);
			}
		}
	}

	prepAllPlanetsTable();
	options.editedPln = 0;
	$('#tabs').tabs('select', 1);
	$('#planet-save-div').hide();
	updateAllPlnTab();
}

function stripHTMLTags(input) {
	return input.replace(/(<([^>]+)>)/gi, "");
}

function saveUniverseData() {
	let selectedUni = $('#universe-name-select').val();
	if (selectedUni === '0') {
		alert(options.noUniSelectedMsg);
		return;
	}
	if (confirm(options.uniOwrConfMsg) === false) {
		return;
	}
	saveToCookie(selectedUni, options.prm);
	$('#universe-save').blur();
}

function loadUniverseData() {
	let selectedUni = $('#universe-name-select').val();
	if (selectedUni === '0') {
		alert(options.noUniSelectedMsg);
		return;
	}
	if (confirm(options.uniLoadConfMsg) === false) {
		return;
	}
	options.load(selectedUni);
	$('#universe-load').blur();
	updateParams();
}

function deleteUniverseData() {
	let selectedUni = $('#universe-name-select').val();
	if (selectedUni === '0') {
		alert(options.noUniSelectedMsg);
		return;
	}
	if (confirm(options.uniDelConfMsg) === false) {
		return;
	}
	localStorage.removeItem(selectedUni);
	$('#universe-name-select option[value="' + selectedUni + '"]').remove();
	$('#universe-name-select').val("0");
	$('#universe-delete').blur();
}

function addUniverseData() {
	let uniNameInput = $('#universe-name');
	if (uniNameInput.val().length === 0) {
		alert(options.noUniNameMsg);
		uniNameInput.focus();
		return;
	}
	let name = stripHTMLTags(uniNameInput.val());
	let key = "prod_uni_" + name;
	saveToCookie(key, options.prm);
	let uniNameSelect = $('#universe-name-select');
	uniNameSelect.append(new Option(name, key));
	uniNameSelect.val(key);
	uniNameInput.val("");
	$('#universe-add').blur();
}

function toggleShowAdditionalInfo() {
	options.prm.showAddInf = !options.prm.showAddInf;
	if (options.prm.showAddInf)
		$('#all-planets-prod .hidden-span').switchClass('hidden-span', 'visible-span', 0);
	else
		$('#all-planets-prod .visible-span').switchClass('visible-span', 'hidden-span', 0);
}

$(document).ready(function() {
try {
	options.load('options_production');

	$('input').focusin(function() {
		$(this).addClass('ui-state-focus');
	});
	$('input').focusout(function() {
		$(this).removeClass('ui-state-focus');
	});

	$('#universe-control').buttonset();
	$('#universe-load').button( { icons: {primary:'ui-icon-arrowthickstop-1-n'} } );
	$('#universe-load').click(loadUniverseData);
	$('#universe-save').button( { icons: {primary:'ui-icon-arrowthickstop-1-s'} } );
	$('#universe-save').click(saveUniverseData);
	$('#universe-delete').button( { icons: {primary:'ui-icon-close'} } );
	$('#universe-delete').click(deleteUniverseData);
	$('#universe-add').button( { icons: {primary:'ui-icon-plus'} } );
	$('#universe-add').click(addUniverseData);

	$("#tabs").tabs({	cookie: {	expires: 365, path: '/prod' } });	// UI сохраняет в куках номер открытой вкладки
	document.getElementById('max-planet-temp')._constrains = {'min': -134, 'def': 0, 'allowNegative': true};
	document.getElementById('planet-pos')._constrains = {'min': 1, 'max': 16, 'def': 8, 'allowNegative': false};
	$('#planet-pos').blur('updateOnePlnTab', validateInputNumberOnBlur);

	// После того, как событие будет обработано, нужно вызвать функцию пересчета. Её имя передаём в поле data событий.
	document.getElementById('exchange-rates-m')._constrains = {'min': 1, 'max': 4, 'def': 1, 'allowFloat': true, 'allowNegative': false};
	document.getElementById('exchange-rates-c')._constrains = {'min': 1, 'max': 3, 'def': 1, 'allowFloat': true, 'allowNegative': false};
	document.getElementById('exchange-rates-d')._constrains = {'min': 1, 'max': 2, 'def': 1, 'allowFloat': true, 'allowNegative': false};
	$('#general-settings-panel input:text').keyup('updateParams', validateInputNumber);
	$('#general-settings-panel input:text').blur('updateParams', validateInputNumberOnBlur);
	$('#general-settings-panel select').keyup(updateParams);
	$('#general-settings-panel select').change(updateParams);
	$('#engineer').click(updateParams);
	$('#geologist').click(updateParams);
	$('#technocrat').click(updateParams);
	$('#admiral').click(updateParams);
	$('#commander').click(updateParams);
	$('#reset').click(resetParams);
	$('#one-pln-extended-view').click(toggleOnePlanetView);
	$('#general-settings-panel input:radio').click(updateParams);
	$('#all-pln-addtnl-info').click(toggleShowAdditionalInfo);
	$('#is-trader').click(updateParams);

	let textInputs = $('#one-planet-panel input:text').not("#planet-name");
	textInputs.keyup('updateOnePlnTab', validateInputNumber);
	textInputs.blur('updateOnePlnTab', validateInputNumberOnBlur);
	$('#one-planet-panel select').keyup(updateOnePlnTab);
	$('#one-planet-panel select').change(updateOnePlnTab);
	$('#one-planet-panel input:checkbox').click(updateOnePlnTab);
	$('#save-planet-data').click(savePlnData);
	$('#clone-planet-data').click(clonePlnData);
	$('#include-SS-y').click(updateOnePlnTab);
	$('#include-SS-n').click(updateOnePlnTab);
	
	$('#all-planets-panel input:text').keyup('updateAllPlnTab', validateInputNumber);
	$('#all-planets-panel input:text').blur('updateAllPlnTab', validateInputNumberOnBlur);
	$('#all-planets-panel select').keyup(updateAllPlnTab);
	$('#all-planets-panel select').change(updateAllPlnTab);
	$('#all-planets-panel input:checkbox').click(updateAllPlnTab);

	$("#planetsSpin").unbind();
	let spinOptions = {min: 1, max: 99, step: 1, reset: 1, lock: true, onChange: changePlanetsCount};
	$("#planetsSpin").SpinButton(spinOptions);
	
	$('#one-planet-prod tr:eq(4)').children(2).children(0).keyup(blinkMaxTemp);
	$('#one-planet-prod tr:eq(7)').children(2).children(0).keyup(blinkMaxTemp);
	$('#max-planet-temp').keyup(function(){options.prm.maxTempEntered = true;});
	
	$( "#one-planet-accordion" ).accordion({
		autoHeight: false,
		collapsible: true,
		active: false
	});
	
	$( "#all-planets-accordion" ).accordion({
		autoHeight: false,
		collapsible: true,
		active: false
	});

	let keys = [];
	for(let i = 0, len = localStorage.length; i < len; i++) {
		let key = localStorage.key(i);
		if (key.includes("prod_uni_")) {
			keys.push(key);
		}
	}
	keys.sort();
	for (let i = 0; i < keys.length; i++) {
		let key = keys[i];
		$('#universe-name-select').append(new Option(key.replace("prod_uni_", ""), key));
	}

	let theme = { value: 'light', validate: function(key, val) { return val; } };
	loadFromCookie('theme', theme);
	toggleLight(theme.value === 'light');
	$('#cb-light-theme').click(function(){toggleLight($('#cb-light-theme')[0].checked);});
	
	updateParams();
	options.cloneConfMsg = options.cloneConfMsg.replaceAll("__BR__", "\n");
} catch (e) {
	alert('Exception: ' + e);
}
});
