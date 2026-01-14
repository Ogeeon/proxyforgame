let options = {
	defConstraints: {
				min: -Infinity,
				max: Infinity,
				def: 0,
				allowFloat: false,
				allowNegative: false
			},
	prm: {
		shipyardLevel: 0,
		robotFactoryLevelP: 0,
		robotFactoryLevelM: 0,
		naniteFactoryLevel: 0,
		universeSpeed: 1,
		researchSpeed: 1,
		researchLabLevel: 0,
		energyTechLevel: 0,
		plasmaTechLevel: 0,
		ionTechLevel: 0,
		hyperTechLevel: 0,
		maxPlanetTemp: 0,
		geologist: false,
		engineer: false,
		technocrat: false,
		admiral: false,
		commander: false,
		booster: 0,
		researchBonus: false,
		irnLevel: 0,
		planetsSpin: 8,
		labChoice: -1,
		labLevels: [0,0,0,0,0,0,0,0],
		playerClass: 0,
		planetPos: 8,
        fullNumbers: false,

		validate: function(field, value) {
			switch (field) {
				case 'shipyardLevel': return validateNumber(parseFloat(value), 0, 100, 0);
				case 'robotFactoryLevelP': return validateNumber(parseFloat(value), 0, 100, 0);
				case 'robotFactoryLevelM': return validateNumber(parseFloat(value), 0, 100, 0);
				case 'naniteFactoryLevel': return validateNumber(parseFloat(value), 0, 100, 0);
				case 'universeSpeed': return validateNumber(parseFloat(value), 1, 10, 1);
				case 'researchSpeed': return validateNumber(parseFloat(value), 1, 20, 1);
				case 'researchLabLevel': return validateNumber(parseFloat(value), 0, 999999, 0);
				case 'energyTechLevel': return validateNumber(parseFloat(value), 0, 50, 0);
				case 'plasmaTechLevel': return validateNumber(parseFloat(value), 0, 50, 0);
				case 'ionTechLevel': return validateNumber(parseFloat(value), 0, 50, 0);
				case 'hyperTechLevel': return validateNumber(parseFloat(value), 0, 50, 0);
				case 'maxPlanetTemp': return validateNumber(parseFloat(value), 0, Infinity, 0);
				case 'geologist': return value === 'true';
				case 'engineer': return value === 'true';
				case 'technocrat': return value === 'true';
				case 'admiral': return value === 'true';
				case 'commander': return value === 'true';
				case 'irnLevel': return validateNumber(parseFloat(value), 0, Infinity, 0);
				case 'planetsSpin': return validateNumber(parseFloat(value), 1, 99, 8);
				case 'labChoice': return validateNumber(parseFloat(value), -1, Infinity, -1);
				case 'labLevels': return validateNumber(parseFloat(value), 0, Infinity, 0);
				case 'fullNumbers': return value === 'true';
				case 'research-bonus': return value === 'true';
				case 'playerClass': return validateNumber(parseFloat(value), 0, 2, 0);
				case 'planetPos': return validateNumber(parseFloat(value), 1, 16, 8);
				default: return value;
			}
		}
	},

	load: function() {
		try {
			loadFromCookie('options_costs', options.prm);
//			consoleLog("loaded from cookies: ");
//			consoleLog(options.prm);
		} catch(e) {
			alert(e);
		}
	},

	save: function() {
		saveToCookie('options_costs', options.prm);
//		consoleLog("saving to cookies: ");
//		consoleLog(options.prm);
	},

	techData: {},
	techReqs: {},

	minPlanetsCount: 1,
	maxPlanetsCount: 99,
	defPlanetsCount: 8,
	currPlanetsCount: 8,
	resultingLabLevel: 0,
	resultingLabLevelComputed: false
};

function loadLLCData() {
	$('#irn-level').val(options.prm.irnLevel);
	$('#planetsSpin').val(options.prm.planetsSpin);
	options.currPlanetsCount = options.prm.planetsSpin;
	let tbl = $('#lab-levels-table')[0];
	for (let i = tbl.rows.length-1; i > 0; i--) {
		$(tbl.rows[i]).remove();
	}
	for (let i = 1; i <= options.prm.planetsSpin; i++) {
		$('#lab-levels-table').append('<tr class="'+((i % 2) === 1 ? 'odd' : 'even')+'">'+
				'<td align="center" >'+options.planetNumStr+i+'</td>'+
				'<td align="center" width="20%;"><input type="text" id="lablevel_'+i+'" name="lablevel_'+i+'>" class="ui-state-default ui-corner-all ui-input input-3columns input-in-table" value="'+options.prm.labLevels[i-1]+'" /></td>'+
				'<td align="center" width="20%;"><input type="radio" id="labchoice_'+i+'" name="start-pln" disabled="disabled"/></td>'+
				'</tr>');
		if (options.prm.labLevels[i-1] > 0)
			$('#labchoice_'+i)[0].disabled = false;
		if (options.prm.labChoice === i-1)
			$('#labchoice_'+i)[0].checked = 'checked';

		$('#lablevel_'+i).keyup('changeLabLevel', validateInputNumber);
		$('#labchoice_'+i).click(updateResultingLevel);
	}

}

