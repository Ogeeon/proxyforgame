let options = {
	defConstraints: {
				min: null,
				max: null,
				def: 0,
				allowFloat: false,
				allowNegative: false
			},
	prm: {
		robotFactoryLevel: 0,
		naniteFactoryLevel: 0,
		universeSpeed: 1,
		ionTechLevel: 0,
		hyperTechLevel: 0,
		playerClass: 0,
		fullNumbers: false,
		tabsState: "",
		capIncrSC: 0,
		capIncrLC: 0,
		megalithLvl: 0,
		mineralResCntrLvl: 0,
		researchCostReduction: 0,
		researchTimeReduction: 0,

		validate: function(field, value) {
			switch (field) {
				case 'robotFactoryLevel': return validateNumber(parseFloat(value), 0, 100, 0);
				case 'naniteFactoryLevel': return validateNumber(parseFloat(value), 0, 100, 0);
				case 'universeSpeed': return validateNumber(parseFloat(value), 1, 10, 1);
				case 'ionTechLevel': return validateNumber(parseFloat(value), 0, 50, 0);
				case 'hyperTechLevel': return validateNumber(parseFloat(value), 0, 50, 0);
				case 'playerClass': return validateNumber(parseFloat(value), 0, 2, 0);
				case 'fullNumbers':  return value === 'true';
				case 'capIncrSC': return validateNumber(parseFloat(value), 0, 1000, 0);
				case 'capIncrLC': return validateNumber(parseFloat(value), 0, 1000, 0);
				case 'megalithLvl': return validateNumber(parseFloat(value), 0, 100, 0);
				case 'mineralResCntrLvl': return validateNumber(parseFloat(value), 0, 100, 0);
				case 'researchCostReduction': return validateNumber(parseFloat(value), 0, 25, 0);
				case 'researchTimeReduction': return validateNumber(parseFloat(value), 0, 99, 0);
				default: return value;
			}
		}
	},

	load: function() {
		try {
			loadFromCookie('options_lfcosts', options.prm);
//			consoleLog("loaded from cookies: ");
//			consoleLog(options.prm);
		} catch(e) {
			alert(e);
		}
	},

	save: function() {
		saveToCookie('options_lfcosts', options.prm);
//		consoleLog("saving to cookies: ");
//		consoleLog(options.prm);
	},

	techData: {},
};
const footerRows = 6;