function resetParams() {
	options.prm.shipyardLevel = 0;
	options.prm.robotFactoryLevelP = 0;
	options.prm.robotFactoryLevelM = 0;
	options.prm.naniteFactoryLevel = 0;
	options.prm.universeSpeed = 0;
	options.prm.researchSpeed = 0;
	options.prm.researchLabLevel = 0;
	options.prm.energyTechLevel = 0;
	options.prm.plasmaTechLevel = 0;
	options.prm.ionTechLevel = 0;
	options.prm.hyperTechLevel = 0;
	options.prm.maxPlanetTemp = 0;
	options.prm.geologist = false;
	options.prm.engineer = false;
	options.prm.technocrat = false;
	options.prm.admiral = false;
	options.prm.commander = false;
	options.prm.booster = 0;
	options.prm.researchBonus = 0;
	options.prm.irnLevel = 0;
	options.prm.planetsSpin = 8;
	options.prm.labChoice = -1;
	options.prm.labLevels = [0, 0, 0, 0, 0, 0, 0, 0];
	options.prm.playerClass = 0;
	options.prm.planetPos = 8;
	options.prm.fullNumbers = false;

	$('#shipyard-level')[0].value = options.prm.shipyardLevel;
	$('#robot-factory-level')[0].value = options.prm.robotFactoryLevelP;
	$('#robot-factory-level-moon')[0].value = options.prm.robotFactoryLevelM;
	$('#nanite-factory-level')[0].value = options.prm.naniteFactoryLevel;
	$('#universe-speed')[0].selectedIndex = options.prm.universeSpeed;
	$('#research-speed')[0].selectedIndex = options.prm.researchSpeed;
	$('#research-lab-level')[0].value = options.prm.researchLabLevel;
	$('#technocrat')[0].checked = options.prm.technocrat;
	$('#ion-tech-level')[0].value = options.prm.ionTechLevel;
	$('#hyper-tech-level')[0].value = options.prm.hyperTechLevel;
	$('#geologist')[0].checked = options.prm.geologist;
	$('#engineer')[0].checked = options.prm.engineer;
	$('#admiral')[0].checked = options.prm.admiral;
	$('#commander')[0].checked = options.prm.commander;
	$('#irn-level')[0].value = options.prm.irnLevel;
	$('#planetsSpin')[0].value = options.prm.planetsSpin;
	$('#research-bonus')[0].checked = options.prm.researchBonus;
	$('#full-numbers').attr('checked', false);
	options.currPlanetsCount = options.defPlanetsCount;
	let tbl = $('#lab-levels-table')[0];
	for (let i = tbl.rows.length-1; i > 0; i--) {
		$(tbl.rows[i]).remove();
	}
	for (let i = 1; i <= options.defPlanetsCount; i++) {
		$('#lab-levels-table').append('<tr class="'+((i % 2) === 1 ? 'odd' : 'even')+'">'+
				'<td align="center" >'+options.planetNumStr+i+'</td>'+
				'<td align="center" width="20%;"><input type="text" id="lablevel_'+i+'" name="lablevel_'+i+'>" class="ui-state-default ui-corner-all ui-input input-3columns input-in-table" value="0" /></td>'+
				'<td align="center" width="20%;"><input type="radio" id="labchoice_'+i+'" name="start-pln" disabled="disabled"/></td>'+
				'</tr>');
		$('#lablevel_'+i).keyup('changeLabLevel', validateInputNumber);
		$('#labchoice_'+i).click(updateResultingLevel);
	}

	options.resultingLabLevelComputed = false;

	for (let outer = 0; outer < 2; outer++) {
		let innerNums = (outer === 0) ? [2, 3, 4, 5, 6] : [2, 3, 4];
		for (let innerIdx = 0; innerIdx < innerNums.length; innerIdx++) {
			let inner = innerNums[innerIdx];
			let rows = $('#table-'+outer+'-'+inner+' tr');
			for (let row = 1; row < rows.length-5; row++) {
				rows[row].children[2].children[0].value = 0;
				if (outer === 1)
					rows[row].children[3].children[0].value = 0;
				let firstDataCol = (outer === 1)?4:3;
				for (let cell = firstDataCol; cell < firstDataCol + 7; cell++) {
					if (cell === firstDataCol+4)
						$(rows[row].children[cell]).html('0'+options.datetimeS);
					else
						$(rows[row].children[cell]).html('0');
				}
			}
		}
	}
	jQuery.each(options.techData, function(key, value) {
		options.techData[key] = null;
	});

	$('#tech-types-select')[0].value = 1;
	$('#tab2-from-level')[0].value = 0;
	$('#tab2-to-level')[0].value = 0;

	$('#energy-tech-level')[0].value = options.prm.energyTechLevel;
	$('#plasma-tech-level')[0].value = options.prm.plasmaTechLevel;
	$('#max-planet-temp')[0].value = options.prm.maxPlanetTemp;
	$('#planet-pos')[0].value = options.prm.planetPos;

	$('#booster')[0].selectedIndex = options.prm.booster;
	$('#class-'+options.prm.playerClass).attr('checked', true);

	updateResultingLevel();
	updateTotals();
	updateOneMultTab();
}

function getLabLevel(min) {
	let rows = $('#lab-levels-table tr');
	let labs = [];
	for (let i = 1; i < rows.length; i++) {
		if ($('#lablevel_'+i)[0].value > 0 && (min === 0 || $('#lablevel_'+i)[0].value >= min))
			labs.push([$('#lablevel_'+i)[0].value, $('#labchoice_'+i)[0].checked]);
	}
	labs.sort(compareLabs);
	let result = 0;
	let limit = Math.min(getInputNumber($('#irn-level')[0])+1, labs.length);
	for (let i = 0; i < limit; i++) {
		result += Number(labs[i][0]);
	}
	return result;
}

function showResearchImpossibleMessage(researchName) {
	// Если известны div-ы и текст для сообщения об ошибке, выведем туда это сообщение, а потом исправим значение
	if (getOptionValue('warnindDivId', null) != null && getOptionValue('msgCantResearch', null) != null) {
		$('#'+options.warnindMsgDivId).text(options.msgCantResearch.format(researchName));
		$('#'+options.warnindDivId).fadeIn(800, function () {
			setTimeout(function() {
				$('#'+options.warnindDivId).fadeOut(800);
			}, 5000);
		  });
	}
}

// Обновляет данные по строке, в которой сделано изменение и записывает изменённые значения в глобальный массив рассчитанных значений
function updateRow() {
	let techID = $(this.parentNode.parentNode.children[0]).html();
	if (techID === '' || 1*techID === 0)
		return;
	let row = $(this.parentNode.parentNode)[0];
	let tblID = this.parentNode.parentNode.parentNode.parentNode.id;
	let parts = tblID.split(/-/);
	if (parts.length < 3)
		return;
	let rowKey = techID + '-' + parts[1] + '-' + parts[2];
	let outerTab = Number(parts[1]);
	let techLevelFrom;
	let techLevelTo;
	let firstDataCol;
	if (outerTab === 1) {
		techLevelFrom = 1*row.children[2].children[0].value;
		techLevelTo = 1*row.children[3].children[0].value;
		firstDataCol = 4;
	} else {
		techLevelTo = 1*row.children[2].children[0].value;
		techLevelFrom = techLevelTo === 0 ? 0 : techLevelTo - 1;
		firstDataCol = 3;
	}
	let isMoon = false;
	if (techID > 10000) {	// Здания на луне хранятся в таблицах с id на 10000 больше актуального
		isMoon = true;
		techID -= 10000;
	}
	let dataRow = [0, 0, 0, 0, 0, 0];
	// Для зданий возможен снос, по остальным техам - новый уровень должен быть строго больше старого
	if ((techLevelTo > techLevelFrom || techID < 100) && techLevelTo >= 0) {
		let timeSpan = getAdjustedTime(techID, techLevelFrom, techLevelTo, isMoon);
		// Если запрошено исследование и оно не может быть выполнено - обрабатываем этот случай особо
		if (timeSpan < 0) {
			if (outerTab === 1) {
				row.children[2].children[0].value = 0;
				row.children[3].children[0].value = 0;
			} else {
				row.children[2].children[0].value = 0;
			}
			$(row.children[firstDataCol]).html('0');
			$(row.children[firstDataCol+1]).html('0');
			$(row.children[firstDataCol+2]).html('0');
			$(row.children[firstDataCol+3]).html('0');
			$(row.children[firstDataCol+4]).html('0'+options.datetimeS);
			$(row.children[firstDataCol+5]).html('0');
			$(row.children[firstDataCol+6]).html('0');
			options.techData[rowKey] = null;
			updateTotals();
			if (100 < techID && techID <= 200)
				showResearchImpossibleMessage($(row.children[1]).html());
			return;
		}
		let resCost = getBuildCost_C(techID, techLevelFrom, techLevelTo, options.techCosts, getInputNumber($('#ion-tech-level')[0]));
		let energyCost = getBuildEnergyCost_C(techID, techLevelTo, options.techCosts);
		let points;
		if (techLevelTo > techLevelFrom) {
			points = Math.floor((resCost[0] + resCost[1] + resCost[2]) / 1000.0);
		} else {
			points = 0; // терраформер, космический док и лунную базу нельзя разрушить, очки за это не снимаются
			if (!(techID === 33 || techID === 36 || techID === 41)) {
				let buildResCost = getBuildCost_C(techID, techLevelTo, techLevelFrom, options.techCosts);
				points = -1 * Math.floor((buildResCost[0] + buildResCost[1] + buildResCost[2]) / 1000.0);
			} else {
				resCost = [0, 0, 0];
				timeSpan = 0;
				energyCost = 0;
			}
		}
		$(row.children[firstDataCol]).html(ogamizeNum(resCost[0], options.unitSuffix));
		$(row.children[firstDataCol+1]).html(ogamizeNum(resCost[1], options.unitSuffix));
		$(row.children[firstDataCol+2]).html(ogamizeNum(resCost[2], options.unitSuffix));
		$(row.children[firstDataCol+3]).html(ogamizeNum(energyCost, options.unitSuffix));
		$(row.children[firstDataCol+4]).html(timespanToShortenedString(timeSpan, options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true));
		$(row.children[firstDataCol+5]).html(ogamizeNum(points, options.unitSuffix));
		let tmCost = 0;
		if (outerTab === 0 && techID < 200) {
			tmCost = getHalvingCost(techID, timeSpan);
			$(row.children[firstDataCol+6]).html(ogamizeNum(tmCost, options.unitSuffix));
		} else {
			$(row.children[firstDataCol+6]).html('0');
		}
		dataRow[0] = resCost[0];
		dataRow[1] = resCost[1];
		dataRow[2] = resCost[2];
		dataRow[3] = energyCost;
		dataRow[4] = timeSpan;
		dataRow[5] = points;
		options.techData[rowKey] = dataRow;
	} else {
		$(row.children[firstDataCol]).html('0');
		$(row.children[firstDataCol+1]).html('0');
		$(row.children[firstDataCol+2]).html('0');
		$(row.children[firstDataCol+3]).html('0');
		$(row.children[firstDataCol+4]).html('0'+options.datetimeS);
		$(row.children[firstDataCol+5]).html('0');
		$(row.children[firstDataCol+6]).html('0');
		options.techData[rowKey] = null;
		// Отдельно на вкладке "Исследования" вкладки "Несклько уровней" надо не давать вводить уровни, если уровень лаборатории недостаточен для выполнения исследования
		if (Number(parts[2]) === 4 && outerTab === 1) {
			let researchLabLevel;
			if (!options.resultingLabLevelComputed)
				researchLabLevel = getInputNumber($('#research-lab-level')[0]);
			else
				researchLabLevel = getLabLevel(options.techReqs[techID]);
			if (researchLabLevel < options.techReqs[techID]) {
				row.children[2].children[0].value = 0;
				showResearchImpossibleMessage($(row.children[1]).html());
			}
		}
	}
	updateTotals();
}