function resetParams() {
	options.prm.robotFactoryLevel = 0;
	options.prm.naniteFactoryLevel = 0;
	options.prm.universeSpeed = 0;
	options.prm.ionTechLevel = 0;
	options.prm.hyperTechLevel = 0;
	options.prm.playerClass = 0;
	options.prm.fullNumbers = false;
	options.prm.capIncrSC = 0;
	options.prm.capIncrLC = 0;
	options.prm.megalithLvl = 0;
	options.prm.mineralResCntrLvl = 0;
	options.prm.researchCostReduction = 0;
	options.prm.researchTimeReduction = 0;

	$('#robot-factory-level')[0].value = options.prm.robotFactoryLevel;
	$('#nanite-factory-level')[0].value = options.prm.naniteFactoryLevel;
	$('#universe-speed')[0].selectedIndex = options.prm.universeSpeed;
	$('#ion-tech-level')[0].value = options.prm.ionTechLevel;
	$('#hyper-tech-level')[0].value = options.prm.hyperTechLevel;
	$('#sc-capacity-increase')[0].value = options.prm.capIncrSC;
	$('#lc-capacity-increase')[0].value = options.prm.capIncrLC;
	$('#megalith-level')[0].value = options.prm.megalithLvl;
	$('#mrc-level')[0].value = options.prm.mineralResCntrLvl;
	$('#research-cost-reduction')[0].value = options.prm.researchCostReduction;
	$('#research-time-reduction')[0].value = options.prm.researchTimeReduction;

	for (let outer = 0; outer < 2; outer++) {
		let innerNums = [1, 2];
		for (let innerIdx = 0; innerIdx < innerNums.length; innerIdx++) {
			let inner = innerNums[innerIdx];
			let rows = $('#table-'+outer+'-'+inner+' tr');
			for (let row = 1; row < rows.length - footerRows; row++) {
				rows[row].children[2].children[0].value = 0;
				if (outer === 1)
					rows[row].children[3].children[0].value = 0;
				let firstDataCol = (outer === 1)?4:3;
				for (let cell = firstDataCol; cell < firstDataCol+7; cell++) {
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

	$('#class-'+options.prm.playerClass).attr('checked', true);
	$('#full-numbers').attr('checked', false);
	for (let outer = 0; outer < 3; outer++) {
		for (let inner = 1; inner < 3; inner++) {
			$(`#metal-available-${outer}-${inner}`).val(0);
			$(`#crystal-available-${outer}-${inner}`).val(0);
			$(`#deut-available-${outer}-${inner}`).val(0);
		}
	}

	updateTotals();
	updateOneMultTab();
}

// Обновляет данные по строке, в которой сделано изменение и записывает изменённые значения в глобальный массив рассчитанных значений
function updateRow() {
	let techID = Number($(this.parentNode.parentNode.children[0]).html());
	// console.log(`uR: techID=${techID}`);
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
	const rsrCostRdc = getInputNumber($('#research-cost-reduction')[0]);
	const ionTechLevel = (techLevelTo > techLevelFrom) ? 0 : getInputNumber($('#ion-tech-level')[0]);
	var bldCostRdc = Number($('#race-selector')[0].value) === 2 ? 0.01 * getInputNumber($('#megalith-level')[0]) : 0;
	const reductables = [1, 2, 3, 4, 12, 2001, 2002];
	const mrcRdc = Number($('#race-selector')[0].value) === 2 ? 0.005 * getInputNumber($('#mrc-level')[0]) : 0;
	if (reductables.includes(techID))
		bldCostRdc += mrcRdc;
	let dataRow = [0, 0, 0, 0, 0, 0];
	// Для зданий возможен снос, по остальным техам - новый уровень должен быть строго больше старого
	if ((techLevelTo > techLevelFrom || Number(techID) % 1000 < 100) && techLevelTo >= 0) {
		let timeSpan = getAdjustedTime(techID, techLevelFrom, techLevelTo);
		let resCost = getBuildCostLF(techID, techLevelFrom, techLevelTo, options.techCosts, ionTechLevel, rsrCostRdc, bldCostRdc);
		let energyCost = getBuildEnergyCostLF(techID, techLevelTo, options.techCosts, ionTechLevel, bldCostRdc);
		let points;
		if (techLevelTo > techLevelFrom) {
			points = Math.floor((resCost[0] + resCost[1] + resCost[2]) / 1000.0);
		} else {
			let buildResCost = getBuildCostLF(techID, techLevelTo, techLevelFrom, options.techCosts, 0);
			points = -1 * Math.floor((buildResCost[0] + buildResCost[1] + buildResCost[2]) / 1000.0);
		}
		$(row.children[firstDataCol]).html(ogamizeNum(resCost[0], options.unitSuffix));
		$(row.children[firstDataCol+1]).html(ogamizeNum(resCost[1], options.unitSuffix));
		$(row.children[firstDataCol+2]).html(ogamizeNum(resCost[2], options.unitSuffix));
		$(row.children[firstDataCol+3]).html(ogamizeNum(energyCost, options.unitSuffix));
		$(row.children[firstDataCol+4]).html(timespanToShortenedString(timeSpan, options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true));
		$(row.children[firstDataCol+5]).html(ogamizeNum(points, options.unitSuffix));
		let tmCost = 0;
		if (outerTab === 0) {
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
	}
	updateTotals();
}

// Учитывает изменения в параметрах: уровни фабрики роботов, фабрики нанитов, скорость вселенной, . Обновляет время в соответствующих полях глобального массива рассчитанных значений
function updateParams() {
	let techTypes = [1, 2];
	// console.log('UP: techTypes=' + techTypes + ', param=' + param);
	options.prm.robotFactoryLevel = getInputNumber($('#robot-factory-level')[0]);
	options.prm.naniteFactoryLevel = getInputNumber($('#nanite-factory-level')[0]);
	options.prm.universeSpeed = $('#universe-speed')[0].value;
	options.prm.ionTechLevel = getInputNumber($('#ion-tech-level')[0]);
	options.prm.hyperTechLevel = getInputNumber($('#hyper-tech-level')[0]);
	options.prm.capIncrSC = getInputNumber($('#sc-capacity-increase')[0]);
	options.prm.capIncrLC = getInputNumber($('#lc-capacity-increase')[0]);
	options.prm.megalithLvl = getInputNumber($('#megalith-level')[0]);
	options.prm.mineralResCntrLvl = getInputNumber($('#mrc-level')[0]);
	options.prm.researchCostReduction = getInputNumber($('#research-cost-reduction')[0]);
	options.prm.researchTimeReduction = getInputNumber($('#research-time-reduction')[0]);
	if ($('#class-2').attr('checked'))
		options.prm.playerClass = 2;
	else {
		if ($('#class-1').attr('checked'))
			options.prm.playerClass = 1;
		else
			options.prm.playerClass = 0;
	}
	options.prm.fullNumbers = $('#full-numbers')[0].checked;
	let needUpd = {0: false, 1: false};
	let techLevelFrom;
	let techLevelTo;
	const rsrCostRdc = getInputNumber($('#research-cost-reduction')[0]);
	var bldCostRdc = Number($('#race-selector')[0].value) === 2 ? 0.01 * getInputNumber($('#megalith-level')[0]) : 0;
	const reductables = [1, 2, 3, 4, 12, 2001, 2002];
	const mrcRdc = Number($('#race-selector')[0].value) === 2 ? 0.005 * getInputNumber($('#mrc-level')[0]) : 0;
	const ionTechLevel = (techLevelTo > techLevelFrom) ? 0 : getInputNumber($('#ion-tech-level')[0]);
	jQuery.each(options.techData, function(key, value) {
		if (value == null)
			return;
		//consoleLog(key);
		let keyParts = key.split(/-/);
		//consoleLog(keyParts);
		// consoleLog('#table-'+keyParts[1]+'-'+keyParts[2]+' tr');
		if (jQuery.inArray(1*keyParts[2], techTypes) >= 0) {
			// consoleLog('#table-'+keyParts[1]+'-'+keyParts[2]+' tr');
			// мы знаем id техи, которую надо пересчитать, и номера внешней и внутренней вкладок (эти же номера позволят получить id таблицы).
			// Чтобы пересчитать теху, надо получить все строки таблицы, в которой она сидит, и найти там нужную строку по id
			let rows = $('#table-'+keyParts[1]+'-'+keyParts[2]+' tr');
			for (let idx = 1; idx < rows.length; idx++) {
				let rowID = $(rows[idx].children[0]).html();
				// consoleLog(rowID);
				if (rowID === keyParts[0]) {
					// Нашли нужную строку. Пересчитаем время и установим флаг, что для даннй вкладки надо вызвать метод updateNumbers(), который обновит итоги.
					if (keyParts[1]*1 === 1) {
						techLevelFrom = 1*rows[idx].children[2].children[0].value;
						techLevelTo = 1*rows[idx].children[3].children[0].value;
					} else {
						techLevelTo = 1*rows[idx].children[2].children[0].value;
						techLevelFrom = techLevelTo === 0 ? 0 : techLevelTo - 1;
					}
					let techID = Number(rowID);
					if (reductables.includes(techID))
						bldCostRdc += mrcRdc;
					let newCost = getBuildCostLF(techID, techLevelFrom, techLevelTo, options.techCosts, ionTechLevel, rsrCostRdc, bldCostRdc);
					let newTime = getAdjustedTime(techID, techLevelFrom, techLevelTo);
					let newEnergy = getBuildEnergyCostLF(techID, techLevelTo, options.techCosts, ionTechLevel, bldCostRdc);					
					let firstDataCol = (keyParts[1]*1 === 1)?4:3;
					// Если оказалось, что исследование невозможно выполнить, придётся стереть всю строку
					if (newTime > 0) {
						options.techData[key][0] = newCost[0];
						$(rows[idx].children[firstDataCol]).html(ogamizeNum(newCost[0], options.unitSuffix));
						options.techData[key][1] = newCost[1];
						$(rows[idx].children[firstDataCol+1]).html(ogamizeNum(newCost[1], options.unitSuffix));
						options.techData[key][2] = newCost[2];
						$(rows[idx].children[firstDataCol+2]).html(ogamizeNum(newCost[2], options.unitSuffix));
						options.techData[key][3] = newEnergy;
						$(rows[idx].children[firstDataCol+3]).html(ogamizeNum(newEnergy, options.unitSuffix));
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
	options.prm.robotFactoryLevel = getInputNumber($('#robot-factory-level')[0]);
	options.prm.naniteFactoryLevel = getInputNumber($('#nanite-factory-level')[0]);
	options.prm.universeSpeed = $('#universe-speed')[0].value;
	options.prm.ionTechLevel = getInputNumber($('#ion-tech-level')[0]);
	options.prm.hyperTechLevel = getInputNumber($('#hyper-tech-level')[0]);
	options.prm.fullNumbers = $('#full-numbers')[0].checked;
	options.prm.capIncrSC = getInputNumber($('#sc-capacity-increase')[0]);
	options.prm.capIncrLC = getInputNumber($('#lc-capacity-increase')[0]);
	options.prm.megalithLvl = getInputNumber($('#megalith-level')[0]);
	options.prm.mineralResCntrLvl = getInputNumber($('#mrc-level')[0]);
	options.prm.researchCostReduction = getInputNumber($('#research-cost-reduction')[0]);
	options.prm.researchTimeReduction = getInputNumber($('#research-time-reduction')[0]);

	for (let outer = 0; outer < 2; outer++) {
		// Если метод вызывается из updateParams(), то может быть запрошено обновление не всех вкладок
		if (needUpd && needUpd[outer] === false)
			continue;
		let innerNums = [1, 2];
		let firstDataCol = (outer === 0) ? 3 : 4;
		let grandTotals = [0, 0, 0, 0, 0, 0];
		for (let innerIdx = 0; innerIdx < innerNums.length; innerIdx++) {
			let inner = innerNums[innerIdx];
			let rows = $('#table-'+outer+'-'+inner+' tr');
			let totals = [0, 0, 0, 0, 0, 0, 0];
			let row;
			for (row = 1; row < rows.length - footerRows; row++) {
				let techID = $(rows[row].children[0]).html();
				let buildingLevelCol = outer === 1 ? 3 : 2;
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
			$(rows[row].children[2]).html('');
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
			let row = rows.length - 4;
			$(rows[row].children[2]).html('<b>'+ogamizeNum(grandTotals[0], options.unitSuffix)+'</b>');
			$(rows[row].children[3]).html('<b>'+ogamizeNum(grandTotals[1], options.unitSuffix)+'</b>');
			$(rows[row].children[4]).html('<b>'+ogamizeNum(grandTotals[2], options.unitSuffix)+'</b>');
			$(rows[row].children[5]).html('<b>'+ogamizeNum(grandTotals[3], options.unitSuffix)+'</b>');
			$(rows[row].children[6]).html('<b>'+timespanToShortenedString(grandTotals[4], options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true)+'</b>');
			$(rows[row].children[7]).html('<b>'+ogamizeNum(grandTotals[5], options.unitSuffix)+'</b>');
			if (outer === 0)
				$(rows[row].children[8]).html('<b>0</b>');
			let avbMet = getInputNumber($(`#metal-available-${outer}-${inner}`)[0]);
			let avbCrys = getInputNumber($(`#crystal-available-${outer}-${inner}`)[0]);
			let avbDeut = getInputNumber($(`#deut-available-${outer}-${inner}`)[0]);
			const needMet = Math.max(0, grandTotals[0] - avbMet);
			const needCrys = Math.max(0, grandTotals[1] - avbCrys);
			const needDeut = Math.max(0, grandTotals[2] - avbDeut);
			$(rows[rows.length - 2].children[2]).html('<b>'+ogamizeNum(needMet, options.unitSuffix)+'</b>');
			$(rows[rows.length - 2].children[3]).html('<b>'+ogamizeNum(needCrys, options.unitSuffix)+'</b>');
			$(rows[rows.length - 2].children[4]).html('<b>'+ogamizeNum(needDeut, options.unitSuffix)+'</b>');

			let totalRes = needMet + needCrys + needDeut;
			let capSC = 5000.0 * (1 + 0.05 * options.prm.hyperTechLevel);
			if (options.prm.playerClass === 0) {
				capSC += 5000.0 * 0.25;
			}
			capSC += Math.floor(5000.0 * 0.01 * options.prm.capIncrSC);
			let needSC = Math.ceil(totalRes / capSC);
			let capLC = 25000.0 * (1 + 0.05 * options.prm.hyperTechLevel);
			if (options.prm.playerClass === 0) {
				capLC += 25000.0 * 0.25;
			}
			capLC += Math.floor(25000.0 * 0.01 * options.prm.capIncrLC);
			let needLC = Math.ceil(totalRes / capLC);
			$(rows[rows.length - 1].children[2]).html(numToOGame(needSC) + ' ' + '<abbr title="'+options.scFull+'">'+options.scShort+'</abbr>');
			$(rows[rows.length - 1].children[3]).html(numToOGame(needLC) + ' ' + '<abbr title="'+options.lcFull+'">'+options.lcShort+'</abbr>');
		}
	}

	options.save();
}

function getAdjustedTime(techID, techLevelFrom, techLevelTo) {
	if (techLevelFrom == 0 & techLevelTo == 0)
		return 0;
	const rsrTimeRdc = getInputNumber($('#research-time-reduction')[0]);
	const megalithRdc = Math.min(0.99, Number($('#race-selector')[0].value) === 2 ? 0.01 * getInputNumber($('#megalith-level')[0]) : 0);
	return getBuildTimeLF(techID, techLevelFrom, techLevelTo, options.techCosts,
		options.prm.robotFactoryLevel, options.prm.naniteFactoryLevel, options.prm.universeSpeed, rsrTimeRdc, megalithRdc);
}

function updateOneMultTab() {
	options.prm.ionTechLevel = getInputNumber($('#ion-tech-level')[0]);
	options.prm.hyperTechLevel = getInputNumber($('#hyper-tech-level')[0]);
	options.prm.capIncrSC = getInputNumber($('#sc-capacity-increase')[0]);
	options.prm.capIncrLC = getInputNumber($('#lc-capacity-increase')[0]);
	options.prm.megalithLvl = getInputNumber($('#megalith-level')[0]);
	options.prm.mineralResCntrLvl = getInputNumber($('#mrc-level')[0]);
	options.prm.researchCostReduction = getInputNumber($('#research-cost-reduction')[0]);
	options.prm.researchTimeReduction = getInputNumber($('#research-time-reduction')[0]);

	let techID = Number($('#tech-types-select')[0].value);
	if (techID == 0) {
		let tbl = $('#commons-table')[0];
		let footer = $('#commons-table tr').slice(tbl.rows.length-5).detach();
		for (let i = tbl.rows.length-1; i > 0; i--) {
			$(tbl.rows[i]).remove();
		}
		footer.appendTo('#commons-table');
		let rows = $('#commons-table tr');
		let totalsRow = rows.length - 4;
		rows[totalsRow].children[1].innerHTML = '<b>0</b>';
		rows[totalsRow].children[2].innerHTML = '<b>0</b>';
		rows[totalsRow].children[3].innerHTML = '<b>0</b>';
		rows[totalsRow].children[4].innerHTML = '<b>0</b>';
		rows[totalsRow].children[5].innerHTML = '<b>'+timespanToShortenedString(0, options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true)+'</b>';
		rows[totalsRow].children[6].innerHTML = '<b>0</b>';
		rows[totalsRow + 2].children[1].innerHTML = '<b>0</b>';
		rows[totalsRow + 2].children[2].innerHTML = '<b>0</b>';
		rows[totalsRow + 2].children[3].innerHTML = '<b>0</b>';
		rows[totalsRow + 3].children[1].innerHTML = '0 <abbr title="'+options.scFull+'">'+options.scShort+'</abbr>';
		rows[totalsRow + 3].children[2].innerHTML = '0 <abbr title="'+options.lcFull+'">'+options.lcShort+'</abbr>';
		return;
	}
	const inputs = ['metal', 'crystal', 'deut'];
	let focusedInput = -1;
	inputs.forEach((input, id) => {
		if ($(`#${input}-available-2-1`).is(':focus'))
			focusedInput = id;
	});
	let targetTable = 'commons-table';
	let tbl = $('#'+targetTable)[0];
	let footer = $('#'+targetTable+' tr').slice(tbl.rows.length-5).detach();
	for (let i = tbl.rows.length-1; i > 0; i--) {
		$(tbl.rows[i]).remove();
	}

	let levelFrom = getInputNumber($('#tab2-from-level')[0]);
	let levelTo = getInputNumber($('#tab2-to-level')[0]);

	if (techID === 0) {
		levelFrom = 0;
		levelTo = 0;
	}
	const rsrCostRdc = getInputNumber($('#research-cost-reduction')[0]);
	const ionTechLevel = (levelTo > levelFrom) ? 0 : getInputNumber($('#ion-tech-level')[0]);
	var bldCostRdc = Number($('#race-selector')[0].value) === 2 ? 0.01 * getInputNumber($('#megalith-level')[0]) : 0;
	const reductables = [1, 2, 3, 4, 12, 2001, 2002];
	const mrcRdc = Number($('#race-selector')[0].value) === 2 ? 0.005 * getInputNumber($('#mrc-level')[0]) : 0;
	if (reductables.includes(techID))
		bldCostRdc += mrcRdc;
	let resCost = [0, 0, 0];
	let totalMet = 0, totalCrys = 0, totalDeut = 0, energy = 0, maxEnrg = 0, totalTime = 0, production = 0, maxProd = 0, consumption = 0, maxCons = 0, points= 0, totalPts = 0, time = 0;
	let rowData = Array();
	let rowStr;
	for (let i = levelFrom; i < levelTo; i++) {
		rowData = Array();
		rowStr = '';
		rowData.push(i+1);
		resCost = getBuildCostLF(techID, i, i + 1, options.techCosts, ionTechLevel, rsrCostRdc, bldCostRdc);
		rowData.push(ogamizeNum(resCost[0], options.unitSuffix));
		rowData.push(ogamizeNum(resCost[1], options.unitSuffix));
		rowData.push(ogamizeNum(resCost[2], options.unitSuffix));
		totalMet += resCost[0];
		totalCrys += resCost[1];
		totalDeut += resCost[2];
		energy = getBuildEnergyCostLF(techID, i + 1, options.techCosts, ionTechLevel, bldCostRdc);
		rowData.push(ogamizeNum(energy, options.unitSuffix));
		maxEnrg = Math.max(maxEnrg, energy);
		let time = getAdjustedTime(techID, i, i + 1);
		rowData.push(timespanToShortenedString(time, options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true));
		totalTime += time;
		points = (resCost[0] + resCost[1] + resCost[2]) / 1000.0;
		totalPts += points;
		rowData.push(ogamizeNum(Math.round((resCost[0] + resCost[1] + resCost[2])/1000.0), options.unitSuffix));

		rowStr = '<tr class='+((i % 2) === 1 ? 'odd' : 'even')+'>';
		for (let cellNum = 0; cellNum < rowData.length; cellNum++) {
			rowStr += '<td align="center">'+rowData[cellNum]+'</td>';
		}
		rowStr += '</tr>';
		$('#'+targetTable).append(rowStr);
	}
	footer.appendTo('#'+targetTable);
	inputs.forEach((input, id) => {
		if (focusedInput == id)
			$(`#${input}-available-2-1`).focus();
	});

	let rows = $('#'+targetTable+' tr');
	let totalsRow = rows.length - 4;
	rows[totalsRow].children[1].innerHTML = '<b>'+ogamizeNum(totalMet, options.unitSuffix)+'</b>';
	rows[totalsRow].children[2].innerHTML = '<b>'+ogamizeNum(totalCrys, options.unitSuffix)+'</b>';
	rows[totalsRow].children[3].innerHTML = '<b>'+ogamizeNum(totalDeut, options.unitSuffix)+'</b>';
	rows[totalsRow].children[4].innerHTML = '<b>'+ogamizeNum(maxEnrg, options.unitSuffix)+'</b>';
	rows[totalsRow].children[5].innerHTML = '<b>'+timespanToShortenedString(totalTime, options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true)+'</b>';
	rows[totalsRow].children[6].innerHTML = '<b>'+ogamizeNum(Math.round(totalPts), options.unitSuffix)+'</b>';
	
	let avbMet = getInputNumber($(`#metal-available-2-1`)[0]);
	let avbCrys = getInputNumber($(`#crystal-available-2-1`)[0]);
	let avbDeut = getInputNumber($(`#deut-available-2-1`)[0]);
	const needMet = Math.max(0, totalMet - avbMet);
	const needCrys = Math.max(0, totalCrys - avbCrys);
	const needDeut = Math.max(0, totalDeut - avbDeut);
	rows[totalsRow + 2].children[1].innerHTML = '<b>'+ogamizeNum(needMet, options.unitSuffix)+'</b>';
	rows[totalsRow + 2].children[2].innerHTML = '<b>'+ogamizeNum(needCrys, options.unitSuffix)+'</b>';
	rows[totalsRow + 2].children[3].innerHTML = '<b>'+ogamizeNum(needDeut, options.unitSuffix)+'</b>';

	let totalRes = totalMet + totalCrys + totalDeut;
	let capSC = 5000.0 * (1 + 0.05 * options.prm.hyperTechLevel);
	if (options.prm.playerClass === 0) {
		capSC += 5000.0 * 0.25;
	}
	capSC += Math.floor(5000.0 * 0.01 * options.prm.capIncrSC);
	let needSC = Math.ceil(totalRes / capSC);
	let capLC = 25000.0 * (1 + 0.05 * options.prm.hyperTechLevel);
	if (options.prm.playerClass === 0) {
		capLC += 25000.0 * 0.25;
	}
	capLC += Math.floor(25000.0 * 0.01 * options.prm.capIncrLC);
	let needLC = Math.ceil(totalRes / capLC);
	rows[totalsRow + 3].children[1].innerHTML = numToOGame(needSC) + ' <abbr title="'+options.scFull+'">'+options.scShort+'</abbr>';
	rows[totalsRow + 3].children[2].innerHTML = numToOGame(needLC) + ' <abbr title="'+options.lcFull+'">'+options.lcShort+'</abbr>';

	options.save();
}

function hideNShowItems() {
	let race = $('#race-selector')[0].value;
	for (let outer = 0; outer < 2; outer++) {
		for (let inner = 1; inner < 3; inner++) {
			let rows = $(`#table-${outer}-${inner} tr`);
			for (let row = 1; row < rows.length - footerRows; row++) {
				let rowID = Number($(rows[row].children[0]).html());
				if (Math.floor(rowID / 1000) == race) {
					$(rows[row]).show();
				} else {
					$(rows[row]).hide();
				}
			}
		}
	}
	const opts = $('#tech-types-select option');
	for (let i = 0; i < opts.length; i++) {
		if (Math.floor(Number(opts[i].value) / 1000) == race) {
			$(opts[i]).show();
		} else {
			$(opts[i]).hide();
		}
	}
	$("#tech-types-select").val([]);
	if (race == 2) {
		$('#megalith-level').show();
		$('#lbl-megalith-level').show();
		$('#mrc-level').show();
		$('#lbl-mrc-level').show();
	} else {
		$('#megalith-level').hide();
		$('#lbl-megalith-level').hide();
		$('#mrc-level').hide();
		$('#lbl-mrc-level').hide();
	}
	updateOneMultTab();
}

function spreadValue() {
	const type = this.id.match(/metal|crystal|deut/)[0];
	const value = getInputNumber($(`#${this.id}`)[0]);
	for (let outer = 0; outer < 3; outer++) {
		for (let inner = 1; inner < 3; inner++) {
			$(`#${type}-available-${outer}-${inner}`).val(value);
		}
	}
	updateParams();
}

function storeTabsState() {
	options.prm.tabsState = $("#tabs .ui-state-active a").attr("href")
		+ "^" +$("#tabs-0 .ui-state-active a").attr("href")
		+ "^" +$("#tabs-1 .ui-state-active a").attr("href");
	options.save();
}

function restoreTabsState() {
	const states = options.prm.tabsState.split("^");
	var index = $(`#tabs a[href="${states[0]}"]`).parent().index();
	$('#tabs').tabs('select', index);
	index = $(`#tabs-0 a[href="${states[1]}"]`).parent().index();
	$('#tabs-0').tabs('select', index);
	index = $(`#tabs-1 a[href="${states[2]}"]`).parent().index();
	$('#tabs-1').tabs('select', index);
}

$(document).ready(function() {
	$("#tabs").tabs({select: function(event, ui) {setTimeout(() => {storeTabsState();}, 1000);}});
	$("#tabs-0").tabs({select: function(event, ui) {setTimeout(() => {storeTabsState();}, 1000);}});
	$("#tabs-1").tabs({select: function(event, ui) {setTimeout(() => {storeTabsState();}, 1000);}});

	options.load();
//	consoleLog(options.prm);

	$('#robot-factory-level').val(options.prm.robotFactoryLevel);
	$('#nanite-factory-level').val(options.prm.naniteFactoryLevel);
	$('#universe-speed').val(options.prm.universeSpeed);
	$('#ion-tech-level').val(options.prm.ionTechLevel);
	$('#hyper-tech-level').val(options.prm.hyperTechLevel);
	$('#tech-types-select')[0].value = 1;
	$('#tab2-from-level')[0].value = 0;
	$('#tab2-to-level')[0].value = 0;
	$('#class-'+options.prm.playerClass).attr('checked', true);
	$('#full-numbers').attr('checked', options.prm.fullNumbers);
	$('#sc-capacity-increase').val(options.prm.capIncrSC);
	$('#lc-capacity-increase').val(options.prm.capIncrLC);
	$('#megalith-level').val(options.prm.megalithLvl);
	$('#mrc-level').val(options.prm.mineralResCntrLvl);
	$('#research-cost-reduction').val(options.prm.researchCostReduction);
	$('#research-time-reduction').val(options.prm.researchTimeReduction);

	$('input').focusin(function() {
		$(this).addClass('ui-state-focus');
	});
	$('input').focusout(function() {
		$(this).removeClass('ui-state-focus');
	});

	// После того, как событие будет обработано, нужно вызвать функцию пересчета. Её имя передаём в поле data событий.
	$('#tab-0 input:text').keyup('updateRow', validateInputNumber);
	$('#tab-1 input:text').keyup('updateRow', validateInputNumber);
	$('#tab-2 input:text').keyup('updateOneMultTab', validateInputNumber);
	$('#tab-2 input:text').blur('updateOneMultTab', validateInputNumberOnBlur);

	$('#general-settings input:text').keyup('updateParams', validateInputNumber);
	$('#general-settings select').keyup(updateParams);
	$('#general-settings select').change(updateParams);
	$('#general-settings input:radio').click(updateParams);
	$('#full-numbers').click(updateParams);

	$('#reset').click(resetParams);

	$('#tech-types-select').unbind();
	$('#tech-types-select').keyup(updateOneMultTab);
	$('#tech-types-select').change(updateOneMultTab);

	$('#race-selector').unbind();
	$('#race-selector').change(hideNShowItems);
	
	for (let outer = 0; outer < 3; outer++) {
		for (let inner = 1; inner < 3; inner++) {
			$(`#metal-available-${outer}-${inner}`).unbind();
			$(`#metal-available-${outer}-${inner}`).keyup('spreadValue', validateInputNumber);
			$(`#crystal-available-${outer}-${inner}`).unbind();
			$(`#crystal-available-${outer}-${inner}`).keyup('spreadValue', validateInputNumber);
			$(`#deut-available-${outer}-${inner}`).unbind();
			$(`#deut-available-${outer}-${inner}`).keyup('spreadValue', validateInputNumber);
		}
	}

	$('#sc-capacity-increase').data('constrains', {'min': 0, 'max': 1000, 'def': 0, 'allowFloat': true, 'allowNegative': false});
	$('#lc-capacity-increase').data('constrains', {'min': 0, 'max': 1000, 'def': 0, 'allowFloat': true, 'allowNegative': false});
	$('#megalith-level').data('constrains', {'min': 0, 'max': 100, 'def': 0, 'allowFloat': false, 'allowNegative': false});
	$('#mrc-level').data('constrains', {'min': 0, 'max': 100, 'def': 0, 'allowFloat': false, 'allowNegative': false});
	$('#research-cost-reduction').data('constrains', {'min': 0, 'max': 25, 'def': 0, 'allowFloat': true, 'allowNegative': false});
	$('#research-time-reduction').data('constrains', {'min': 0, 'max': 99, 'def': 0, 'allowFloat': true, 'allowNegative': false});

	let theme = { value: 'light', validate: function(key, val) { return val; } };
	loadFromCookie('theme', theme);
	toggleLight(theme.value === 'light');
	$('#cb-light-theme').click(function(){toggleLight($('#cb-light-theme')[0].checked);});

	restoreTabsState();
	hideNShowItems();
	updateTotals();
	updateOneMultTab();
});