// Учитывает изменения в параметрах: уровни фабрики роботов, фабрики нанитов, верфи, иссл.лабы, скорость вселенной, галочка "технократ".
// Обновляет время в соответствующих полях глобального массива рассчитанных значений
// TODO: slit into calculation and display; pretty sure we can calculate everything in one function and then show all numbers in another
function updateParams() {
	// Изменения в параметрах повлияют только на время строительства/исследования, при этом обрабатывать можно не все вкладки
	let param = this.id;
	let techTypes;
	switch (param) {
		case 'robot-factory-level': techTypes = [2]; break;
		case 'robot-factory-level-moon': techTypes = [3]; break;
		case 'nanite-factory-level': techTypes = [2, 3, 5, 6]; break;
		case 'shipyard-level': techTypes = [5, 6]; break;
		case 'ion-tech-level': techTypes = [2]; break;
		case 'hyper-tech-level': techTypes = [2, 3, 5, 6]; break;
		case 'research-lab-level': techTypes = [4]; break;
		case 'technocrat': techTypes = [4]; break;
		case 'research-bonus': techTypes = [4]; break;
		case 'universe-speed':
		case 'full-numbers': techTypes = [2, 3, 4, 5, 6]; break;
		case 'research-speed': techTypes = [4]; break;
		case 'class-0':
		case 'class-1':
		case 'class-2': techTypes = [2, 3, 4, 5, 6]; break;
	}
	//console.log('UP: techTypes=' + techTypes + ', param=' + param);
	options.prm.shipyardLevel = getInputNumber($('#shipyard-level')[0]);
	options.prm.robotFactoryLevelP = getInputNumber($('#robot-factory-level')[0]);
	options.prm.robotFactoryLevelM = getInputNumber($('#robot-factory-level-moon')[0]);
	options.prm.naniteFactoryLevel = getInputNumber($('#nanite-factory-level')[0]);
	options.prm.universeSpeed = $('#universe-speed')[0].value;
	options.prm.researchSpeed = $('#research-speed')[0].value;
	options.prm.researchLabLevel = getInputNumber($('#research-lab-level')[0]);
	options.prm.energyTechLevel = getInputNumber($('#energy-tech-level')[0]);
	options.prm.plasmaTechLevel = getInputNumber($('#plasma-tech-level')[0]);
	options.prm.ionTechLevel = getInputNumber($('#ion-tech-level')[0]);
	options.prm.hyperTechLevel = getInputNumber($('#hyper-tech-level')[0]);
	options.prm.maxPlanetTemp = getInputNumber($('#max-planet-temp')[0]);
	options.prm.geologist = $('#geologist')[0].checked;
	options.prm.engineer = $('#engineer')[0].checked;
	options.prm.technocrat = $('#technocrat')[0].checked;
	options.prm.researchBonus = $('#research-bonus')[0].checked;
	options.prm.admiral = $('#admiral')[0].checked;
	options.prm.commander = $('#commander')[0].checked;
	options.prm.irnLevel = getInputNumber($('#irn-level')[0]);
	options.prm.planetsSpin = getInputNumber($('#planetsSpin')[0]);
	options.prm.planetPos = getInputNumber($('#planet-pos')[0]);
	options.prm.fullNumbers = $('#full-numbers')[0].checked;
	if ($('#class-2').attr('checked'))
		options.prm.playerClass = 2;
	else {
		if ($('#class-1').attr('checked'))
			options.prm.playerClass = 1;
		else
			options.prm.playerClass = 0;
	}
	let needUpd = {0: false, 1: false};
	let techLevelFrom;
	let techLevelTo;
	jQuery.each(options.techData, function(key, value) {
		if (value == null)
			return;
		//consoleLog(key);
		let keyParts = key.split(/-/);
		//consoleLog(keyParts);
		//consoleLog('#table-'+keyParts[1]+'-'+keyParts[2]+' tr');
		if (jQuery.inArray(1*keyParts[2], techTypes) >= 0) {
			//consoleLog('#table-'+keyParts[1]+'-'+keyParts[2]+' tr');
			// мы знаем id техи, которую надо пересчитать, и номера внешней и внутренней вкладок (эти же номера позволят получить id таблицы).
			// Чтобы пересчитать теху, надо получить все строки таблицы, в которой она сидит, и найти там нужную строку по id
			let rows = $('#table-'+keyParts[1]+'-'+keyParts[2]+' tr');
			for (let idx = 1; idx < rows.length; idx++) {
				let rowID = $(rows[idx].children[0]).html();
				//consoleLog(rowID);
				if (rowID === keyParts[0]) {
					// Нашли нужную строку. Пересчитаем время и установим флаг, что для данной вкладки надо вызвать метод updateNumbers(), который обновит итоги.
					if (keyParts[1]*1 === 1) {
						techLevelFrom = 1*rows[idx].children[2].children[0].value;
						techLevelTo = 1*rows[idx].children[3].children[0].value;
					} else {
						techLevelTo = 1*rows[idx].children[2].children[0].value;
						techLevelFrom = techLevelTo === 0 ? 0 : techLevelTo - 1;
					}
					let techID = (rowID*1 > 10000)?(rowID*1 - 10000):(rowID*1);	// Здания на луне хранятся в таблицах с id на 10000 больше актуального
					let isMoon = false;
					if (Number(rowID) > 10000) {
						isMoon = true;
					}
					let newCost = getBuildCost_C(techID, techLevelFrom, techLevelTo, options.techCosts, getInputNumber($('#ion-tech-level')[0]));
					let newTime = getAdjustedTime(techID, techLevelFrom, techLevelTo, isMoon);
					let energyCost = getBuildEnergyCost_C(techID, techLevelTo, options.techCosts);
					let firstDataCol = (keyParts[1]*1 === 1)?4:3;
					// Если оказалось, что исследование невозможно выполнить, придётся стереть всю строку
					if (newTime > 0) {
						options.techData[key][0] = newCost[0];
						$(rows[idx].children[firstDataCol]).html(ogamizeNum(newCost[0], options.unitSuffix));
						options.techData[key][1] = newCost[1];
						$(rows[idx].children[firstDataCol+1]).html(ogamizeNum(newCost[1], options.unitSuffix));
						options.techData[key][2] = newCost[2];
						$(rows[idx].children[firstDataCol+2]).html(ogamizeNum(newCost[2], options.unitSuffix));
						options.techData[key][3] = energyCost;
						$(rows[idx].children[firstDataCol+3]).html(ogamizeNum(energyCost, options.unitSuffix));
						options.techData[key][4] = newTime;
						$(rows[idx].children[firstDataCol+4]).html(timespanToShortenedString(newTime, options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true));
						if (Number(keyParts[1]) === 0) {
							if (Number(keyParts[2]) < 5) {
								let tmCost = getHalvingCost(techID, newTime);
								$(rows[idx].children[firstDataCol + 6]).html(ogamizeNum(tmCost, options.unitSuffix));
							} else {
								$(rows[idx].children[firstDataCol + 6]).html(0);
							}
						}
					} else {
						rows[idx].children[2].children[0].value = 0;
						if (keyParts[1]*1 === 1)
							rows[idx].children[3].children[0].value = 0;
						$(rows[idx].children[firstDataCol]).html('0');
						$(rows[idx].children[firstDataCol+1]).html('0');
						$(rows[idx].children[firstDataCol+2]).html('0');
						$(rows[idx].children[firstDataCol+3]).html('0');
						$(rows[idx].children[firstDataCol+4]).html('0'+options.datetimeS);
						$(rows[idx].children[firstDataCol+5]).html('0');
						$(rows[idx].children[firstDataCol+6]).html('0');
						if (100 < techID && techID <= 200)
							showResearchImpossibleMessage($(rows[idx].children[1]).html());
					}
					needUpd[keyParts[1]] = true;
				}
			}
		}
	});
	updateTotals(needUpd);
	// пусть заодно обновится и 3я вкладка - она достаточно маленькая, чтобы не заниматься уточнениями
	updateOneMultTab();
}

// Обновляет промежуточные и общие итоги на основании данных из глобального массива рассчитанных значений
function updateTotals(needUpd) {
	for (let outer = 0; outer < 2; outer++) {
		// Если метод вызывается из updateParams(), то может быть запрошено обновление не всех вкладок
		if (needUpd && needUpd[outer] === false)
			continue;
		let innerNums = (outer === 0) ? [2, 3, 4, 5, 6] : [2, 3, 4];
		let firstDataCol = (outer === 0) ? 3 : 4;
		let grandTotals = [0, 0, 0, 0, 0, 0];
		for (let innerIdx = 0; innerIdx < innerNums.length; innerIdx++) {
			let inner = innerNums[innerIdx];
			let rows = $('#table-'+outer+'-'+inner+' tr');
			let totals = [0, 0, 0, 0, 0, 0, 0];
			let takenFields = 0;
			let row;
			for (row = 1; row < rows.length-5; row++) {
				let techID = $(rows[row].children[0]).html();
				let buildingLevelCol = outer === 1 ? 3 : 2;
				if (techID !== 36)
					takenFields += 1*$(rows[row].children[buildingLevelCol].children[0]).val();
				// Поищем в рассчитанных данных сведения об этой строке
				let rowKey = techID + '-' + outer + '-' + inner;
				if (options.techData[rowKey]) {
					totals[0] += options.techData[rowKey][0];
					totals[1] += options.techData[rowKey][1];
					totals[2] += options.techData[rowKey][2];
					totals[3] += options.techData[rowKey][3];
					totals[4] += options.techData[rowKey][4];
					totals[5] += options.techData[rowKey][5];
				}
			}
			$(rows[row].children[2]).html(innerIdx < 2 ? takenFields : '');
			$(rows[row].children[3]).html('<b>'+ogamizeNum(totals[0], options.unitSuffix)+'</b>');
			$(rows[row].children[4]).html('<b>'+ogamizeNum(totals[1], options.unitSuffix)+'</b>');
			$(rows[row].children[5]).html('<b>'+ogamizeNum(totals[2], options.unitSuffix)+'</b>');
			$(rows[row].children[6]).html('<b>'+ogamizeNum(totals[3], options.unitSuffix)+'</b>');
			$(rows[row].children[7]).html('<b>'+timespanToShortenedString(totals[4], options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true)+'</b>');
			$(rows[row].children[8]).html('<b>'+ogamizeNum(totals[5], options.unitSuffix)+'</b>');

			if (outer === 0 && innerIdx > 2) {
				let tmCost = getHalvingCost(1000, totals[4]);
				$(rows[row].children[9]).html('<b>'+ogamizeNum(tmCost, options.unitSuffix)+'</b>');
			}
			let subTotalRes = totals[0] + totals[1] + totals[2];
			let capSC = 5000.0 * (1 + 0.05 * options.prm.hyperTechLevel);
			if (options.prm.playerClass === 0) {
				capSC += 5000.0 * 0.25;
			}
			let needSC = Math.ceil(subTotalRes / capSC);
			let capLC = 25000.0 * (1 + 0.05 * options.prm.hyperTechLevel);
			if (options.prm.playerClass === 0) {
				capLC += 25000.0 * 0.25;
			}
			let needLC = Math.ceil(subTotalRes / capLC);
			$(rows[row+1].children[2]).html(needSC + ' <abbr title="'+options.scFull+'">'+options.scShort+'</abbr>');
			$(rows[row+1].children[3]).html(needLC + ' <abbr title="'+options.lcFull+'">'+options.lcShort+'</abbr>');

			grandTotals[0] += totals[0];
			grandTotals[1] += totals[1];
			grandTotals[2] += totals[2];
			grandTotals[3] += totals[3];
			grandTotals[4] += totals[4];
			grandTotals[5] += totals[5];
		}
		// После того, как обработали все данные на внутренних вкладках, надо показать общий итог по данной внешней вкладке.
		// Запишем его во все таблицы внутренних вкладок, чтобы создать впечатление сквозной таблицы итогов.
		for (let innerIdx = 0; innerIdx < innerNums.length; innerIdx++) {
			let inner = innerNums[innerIdx];
			let rows = $('#table-'+outer+'-'+inner+' tr');
			let row = rows.length-2;
			$(rows[row].children[2]).html('<b>'+ogamizeNum(grandTotals[0], options.unitSuffix)+'</b>');
			$(rows[row].children[3]).html('<b>'+ogamizeNum(grandTotals[1], options.unitSuffix)+'</b>');
			$(rows[row].children[4]).html('<b>'+ogamizeNum(grandTotals[2], options.unitSuffix)+'</b>');
			$(rows[row].children[5]).html('<b>'+ogamizeNum(grandTotals[3], options.unitSuffix)+'</b>');
			$(rows[row].children[6]).html('<b>'+timespanToShortenedString(grandTotals[4], options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true)+'</b>');
			$(rows[row].children[7]).html('<b>'+ogamizeNum(grandTotals[5], options.unitSuffix)+'</b>');
			if (outer === 0)
				$(rows[row].children[8]).html('<b>0</b>');
			let totalRes = grandTotals[0] + grandTotals[1] + grandTotals[2];
			let capSC = 5000.0 * (1 + 0.05 * options.prm.hyperTechLevel);
			if (options.prm.playerClass === 0) {
				capSC += 5000.0 * 0.25;
			}
			let needSC = Math.ceil(totalRes / capSC);
			let capLC = 25000.0 * (1 + 0.05 * options.prm.hyperTechLevel);
			if (options.prm.playerClass === 0) {
				capLC += 25000.0 * 0.25;
			}
			let needLC = Math.ceil(totalRes / capLC);
			$(rows[row+1].children[2]).html(needSC + ' ' + '<abbr title="'+options.scFull+'">'+options.scShort+'</abbr>');
			$(rows[row+1].children[3]).html(needLC + ' ' + '<abbr title="'+options.lcFull+'">'+options.lcShort+'</abbr>');
		}
	}
	options.prm.shipyardLevel = getInputNumber($('#shipyard-level')[0]);
	options.prm.robotFactoryLevelP = getInputNumber($('#robot-factory-level')[0]);
	options.prm.robotFactoryLevelM = getInputNumber($('#robot-factory-level-moon')[0]);
	options.prm.naniteFactoryLevel = getInputNumber($('#nanite-factory-level')[0]);
	options.prm.universeSpeed = $('#universe-speed')[0].value;
	options.prm.researchSpeed = $('#research-speed')[0].value;
	options.prm.researchLabLevel = getInputNumber($('#research-lab-level')[0]);
	options.prm.energyTechLevel = getInputNumber($('#energy-tech-level')[0]);
	options.prm.plasmaTechLevel = getInputNumber($('#plasma-tech-level')[0]);
	options.prm.ionTechLevel = getInputNumber($('#ion-tech-level')[0]);
	options.prm.hyperTechLevel = getInputNumber($('#hyper-tech-level')[0]);
	options.prm.maxPlanetTemp = getInputNumber($('#max-planet-temp')[0]);
	options.prm.geologist = $('#geologist')[0].checked;
	options.prm.engineer = $('#engineer')[0].checked;
	options.prm.technocrat = $('#technocrat')[0].checked;
	options.prm.researchBonus = $('#research-bonus')[0].checked;
	options.prm.admiral = $('#admiral')[0].checked;
	options.prm.commander = $('#commander')[0].checked;
	options.prm.irnLevel = getInputNumber($('#irn-level')[0]);
	options.prm.planetsSpin = getInputNumber($('#planetsSpin')[0]);
	options.prm.planetPos = getInputNumber($('#planet-pos')[0]);
	options.prm.fullNumbers = $('#full-numbers')[0].checked;

	options.save();
}

function getAdjustedTime(techID, techLevelFrom, techLevelTo, isMoon) {
	if (techLevelFrom == 0 & techLevelTo == 0)
		return 0;
	let technocratFactor = $('#technocrat')[0].checked ? 0.75 : 1;
	technocratFactor *= $('#research-bonus')[0].checked ? 0.75 : 1;
	technocratFactor *= options.prm.playerClass === 2 ? 0.75 : 1;
	let speed = (100 < techID && techID <= 200) ? options.prm.researchSpeed : options.prm.universeSpeed;
	let researchLabLevel = 0;
	if (100 < techID && techID <= 200) {
		if (!options.resultingLabLevelComputed)
			researchLabLevel = getInputNumber($('#research-lab-level')[0]);
		else
			researchLabLevel = getLabLevel(options.techReqs[techID]);
	}
	let rfl = isMoon ? options.prm.robotFactoryLevelM : options.prm.robotFactoryLevelP;
	let nl = isMoon ? 0 : options.prm.naniteFactoryLevel;
	return getBuildTime_C(techID, techLevelFrom, techLevelTo, options.techCosts, rfl, nl,
		researchLabLevel, technocratFactor, options.prm.shipyardLevel, speed, options.techReqs);
}

function updateOneMultTab() {
	let techID = Number($('#tech-types-select')[0].value);
	let idx = $('#tech-types-select')[0].selectedIndex;
	let techName = $('#tech-types-select')[0].options[idx].text;
	let isProducer = techID === 1 || techID === 2 || techID === 3 || techID === 4 || techID === 12 || techID === 212;
	let isConsumer = techID === 1 || techID === 2 || techID === 3 || techID === 12;
	let targetTable = '';
	if (isProducer) {
		$('#prods-table-div').show();
		$('#commons-table-div').hide();
		targetTable = 'prods-table';
	} else {
		$('#prods-table-div').hide();
		$('#commons-table-div').show();
		targetTable = 'commons-table';
	}
	let tbl = $('#'+targetTable)[0];
	let footer = $('#'+targetTable+' tr').slice(tbl.rows.length-3).detach();
	for (let i = tbl.rows.length-1; i > 0; i--) {
		$(tbl.rows[i]).remove();
	}

	let levelFrom = getInputNumber($('#tab2-from-level')[0]);
	let levelTo = getInputNumber($('#tab2-to-level')[0]);

	// Если это исследование, и оно невозможно - покажем сообщение и рассчитаем пустую таблицу. Это нужно для того, чтобы проще обновить итоги.
	if (100 < techID && techID <= 200) {
		let researchLabLevel;
		if (!options.resultingLabLevelComputed)
			researchLabLevel = getInputNumber($('#research-lab-level')[0]);
		else
			researchLabLevel = getLabLevel(options.techReqs[techID]);
		if (researchLabLevel < options.techReqs[techID]) {
			$('#tab2-from-level')[0].value = 0;
			$('#tab2-to-level')[0].value = 0;
			levelFrom = 0;
			levelTo = 0;
			showResearchImpossibleMessage(techName);
		}
	}

	if (techID === 0) {
		levelFrom = 0;
		levelTo = 0;
	}
	let resCost = [0, 0, 0];
	let totalMet = 0, totalCrys = 0, totalDeut = 0, energy = 0, maxEnrg = 0, totalTime = 0, production = 0, maxProd = 0, consumption = 0, maxCons = 0, points= 0, totalPts = 0, time = 0;
	let rowData = Array();
	let rowStr;
	for (let i = levelFrom; i < levelTo; i++) {
		rowData = Array();
		rowStr = '';
		rowData.push(i+1);
		resCost = getBuildCost_C(techID, i, i + 1, options.techCosts);
		rowData.push(ogamizeNum(resCost[0], options.unitSuffix));
		rowData.push(ogamizeNum(resCost[1], options.unitSuffix));
		rowData.push(ogamizeNum(resCost[2], options.unitSuffix));
		totalMet += resCost[0];
		totalCrys += resCost[1];
		totalDeut += resCost[2];
		energy = getBuildEnergyCost_C(techID, i + 1, options.techCosts);
		rowData.push(ogamizeNum(energy, options.unitSuffix));
		maxEnrg = Math.max(maxEnrg, energy);
		let time = getAdjustedTime(techID, i, i + 1, false);
		rowData.push(timespanToShortenedString(time, options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true));
		totalTime += time;
		points = (resCost[0] + resCost[1] + resCost[2]) / 1000.0;
		totalPts += points;
		rowData.push(ogamizeNum(Math.round((resCost[0] + resCost[1] + resCost[2])/1000.0), options.unitSuffix));
		if (isProducer) {
			let energyTechLevel = getInputNumber($('#energy-tech-level')[0]);
			let plasmaTechLevel = getInputNumber($('#plasma-tech-level')[0]);
			let maxTemp = getInputNumber($('#max-planet-temp')[0]);
			let uniSpeed = $('#universe-speed')[0].value;
			let booster = $('#booster')[0].value;
			let geologist = $('#geologist')[0].checked;
			let engineer = $('#engineer')[0].checked;
			let technocrat = $('#technocrat')[0].checked;
			let admiral = $('#admiral')[0].checked;
			let commander = $('#commander')[0].checked;
			let fullCrew = geologist && engineer && admiral && commander && technocrat;
			let plnPos = getInputNumber($('#planet-pos')[0]);
			production = getProductionRate(techID, i + 1, energyTechLevel, plasmaTechLevel, maxTemp, plnPos, uniSpeed, geologist, engineer, 1, 1, booster, fullCrew, options.prm.playerClass);
			rowData.push(ogamizeNum(production, options.unitSuffix));
			maxProd = Math.max(maxProd, production);
			// Производящие что-то здания могут потреблять или не потреблять, а остальным техам эта ячейка таблицы не нужна
			if (isConsumer) {
				consumption = getHourlyConsumption(techID, i + 1, $('#universe-speed')[0].value, 1);
				rowData.push(ogamizeNum(consumption, options.unitSuffix));
				maxCons = Math.max(maxCons, consumption);
			} else {
				rowData.push('-');
			}
		}

		rowStr = '<tr class='+((i % 2) === 1 ? 'odd' : 'even')+'>';
		for (let cellNum = 0; cellNum < rowData.length; cellNum++) {
			rowStr += '<td align="center">'+rowData[cellNum]+'</td>';
		}
		rowStr += '</tr>';
		$('#'+targetTable).append(rowStr);
	}
	footer.appendTo('#'+targetTable);
	let rows = $('#'+targetTable+' tr');
	let totalsRow = rows.length - 2;
	rows[totalsRow].children[1].innerHTML = '<b>'+ogamizeNum(totalMet, options.unitSuffix)+'</b>';
	rows[totalsRow].children[2].innerHTML = '<b>'+ogamizeNum(totalCrys, options.unitSuffix)+'</b>';
	rows[totalsRow].children[3].innerHTML = '<b>'+ogamizeNum(totalDeut, options.unitSuffix)+'</b>';
	rows[totalsRow].children[4].innerHTML = '<b>'+ogamizeNum(maxEnrg, options.unitSuffix)+'</b>';
	rows[totalsRow].children[5].innerHTML = '<b>'+timespanToShortenedString(totalTime, options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true)+'</b>';
	rows[totalsRow].children[6].innerHTML = '<b>'+ogamizeNum(Math.round(totalPts), options.unitSuffix)+'</b>';
	if (isProducer) {
		rows[totalsRow].children[7].innerHTML = '<b>'+ogamizeNum(maxProd, options.unitSuffix)+'</b>';
		rows[totalsRow].children[8].innerHTML = '<b>'+ogamizeNum(maxCons, options.unitSuffix)+'</b>';
	}
	let totalRes = totalMet + totalCrys + totalDeut;
	let capSC = 5000.0 * (1 + 0.05 * options.prm.hyperTechLevel);
	if (options.prm.playerClass === 0) {
		capSC += 5000.0 * 0.25;
	}
	let needSC = Math.ceil(totalRes / capSC);
	let capLC = 25000.0 * (1 + 0.05 * options.prm.hyperTechLevel);
	if (options.prm.playerClass === 0) {
		capLC += 25000.0 * 0.25;
	}
	let needLC = Math.ceil(totalRes / capLC);
	rows[totalsRow+1].children[1].innerHTML = numToOGame(needSC) + ' <abbr title="'+options.scFull+'">'+options.scShort+'</abbr>';
	rows[totalsRow+1].children[2].innerHTML = numToOGame(needLC) + ' <abbr title="'+options.lcFull+'">'+options.lcShort+'</abbr>';

	options.prm.energyTechLevel = getInputNumber($('#energy-tech-level')[0]);
	options.prm.plasmaTechLevel = getInputNumber($('#plasma-tech-level')[0]);
	options.prm.ionTechLevel = getInputNumber($('#ion-tech-level')[0]);
	options.prm.hyperTechLevel = getInputNumber($('#hyper-tech-level')[0]);
	options.prm.maxPlanetTemp = getInputNumber($('#max-planet-temp')[0]);
	options.prm.geologist = $('#geologist')[0].checked;
	options.prm.engineer = $('#engineer')[0].checked;
	options.prm.admiral = $('#admiral')[0].checked;
	options.prm.commander = $('#commander')[0].checked;
	options.prm.booster = $('#booster')[0].value;
	options.prm.planetPos = getInputNumber($('#planet-pos')[0]);

	options.save();
}

function changePlanetsCount(newVal, oldVal) {
	if (newVal < options.minPlanetsCount || newVal > options.maxPlanetsCount)
		return;
	if (newVal < oldVal) {
		if (oldVal >= 2) {
			$('#lab-levels-table tr:last').remove();
			options.prm.labLevels.pop();
		}
	} else {
		$('#lab-levels-table').append('<tr class="'+((newVal % 2) === 1 ? 'odd' : 'even')+'">'+
				'<td align="center" >'+options.planetNumStr+newVal+'</td>'+
				'<td align="center" width="20%;"><input type="text" id="lablevel_'+newVal+'" name="lablevel_'+newVal+'>" class="ui-state-default ui-corner-all ui-input input-3columns input-in-table" value="0" /></td>'+
				'<td align="center" width="20%;"><input type="radio" id="labchoice_'+newVal+'" name="start-pln" value="0" disabled="disabled"/></td>'+
				'</tr>');
		$('#lablevel_'+newVal).keyup('changeLabLevel', validateInputNumber);
		$('#labchoice_'+newVal).click(updateResultingLevel);
		options.prm.planetsSpin = newVal;
		options.prm.labLevels.push(0);
	}
//	consoleLog("New lablevels contents: "+options.prm.labLevels);
	updateResultingLevel();
}

function changeLabLevel() {
	let parts = this.id.split(/_/);
	let num = parts[1];
	if (this.value === 0) {
		$('#labchoice_'+num)[0].disabled = 'disabled';
		$('#labchoice_'+num)[0].checked = false;
	}
	else
		$('#labchoice_'+num)[0].disabled = false;

	// массив нумеруется с нуля, строки таблицы с 1
	options.prm.labLevels[num-1] = this.value;
//	consoleLog("Level of lab #"+num+" updated to "+this.value);
	updateResultingLevel();
}

function compareLabs(a, b) {
	// Выбранную лабораторию (в которой будет запущено исследование) надо поднять наверх списка, т.к. она в любом случае участвует в исследовании.
	if (b[1] === true)
		return 1;
	if (a[1] === true)
		return -1;
	// Если ни одна из сравниваемых не выбрана, поднимем наверх ту лабораторию, у которой уровень больше
	return (b[0] - a[0]);
}

function updateResultingLevel() {
	let rows = $('#lab-levels-table tr');
	let haveSelection = false;
	let button = $('#done-btn')[0];
	for (let i = 1; i < rows.length; i++) {
		if ($('#labchoice_'+i)[0].checked) {
			haveSelection = true;
			options.prm.labChoice = i-1;
			break;
		}
	}
	if (!haveSelection) {
		$('#resulting-level')[0].innerHTML = '<b>?</b>';
		$(button).css('display', 'none');
		return;
	}
	let resultingLevel = getLabLevel(0);
	options.resultingLabLevel = resultingLevel;
	$('#resulting-level')[0].innerHTML = '<b>'+resultingLevel+'</b>';

	$(button).css('display', 'inline');
}

$(document).ready(function() {
	// этот вызов нужен, чтобы установить "скин" на чекбоксы и радиокнопки
	//$("div#costs input").filter(":checkbox,:radio").checkbox();
	$("#tabs").tabs({	cookie: {	expires: 365 } });	// UI сохраняет в куках номер открытой вкладки
	$("#tabs-0").tabs({	cookie: {	expires: 365 } });
	$("#tabs-1").tabs({	cookie: {	expires: 365 } });

	$( "#irn-calc" ).dialog({
		autoOpen: false,
		height: 445,
		width: 400,
		modal: true,
		resizable: false,
		buttons: {
			dt: function() {
				$(this).dialog("option", "execute", true);
				$('#research-lab-level')[0].value = options.resultingLabLevel;
				options.resultingLabLevelComputed = true;
				updateParams.apply($('#research-lab-level')[0]);
				$(this).dialog("close");
			},
			ccl: function() {
				$(this).dialog("option", "execute", false);
				$(this).dialog( "close" );
			}
		},
		close: function() {
			if (!$(this).dialog("option", "execute")) {
				loadLLCData();
				updateResultingLevel();
			}
		}
	});
	let dialog = $('div[aria-labelledby="ui-dialog-title-irn-calc"]');
	let buttons = dialog.find('div.ui-dialog-buttonset');
	buttons[0].children[0].children[0].innerHTML = options.doneTitle;
	buttons[0].children[0].id = 'done-btn';
	$(buttons[0].children[0]).css('display', 'none');
	buttons[0].children[1].children[0].innerHTML = options.cancelTitle;

	options.load();
//	consoleLog(options.prm);

	$('#shipyard-level').val(options.prm.shipyardLevel);
	$('#robot-factory-level').val(options.prm.robotFactoryLevelP);
	$('#robot-factory-level-moon').val(options.prm.robotFactoryLevelM);
	$('#nanite-factory-level').val(options.prm.naniteFactoryLevel);
	$('#universe-speed').val(options.prm.universeSpeed);
	$('#research-speed').val(options.prm.researchSpeed);
	$('#research-lab-level').val(options.prm.researchLabLevel);
	$('#ion-tech-level').val(options.prm.ionTechLevel);
	$('#hyper-tech-level').val(options.prm.hyperTechLevel);
	if (options.prm.geologist) {
		$('#geologist')[0].checked = 'checked';
	}
	if (options.prm.engineer) {
		$('#engineer')[0].checked = 'checked';
	}
	if (options.prm.technocrat) {
		$('#technocrat')[0].checked = 'checked';
	}
	if (options.prm.researchBonus === true) {
		$('#research-bonus')[0].checked = 'checked';
	}
	if (options.prm.fullNumbers === true) {
		$('#full-numbers')[0].checked = 'checked';
	}
	if (options.prm.admiral) {
		$('#admiral')[0].checked = 'checked';
	}
	if (options.prm.commander) {
		$('#commander')[0].checked = 'checked';
	}
	$('#tech-types-select')[0].value = 1;
	$('#tab2-from-level')[0].value = 0;
	$('#tab2-to-level')[0].value = 0;
	$('#energy-tech-level').val(options.prm.energyTechLevel);
	$('#plasma-tech-level').val(options.prm.plasmaTechLevel);
	$('#max-planet-temp').val(options.prm.maxPlanetTemp);
	$('#booster').val(options.prm.booster);
	$('#class-'+options.prm.playerClass).attr('checked', true);
	$('#planet-pos').val(options.prm.planetPos);

	loadLLCData();
	updateResultingLevel();


	$('input').focusin(function() {
		$(this).addClass('ui-state-focus');
	});
	$('input').focusout(function() {
		$(this).removeClass('ui-state-focus');
	});

	// После того, как событие будет обработано, нужно вызвать функцию пересчета. Её имя передаём в поле data событий.
	$('#irn-calc input:text').keyup('changeLabLevel', validateInputNumber);
	$('#irn-calc input:radio').click(updateResultingLevel);

	$('#irn-level').unbind();
	$('#irn-level').keyup('updateResultingLevel', validateInputNumber);
	// При изменении значения уровня лаборатории вручную надо запомнить это
	$('#research-lab-level').keyup(function(){
		options.resultingLabLevelComputed = false; updateParams.apply($('#research-lab-level')[0]);
	});

	document.getElementById('max-planet-temp')._constrains = {'min': -134, 'def': 0, 'allowNegative': true};
	document.getElementById('planet-pos')._constrains = {'min': 1, 'max': 16, 'def': 8, 'allowNegative': false};
	$('#planet-pos').blur('updateOneMultTab', validateInputNumberOnBlur);

	// После того, как событие будет обработано, нужно вызвать функцию пересчета. Её имя передаём в поле data событий.
	$('#tab-0 input:text').keyup('updateRow', validateInputNumber);
	$('#tab-1 input:text').keyup('updateRow', validateInputNumber);
	$('#tab-2 input:text').keyup('updateOneMultTab', validateInputNumber);
	$('#tab-2 input:text').blur('updateOneMultTab', validateInputNumberOnBlur);

	$('#general-settings input:text').keyup('updateParams', validateInputNumber);
	$('#general-settings select').keyup(updateParams);
	$('#general-settings select').change(updateParams);
	$('#technocrat').click(updateParams);
	$('#research-bonus').click(updateParams);
	$('#full-numbers').click(updateParams);
	$('#general-settings input:radio').click(updateParams);
	$('#open-llc-dialog').click(function() {
		$("#irn-calc").dialog("option", "execute", false);
		$("#irn-calc").dialog( "open" );
	});

	$('#engineer').click(updateParams);
	$('#geologist').click(updateParams);
	$('#admiral').click(updateParams);
	$('#commander').click(updateParams);
	$('#reset').click(resetParams);

	$('#tech-types-select').unbind();
	$('#tech-types-select').keyup(updateOneMultTab);
	$('#tech-types-select').change(updateOneMultTab);

	$('#booster').unbind();
	$('#booster').keyup(updateOneMultTab);
	$('#booster').change(updateOneMultTab);


	$("#planetsSpin").unbind();
	let spinOptions = { min: 1, max: 99, step: 1, reset: 1, lock: true, onChange: changePlanetsCount };
	$("#planetsSpin").SpinButton(spinOptions);
	$('#planetsSpin')[0].value = options.currPlanetsCount;

	/*
TODO: Навешать constrains и обработчики keyup/blur на контролы 4й вкладки
	 */

	let theme = { value: 'light', validate: function(key, val) { return val; } };
	loadFromCookie('theme', theme);
	toggleLight(theme.value === 'light');
	$('#cb-light-theme').click(function(){toggleLight($('#cb-light-theme')[0].checked);});
	
	updateTotals();
	updateOneMultTab();
});
