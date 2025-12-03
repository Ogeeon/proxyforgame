let options = {
	shipsData: [],
	driveBonuses: [0, 0, 0],
	defConstraints: {
		min: null,
		max: null,
		def: 0,
		allowFloat: false,
		allowNegative: false
	},
	isSpeedOvr: false,
	ovrSpeed: 0,
	prm: {
		driveLevels: [0, 0, 0],
		uniSpeed: 1,
		circularGalaxies: false,
		circularSystems: false,
		numberOfGalaxies: 9,
		numberOfSystems: 499,
		deutFactor: 10,
		deutConsReduction: 25,
		departure: [1, 1, 1],
		destination: [1, 1, 1],
		ships: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		startDT: 0,
		saveStartDT: 0,
		saveReturnDT: 0,
		saveTolerance: 0,
		mode: 0,
		hyperTechLvl: 0,
		flightData: [0],
		playerClass: 0,
		traderBonus: false,
		spCargohold: 0,
		lfMechanGE: 0,
		lfRocktalCE: 0,
		lfShipsBonuses: [],
		validate: function (field, value) {
			switch (field) {
				case 'driveLevels':
					return validateNumber(parseFloat(value), 0, 50, 0);
				case 'uniSpeed':
					return validateNumber(parseFloat(value), 1, 10, 1);
				case 'circularGalaxies':
					return value === 'true';
				case 'circularSystems':
					return value === 'true';
				case 'numberOfSystems':
					return validateNumber(parseFloat(value), 1, 550, 499);
				case 'numberOfGalaxies':
					return validateNumber(parseFloat(value), 1, 12, 9);
				case 'deutFactor':
					return validateNumber(parseFloat(value), 5, 10, 10);
				case 'deutConsReduction':
					return validateNumber(parseFloat(value), 25, 50, 25);
				case 'departure':
					return validateNumber(parseFloat(value), 1, 1000, 1);
				case 'destination':
					return validateNumber(parseFloat(value), 1, 1000, 1);
				case 'ships':
					return validateNumber(parseFloat(value), 0, Infinity, 0);
				case 'startDT':
					return validateNumber(parseFloat(value), 0, Infinity, 0);
				case 'saveStartDT':
					return validateNumber(parseFloat(value), 0, Infinity, 0);
				case 'saveReturnDT':
					return validateNumber(parseFloat(value), 0, Infinity, 0);
				case 'saveTolerance':
					return validateNumber(parseFloat(value), 0, Infinity, 0);
				case 'mode':
					return validateNumber(parseFloat(value), 0, 1, 0);
				case 'hyperTechLvl':
					return validateNumber(parseFloat(value), 0, Infinity, 0);
				case 'flightData':
					return validateNumber(parseFloat(value), -Infinity, Infinity, 0);
				case 'playerClass':
					return validateNumber(parseFloat(value), 0, 2, 0);
				case 'traderBonus':
					return value === 'true';
				case 'spCargohold':
					return validateNumber(parseFloat(value), 0, 5, 0);
				case 'lfMechanGE':
					return validateNumber(parseFloat(value), 0, Infinity, 0);
				case 'lfRocktalCE':
					return validateNumber(parseFloat(value), 0, Infinity, 0);
				case 'lfShipsBonuses':
					return validateNumber(parseFloat(value), 0, Infinity, 0);
				default:
					return value;
			}
		}
	},

	load: function (key) {
		try {
			loadFromCookie(key, options.prm);
			if (options.prm.lfShipsBonuses.length != 15 || options.prm.lfShipsBonuses[0].length == undefined) {
				options.prm.lfShipsBonuses = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
			}
		} catch (e) {
			alert(e);
			resetParams();
		}
	},

	save: function () {
		saveToCookie('options_flight', options.prm);
	}
};

function isSpeedDoubled(playerClass, shipID) {
	if (playerClass === 0 && shipID < 2) { // у Коллекционера ускоряются только транспорты
		return true;
	}
	if (playerClass === 1) { // у Генерала ускоряются все боевые корабли и Переработчики
		let boosted = [2, 3, 4, 5, 7, 9, 10, 12, 13, 14];
		if (jQuery.inArray(shipID, boosted) > -1) {
			return true;
		}
	}
	return false;
}

function getShipSpeed(index) {
	let shipSpeed = options.shipsData[index][1] * (1 + (options.driveBonuses[options.shipsData[index][2]]/100));
	if (isSpeedDoubled(options.prm.playerClass, index)) {
		shipSpeed += options.shipsData[index][1] * Math.floor(1 + options.prm.lfRocktalCE * 0.01);
		// Mechan General Enhancement affects only General's ships
		if (options.prm.playerClass === 1) {
			shipSpeed += options.shipsData[index][1] * (1 + 0.002 * options.prm.lfMechanGE);
		}
	}
	if ($('#warrior-bonus')[0].checked) {
		shipSpeed += options.shipsData[index][1] * 0.1;
	}
	if ($('#trader-bonus')[0].checked && index < 2) {
		shipSpeed += options.shipsData[index][1] * 0.1;
	}
	let lfBonus = 0.01 * options.prm.lfShipsBonuses[index][0];
	shipSpeed += Math.ceil(options.shipsData[index][1] * lfBonus);
	return shipSpeed;
}

function getMinSpeed() {
	let minSpeed = Infinity;
	for(let i = 0; i < options.shipsData.length; i++) {
		// в shipsData[i][0] у нас сокращение - оно же имя поля для ввода количества кораблей
		let shipCount = getInputNumber($('#'+options.shipsData[i][0])[0]);
		let shipSpeed = getShipSpeed(i);
		// попутно с вычислением скорости самого медленного корабля во флоте выведем значения скорости всех кораблей
		$('#'+options.shipsData[i][0]+'-speed').text(numToOGame(Math.round(shipSpeed)));
		if(shipCount > 0 && shipSpeed > 0 && !isNaN(shipSpeed))
		{
			minSpeed = Math.min(minSpeed, shipSpeed);
		}
	}
	return minSpeed;
}

function getDistance(departure, destination) {
    let dst;
	if ((departure[0] - destination[0]) !== 0) {
		dst = Math.abs(departure[0] - destination[0]);
		if (options.prm.circularGalaxies)
			dst = Math.min(dst, options.prm.numberOfGalaxies - dst);
		dst *= 20000;
	} else if ((departure[1] - destination[1]) !== 0) {
		dst = Math.abs(departure[1] - destination[1]);
		if (options.prm.circularSystems)
			dst = Math.min(dst, options.prm.numberOfSystems - dst);
		dst = dst * 95 + 2700;
	} else if ((departure[2] - destination[2]) !== 0) {
		dst = Math.abs(departure[2] - destination[2]) * 5 + 1000;
	} else {
		dst = 5;
	}
	return dst;
}

function getFlightDuration(minSpeed, distance, speedPercent, uniSpeedFactor) {
	return Math.round(((35000 / (speedPercent / 10) * Math.sqrt(distance * 10 / minSpeed) + 10) / uniSpeedFactor ));
}

function getDeutConsumption(minSpeed, distance, duration, speedPercent, uniSpeedFactor) {
	let totalConsumption = 0;
	let shipConsumption = 0;
	let i;
	for(i = 0; i < options.shipsData.length; i++)
    {
		let shipsCount = getInputNumber($('#' + options.shipsData[i][0])[0]);
		options.prm.ships[i] = shipsCount;
		if (shipsCount > 0) {
			let baseShipSpeed = getShipSpeed(i);
			let shipSpeedValue =  35000 / (duration * uniSpeedFactor - 10) * Math.sqrt(distance * 10 / baseShipSpeed);
			let classFactor = options.prm.playerClass === 1 ? 0.01 * options.prm.deutConsReduction * (1 + 0.002 * options.prm.lfMechanGE) : 0;
			let lfFactor = options.prm.lfShipsBonuses[i][2] * 0.01;
			let baseConsumption = Math.floor(Math.floor(options.shipsData[i][3] * 0.1 * options.prm.deutFactor) * (1 - classFactor) * (1 - lfFactor));
			shipConsumption = Math.round(baseConsumption * shipsCount);
	        shipConsumption = shipConsumption < 1 ? 1 : shipConsumption;
	        totalConsumption += shipConsumption * distance / 35000 * ((shipSpeedValue / 10) + 1) * ((shipSpeedValue / 10) + 1);
		}
	}
    totalConsumption = Math.round(totalConsumption);
	return totalConsumption;
}

function getCargoCapacity(hyperTechLvl) {
	let capacity = 0;
	let i;
    for(i = 0; i < options.shipsData.length; i++)
    {
        let shipCount = getInputNumber($('#'+options.shipsData[i][0])[0]);
		if (shipCount > 0) {
			let increment = shipCount*(options.shipsData[i][4] * (1 + 0.05 * hyperTechLvl));
			if (options.prm.playerClass === 0 && i < 2) { // у Коллекционера транспорты более вместительные
				increment += Math.floor(shipCount*(options.shipsData[i][4]) * 0.25 * (1 + options.prm.lfRocktalCE * 0.01));
			}
			if (options.prm.playerClass === 1 && (i === 7 || i === 14)) { // у Генерала переработчики и первопроходцы более вместительные
				increment += shipCount*(options.shipsData[i][4]) * 0.2;
			}
			increment +=  Math.floor(shipCount * options.shipsData[i][4] * options.prm.lfShipsBonuses[i][1] * 0.01); // данные видны в процентах
			capacity += increment;
		}
	}

	return Math.floor(capacity);
}

function checkCoordinates(point) {
    let gal = $('#'+point+'-g')[0];
    let sys = $('#'+point+'-s')[0];
    let pln = $('#'+point+'-p')[0];
	options.prm[point][0] = getInputNumber(gal);
	options.prm[point][1] = getInputNumber(sys);
	options.prm[point][2] = getInputNumber(pln);
	if (options.prm[point][0] <=0 || options.prm[point][0] > getConstraint(gal, 'max', Infinity))
		return false;
	if (options.prm[point][1] <=0 || options.prm[point][1] > getConstraint(sys, 'max', Infinity))
		return false;
	return !(options.prm[point][2] <= 0 || options.prm[point][2] > getConstraint(pln, 'max', Infinity));

}

function validateDateField(id) {
    let fld = $('#'+id);
	if (fld[0].value.search('_') >= 0 || parseDate(fld[0].value, options.datetimeFormat) === 0) {
		// Если в поле вообще пусто, не будем раздражать пользователя красной рамкой.
		if (fld[0].value === '' || fld[0].value === '__.__.____ __:__:__') {
			fld.removeClass('ui-state-error').addClass('ui-state-default');
		} else {
			fld.removeClass('ui-state-default').addClass('ui-state-error');
		}
		return false;
	} else {
		// Если дата в поле парсится нормально, можно гарантированно присваивать соответствующий класс
		fld.removeClass('ui-state-error').addClass('ui-state-default');
		return true;
	}
}

function clearFlightTimesTable() {
	let ftTable = $('#flight-times tr');
	for (let i = 1; i<=20; i++) {
		$(ftTable[i].children[1]).html('');
		$(ftTable[i].children[2]).html('');
		$(ftTable[i].children[3]).html('');
		ftTable[i].children[4].children[0].hidden = true;
		if ((i % 2) === 0) ftTable[i].hidden = (options.prm.playerClass !== 1);
		idx = options.prm.playerClass === 1 ? i : Math.floor(i / 2.0) + 1;
		if ((idx % 2) === 0)
			$(ftTable[i]).removeClass('even').addClass('odd');
		else
			$(ftTable[i]).removeClass('odd').addClass('even');
	}
}

function resetParams() {
	options.prm.driveLevels = [0, 0, 0];
	options.prm.circularGalaxies = false;
	options.prm.circularSystems = false;
	options.prm.numberOfGalaxies = 9;
	options.prm.numberOfSystems = 499;
	options.prm.uniSpeed = 1;
	options.prm.deutFactor = 10;
	options.prm.deutConsReduction = 25;
	options.prm.departure = [1, 1, 1];
	options.prm.destination = [1, 1, 1];
	options.prm.ships = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	options.prm.startDT = 0;
	options.prm.saveStartDT = 0;
	options.prm.saveReturnDT = 0;
	options.prm.saveTolerance = 0;
	options.prm.hyperTechLvl = 0;
	options.prm.playerClass = 0;
	options.prm.traderBonus = false;
	options.prm.spCargohold = 0;
	options.prm.lfMechanGE = 0;
	options.prm.lfRocktalCE = 0;
	options.prm.lfShipsBonuses = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
	
	$('#cmb-drive').val(options.prm.driveLevels[0]);
	$('#imp-drive').val(options.prm.driveLevels[1]);
	$('#hyp-drive').val(options.prm.driveLevels[2]);
	$('#universe-speed').val(options.prm.uniSpeed);
	$('#circular-galaxies')[0].checked = options.prm.circularGalaxies;
	$('#circular-systems')[0].checked = options.prm.circularSystems;
	$('#galaxies-num').val(options.prm.numberOfGalaxies);
	$('#deut-factor').val(options.prm.deutFactor);
	$('#deut-generals-bonus').val(options.prm.deutConsReduction);
	$('#systems-num').val(options.prm.numberOfSystems);	
	$('#departure-g').val(options.prm.departure[0]);
	$('#departure-s').val(options.prm.departure[1]);
	$('#departure-p').val(options.prm.departure[2]);
	$('#hypertech-lvl').val(options.prm.hyperTechLvl);
	$('#destination-g').val(options.prm.destination[0]);
	$('#destination-s').val(options.prm.destination[1]);
	$('#destination-p').val(options.prm.destination[2]);
	for (let i = 0; i < options.shipsData.length; i++){
		$('#'+options.shipsData[i][0]).val(options.prm.ships[i]);
	}
	$('#start-datetime').val('');
	let rows = $('#flight-data tr');
	for(let i = rows.length-1; i >= 0; i--) {
		removeFlightRow.apply(rows[i].children[2].children[0]);
	}
	$('#save-start-datetime').val('');
	$('#save-return-datetime').val('');
	$('#save-tolerance-time').val('');
	$('#class-'+options.prm.playerClass).attr('checked', true);
	$('#trader-bonus')[0].checked = options.prm.traderBonus;
	$('#sp-cargohold').val(options.prm.spCargohold);
	clearSavePointsTable();
	
	$('#lf-ships-bonuses input:text').val(0);
	$('#lf-mechan-general-enh').val(0);
	$('#lf-rocktal-collector-enh').val(0);
	$('#api-code').val('');
	
	updateNumbers();
	updateArrival();
}

function updateNumbers() {
	//	сокращение, скорость, тип двигателя, потр.дейтерия, грузоподъёмность
	options.shipsData = [
		['small-cargo', 5000, 0, 10, 5000],		// 0
		['large-cargo', 7500, 0, 50, 25000],	// 1
		['light-fighter', 12500, 0, 20, 50],	// 2
		['heavy-fighter', 10000, 1, 75, 100],	// 3
		['cruiser', 15000, 1, 300, 800],		// 4
		['battleship', 10000, 2, 500, 1500],	// 5
		['colony-ship', 2500, 1, 1000, 7500],	// 6
		['recycler', 2000, 0, 300, 20000],		// 7
		['esp-probe', 100000000, 0, 1, 0],		// 8
		['bomber', 4000, 1, 700, 500],			// 9
		['destroyer', 5000, 2, 1000, 2000],		// 10
		['death-star', 100, 2, 1, 1000000],		// 11
		['battlecruiser', 10000, 2, 250, 750],	// 12
		['reaper', 7000, 2, 1100, 10000],		// 13
		['pathfinder', 12000, 2, 300, 10000]	// 14
	];

	options.prm.driveLevels[0] = getInputNumber($('#cmb-drive')[0]);
	options.prm.driveLevels[1] = getInputNumber($('#imp-drive')[0]);
	options.prm.driveLevels[2] = getInputNumber($('#hyp-drive')[0]);
	options.prm.uniSpeed = $('#universe-speed')[0].value;
	options.prm.circularGalaxies = $('#circular-galaxies')[0].checked;
	options.prm.circularSystems = $('#circular-systems')[0].checked;
	options.prm.numberOfSystems = getInputNumber($('#systems-num')[0]);
	options.prm.numberOfGalaxies = getInputNumber($('#galaxies-num')[0]);
	options.prm.deutFactor = $('#deut-factor')[0].value;
	options.prm.deutConsReduction = $('#deut-generals-bonus')[0].value;
	// Обновим ограничения в соответствии с тем, что (возможно) навводил пользователь
	$('#departure-g').data('constrains', {'min': 1, 'def': 0, 'max': options.prm.numberOfGalaxies});
	$('#destination-g').data('constrains', {'min': 1, 'def': 0, 'max': options.prm.numberOfGalaxies});
	$('#departure-s').data('constrains', {'min': 1, 'def': 0, 'max': options.prm.numberOfSystems});
	$('#destination-s').data('constrains', {'min': 1, 'def': 0, 'max': options.prm.numberOfSystems});
	options.prm.hyperTechLvl = getInputNumber($('#hypertech-lvl')[0]);
	if ($('#class-2').attr('checked'))
		options.prm.playerClass = 2;
	else {
		if ($('#class-1').attr('checked'))
			options.prm.playerClass = 1;
		else 
			options.prm.playerClass = 0;
	}
	options.prm.traderBonus = $('#trader-bonus')[0].checked;
	options.prm.spCargohold = getInputNumber($('#sp-cargohold')[0]);
	if (options.prm.spCargohold != 0) {
		options.shipsData[8] = ['esp-probe', 100000000, 0, 1, options.prm.spCargohold];
	}
	
	options.driveBonuses[0] = options.prm.driveLevels[0] * 10;
	options.driveBonuses[1] = options.prm.driveLevels[1] * 20;
	options.driveBonuses[2] = options.prm.driveLevels[2] * 30;
	// при изменении уровня движков кое-что меняется у МТ и бомбера
	if (options.prm.driveLevels[1] > 4)
		options.shipsData[0] = ['small-cargo', 10000, 1, 20,5000];
	else
		options.shipsData[0] = ['small-cargo', 5000, 0, 10, 5000];
	if (options.prm.driveLevels[2] > 7)
		options.shipsData[9] = ['bomber', 5000, 2, 700, 500];
	else
		options.shipsData[9] = ['bomber', 4000, 1, 700, 500];
	// также end-game позволяет ускорить переработчики
	if (options.prm.driveLevels[2] > 14)
		options.shipsData[7] = ['recycler', 6000, 2, 900, 20000];
	else {
		if (options.prm.driveLevels[1] > 16)
			options.shipsData[7] = ['recycler', 4000, 1, 600, 20000];
		else {
			options.shipsData[7] = ['recycler', 2000, 0, 300, 20000];
		}
	}
	options.prm.lfMechanGE = getInputNumber($('#lf-mechan-general-enh')[0]);
	options.prm.lfRocktalCE = getInputNumber($('#lf-rocktal-collector-enh')[0]);
	let rows = $('#lf-ships-bonuses tr');
	for (let i = 1; i <= options.prm.lfShipsBonuses.length; i++) {
		options.prm.lfShipsBonuses[i-1][0] = getInputNumber(rows[i].children[1].children[0]); 
		options.prm.lfShipsBonuses[i-1][1] = getInputNumber(rows[i].children[2].children[0]); 
		options.prm.lfShipsBonuses[i-1][2] = getInputNumber(rows[i].children[3].children[0]);
	}
	for(i = 0; i < options.shipsData.length; i++) {
		let shipsCount = getInputNumber($('#' + options.shipsData[i][0])[0]);
		options.prm.ships[i] = shipsCount;
	}

	let dist = $('#distance');
	if (!checkCoordinates('departure') || !checkCoordinates('destination')) {
		dist.text('-');
		clearFlightTimesTable();
		options.save();
		return;
	}
	let distance = getDistance(options.prm.departure, options.prm.destination);
	dist.text(numToOGame(distance));

	let minSpeed = getMinSpeed();
	if (options.isSpeedOvr) {
		options.ovrSpeed = getInputNumber($('#ovr-speed-t')[0]);
		if (options.ovrSpeed === 0) {
			options.ovrSpeed = 10000;
			$('#ovr-speed-t').val(10000);
		}
		minSpeed = options.ovrSpeed;
	}
	if (minSpeed === Infinity) {
		clearFlightTimesTable();
		options.save();
		return;
	}

	let ftTable = $('#flight-times tr');
	let idx=0;
	for (let i=100; i>0; i-=5) {
		let dur = getFlightDuration(minSpeed, distance, i, options.prm.uniSpeed);
		let durStr = timespanToShortenedString(dur, options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS);
		let row = 1 + (100-i)/5;
		$(ftTable[row].children[1]).html(durStr);
		let cons = getDeutConsumption(minSpeed, distance, dur, i, options.prm.uniSpeed);
		// let cons = getDeutConsumption(0, distance, dur, 0, options.prm.uniSpeed);
		$(ftTable[row].children[2]).html(numToOGame(cons));
		let cap = getCargoCapacity(options.prm.hyperTechLvl);
		$(ftTable[row].children[3]).html(numToOGame(cap));

		ftTable[row].children[4].children[0].hidden = false;
		
		if ((row % 2) === 0) ftTable[row].hidden = (options.prm.playerClass !== 1);
		idx = options.prm.playerClass === 1 ? row : Math.floor(row / 2.0) + 1;
		if ((idx % 2) === 0)
			$(ftTable[row]).removeClass('even').addClass('odd')
		else
			$(ftTable[row]).removeClass('odd').addClass('even');
	}
	options.save();
}

function setDepartureNow() {
	options.prm.startDT = (new Date()).getTime();
	$('#start-datetime')[0].value = getDateStr(options.prm.startDT, options.datetimeFormat);	
	updateArrival();
}

function setSaveDepartureNow() {
	options.prm.saveStartDT = (new Date()).getTime();
	$('#save-start-datetime')[0].value = getDateStr(options.prm.saveStartDT, options.datetimeFormat); 
	options.save();
}

function setDepartureZero() {
	let d = new Date();
	d.setHours(0);
	d.setMinutes(0);
	d.setSeconds(0);
	d.setMilliseconds(0);
	options.prm.startDT = d.getTime();
	$('#start-datetime')[0].value = getDateStr(options.prm.startDT, options.datetimeFormat); 
	updateArrival();
}

function getSecondsFromTimeField(text) {
	let emptyMask = "__ __:__:__";
	if (text.length === 0 || text === emptyMask)
		return 0;

	let rgx = /(\d\d) (\d\d):(\d\d):(\d\d)/;
	let parts = text.match(rgx);

	if (parts == null || parts.length !== 5)
		return -1;

	let result = parts[1] * 24 * 3600;	// дни
	let tmpI = parts[2]; // часы
	if (tmpI <= 23) {
		result += tmpI * 3600;
	} else
		return -1;
	tmpI = parts[3]; // минуты
	if (tmpI <= 59) {
		result += tmpI * 60;
	} else
		return -1;
	tmpI = parts[4]; // секунды
	if (tmpI <= 59) {
		result += 1*tmpI;
	} else
		return -1;
	return result;
}

function updateArrival() {
	// Содержимое полей, определяющих момент старта и длительность полёта, проверяется регулярным выражением.
	// Невалидное значение там может быть только если поле содержит placeholder.
	let startDT = $('#start-datetime').inputmask('unmaskedvalue');
	let showResult = validateDateField('start-datetime');
	let t = parseDate(startDT, options.datetimeFormat);
	options.prm.startDT = t;
	while (options.prm.flightData.length > 0)
		options.prm.flightData.pop();

	let rows = $('#flight-data tr');
	let tmp = 0, sign = 1;
	for (let i=0; i<rows.length; i++){
		let elem = rows[i].children[1].children[0].children[0];
		tmp = getSecondsFromTimeField(elem.value);
		// если значение в поле корректное, добавим его к итогу и покажем, что с полем всё ок. иначе - обведём красной рамкой
		if (tmp >= 0) {
			// Надо подглядеть, что у нас там за знак рядом с этим полем
			sign = $(rows[i].children[0].children[0].children[0]).hasClass('ui-icon-plus') ? 1 : -1;
			options.prm.flightData.push(sign*tmp);
			//console.log(sign*tmp);
			t +=  sign*tmp*1000; // Функция getDateStr() принимает значения в миллисекундах - конвертируем.
			$(elem).removeClass('ui-state-error').addClass('ui-state-default');
		} else {
			$(elem).removeClass('ui-state-default').addClass('ui-state-error');
		}
	}

	if (showResult)
		$('#arrival-moment').text(getDateStr(t, options.datetimeFormat));
	else
		$('#arrival-moment').text('?');
	
	options.save();
}

function getFlightTimeStr(seconds) {
	if (seconds < 0)
		return '';
	let d, h, m, s;
	d = strPad(Math.floor(seconds / 86400), 2, '0', 'STR_PAD_LEFT') ;
	seconds = seconds % 86400;
	h = strPad(Math.floor(seconds / 3600), 2, '0', 'STR_PAD_LEFT') ;
	seconds = seconds % 3600;
	m = strPad(Math.floor(seconds / 60), 2, '0', 'STR_PAD_LEFT') ;
	seconds = seconds % 60;
	s = strPad(seconds, 2, '0', 'STR_PAD_LEFT') ;

	return d+' '+h+':'+m+':'+s;
}

function addFlightRow(event) {
	let rows = $('#flight-data tr');
	let elem = $(rows[rows.length-1].children[1].children[0].children[0]);

	// Если в последней строке не пусто, надо добавить ещё одну. Иначе - просто запишем пришедшие данные в поле или поставим туда курсор
	if (elem[0].value !== '' && elem[0].value !== '00 00:00:00') {
		$('#flight-data').append('<tr>'+
			'<td>'+
				'<div class="ui-state-default ui-corner-all button-toggle" title="'+options.toggleSignHint+'">'+
					'<span class="ui-icon ui-icon-plus"></span>'+
				'</div>'+
			'</td>'+
			'<td>'+
				'<div style="margin: 0;"><input type="text" class="ui-state-default ui-corner-all ui-input flight-time-input"  title="'+options.flightTimeFormatHint+'"/></div>'+
			'</td>'+
			'<td>'+
				'<div class="ui-state-default ui-corner-all button-remove" title="'+options.removeRowHint+'">'+
					'<span class="ui-icon ui-icon-close"></span>'+
				'</div>'+
			'</td></tr>');

		// приходится работать без id элементов, поэтому сначала отвязываем события у всех ранее созданных, а потом привязываем всем имеющимся
		$('div.button-toggle').unbind();
		$('div.button-toggle').click(toggleFlightTimeSign);
		$('div.button-remove').unbind();
		$('div.button-remove').click(removeFlightRow);
		$("input.flight-time-input").unbind();
		$("input.flight-time-input").inputmask(options.flightTimeFormat);
		$("input.flight-time-input").keyup(updateArrival);

		rows = $('#flight-data tr');
		elem = $(rows[rows.length-1].children[1].children[0].children[0]);
	}

	// Метод вызывается либо по щелчку на кнопке, и тогда параметр - это объект с информацией о событии, либо из кода, и тогда параметр - время, которое нужно записать в поле
	if (typeof(event) != 'object') {
		elem[0].value = getFlightTimeStr(Math.abs(Number(event)));
		if (Number(event) < 0) {
			$(rows[rows.length-1].children[0].children[0].children[0]).removeClass('ui-icon-plus').addClass('ui-icon-minus');
		}
	}
	else
		elem.focus();
	updateArrival();
}

function toggleFlightTimeSign() {
	let elem = $(this.children[0]);
	if (elem.hasClass('ui-icon-plus')) {
		elem.removeClass('ui-icon-plus');
		elem.addClass('ui-icon-minus');
	} else {
		elem.removeClass('ui-icon-minus');
		elem.addClass('ui-icon-plus');
	}
	updateArrival();
}

function takeToCalc() {
	let distance = getDistance(options.prm.departure, options.prm.destination);
	let minSpeed = getMinSpeed();
	let perCentText = $(this.parentNode.parentNode.children[0]).eq(0).html();
	let perCent = perCentText.split('%')[0];
	let dur = getFlightDuration(minSpeed, distance, perCent, options.prm.uniSpeed);
	let sign = (options.prm.mode === 1)? -1 : 1;
	addFlightRow(sign*dur);
	options.save();
}

function removeFlightRow() {
	let rows = $('#flight-data tr');
	// последнюю строку не надо удалять, её достаточно просто очистить
	if (rows.length === 1) {
		$(rows[0].children[1].children[0].children[0])[0].value='';
		$(rows[0].children[0].children[0].children[0]).removeClass('ui-icon-minus');
		$(rows[0].children[0].children[0].children[0]).addClass('ui-icon-plus');
	}
	else
		$(this.parentNode.parentNode).remove();
	updateArrival();
}

function clearSavePointsTable() {
	let tables = ['savepoints-galaxies', 'savepoints-systems', 'savepoints-planets'];
	for (let tblidx = 0; tblidx < 3; tblidx++) {
		let tbl = $('#'+tables[tblidx])[0];
		for (let i = tbl.rows.length-1; i > 0; i--) {
			$(tbl.rows[i]).remove();
		}
	}
}

function compareSavePoints(a, b) {
	//если скорости у флотов, летящих к обеим точкам сейва одинаковые, наверх списка поднимаем ту точку, лететь к которой дешевле
	if (a[0] === b[0])
		return (a[2] - b[2]);
	else
		// если скорости разные, наверх поднимаем точку, у которой скорость меньше
		return a[0] - b[0];
}

function validateSPParams() {
	let firstWrong = '';
	if (!checkCoordinates('departure'))
		firstWrong = 'departure-g';

	// Найдём скорость самого медленного корабля во флоте. Если minSpeed === Infinity, значит, ни одного корабля нет.
	let minSpeed = getMinSpeed();
	if (minSpeed === Infinity  && firstWrong === '') {
		firstWrong = 'esp-probe';
	}

	let startDT = $('#save-start-datetime')[0].value;
	if (!validateDateField('save-start-datetime') && firstWrong === '')
		firstWrong = 'save-start-datetime';

	let returnDT = $('#save-return-datetime')[0].value;
	if (!validateDateField('save-return-datetime') && firstWrong === '')
		firstWrong = 'save-return-datetime';

	// Даже если с самими значениями в полях даты/времени отправления и возврата всё в порядке, надо ещё проверить, какая из дат раньше
	if (validateDateField('save-start-datetime') && validateDateField('save-return-datetime')) {
		if ((parseDate(startDT, options.datetimeFormat) > parseDate(returnDT, options.datetimeFormat)) && firstWrong === '')
			firstWrong = 'return-start';
	}

	// В поле "допустимая погрешность" только время. Если placeholder-ов нет, то всё ок: регексп не даст ввести туда кривое значение
	let tolerance = $('#save-tolerance-time')[0].value;
	if (tolerance.search('_') >= 0) {
		// если поле вообще пустое - не будем рисовать на нём красную рамку
		if (tolerance === '__:__')
			$('#save-tolerance-time').removeClass('ui-state-error').addClass('ui-state-default');
		else
			$('#save-tolerance-time').removeClass('ui-state-default').addClass('ui-state-error');
		if (firstWrong === '')
			firstWrong = 'save-tolerance-time';
	} else {
		if (tolerance === '')
			firstWrong = 'save-tolerance-time';
		$('#save-tolerance-time').removeClass('ui-state-error').addClass('ui-state-default');
	}

	return firstWrong;
}

function updateSavePoints() {
	clearSavePointsTable();

	// Запустим проверку параметров. Функция обработает все необходимые поля, но вернёт id первого из них, где что-то не так
	let wrongField = validateSPParams();
	// если что-то не в порядке, надо показать сообщение об ошибке и поставить курсор в нужное поле
	if (wrongField !== '') {
		let msgText = '';
		switch (wrongField) {
			case 'departure-g': msgText = options.msgWrongDepartureCoordinates; break;
			case 'esp-probe': msgText = options.msgNoShips; break;
			case 'save-start-datetime': msgText = options.msgWrongDepartureTime; break;
			case 'save-return-datetime': msgText = options.msgWrongReturnTime; break;
			case 'save-tolerance-time': msgText = options.msgWrongTolerance; break;
			case 'return-start': msgText = options.msgDepartureAfterReturn; wrongField = 'save-start-datetime'; break;
		}

		$('#'+options.warnindMsgDivId).text(msgText);
		$('#'+options.warnindDivId).fadeIn(800, function () {
			setTimeout(function() {
				$('#'+options.warnindDivId).fadeOut(800);
			}, 5000);
		  });
		$('#'+wrongField)[0].focus();

		return;
	}

	// Если выполнение попало сюда - значит, все параметры проверены. Просто собираем значения.
	let startDT = $('#save-start-datetime')[0].value;
	let returnDT = $('#save-return-datetime')[0].value;
	let tolerance = $('#save-tolerance-time')[0].value;
	let minSpeed = getMinSpeed();

	let startDTValue = parseDate(startDT, options.datetimeFormat);
	options.prm.saveStartDT = startDTValue; 
	let returnDTValue = parseDate(returnDT, options.datetimeFormat);
	options.prm.saveReturnDT = returnDTValue;
	let duration = Math.round(Math.ceil((returnDTValue - startDTValue) / 1000.0) / 2);

	let rgx = /(\d\d):(\d\d)/;
	let parts = tolerance.match(rgx);
	let toleranceValue = Math.round((parts[1]*3600 + parts[2]*60)/2);
	options.prm.saveTolerance = toleranceValue*2; 

	let coords = options.prm.departure;
	let destination = [0, 0, 0];
	let deltas = [0, 0, 0];
	let limit = 0;
	let savePoints = [];
	let haveResults = false;
	let distance = 0;
	let halve = 0;
	let targetTable;
	let coordFormat;

	let delta;
	for (let coordElem = 0; coordElem < 3; coordElem++) {
		switch (coordElem) {
			case 0: {
				limit = options.prm.numberOfGalaxies;
				targetTable = 'savepoints-galaxies';
				coordFormat = "{0}:xxx:xx";
				break;
			}
			case 1: {
				limit = options.prm.numberOfSystems;
				targetTable = 'savepoints-systems';
				coordFormat = coords[0] + ":{0}:xx";
				break;
			}
			case 2: {
				limit = 16;
				targetTable = 'savepoints-planets';
				coordFormat = coords[0] + ":" + coords[1] + ":{0}";
				break;
			}
		}

		delta = 0;
		deltas[0] = 0;
		deltas[1] = 0;
		deltas[2] = 0;
		halve = Math.floor(limit / 2);

		while (true) {
			delta++;
			if ((options.prm.circularGalaxies || options.prm.circularSystems) && delta > halve)
				break;
			distance = 0;

			if (coords[coordElem] - delta > 0) {
				deltas[coordElem] = -delta;
				destination[0] = coords[0] + deltas[0];
				destination[1] = coords[1] + deltas[1];
				destination[2] = coords[2] + deltas[2];
				distance = getDistance(options.prm.departure, destination);
			} else if (coords[coordElem] + delta <= limit) {
				deltas[coordElem] = delta;
				destination[0] = coords[0] + deltas[0];
				destination[1] = coords[1] + deltas[1];
				destination[2] = coords[2] + deltas[2];
				distance = getDistance(options.prm.departure, destination);
			}
			// Если расстояние так и не удалось вычислить - значит, дельта слишком большая, можно завершать цикл
			if (distance === 0) {
				break;
			}
			let incr = options.prm.playerClass === 1 ? 5 : 10;
			for (let speed = 100; speed > 0; speed -= incr) {
				let flightDuration = getFlightDuration(minSpeed, distance, speed, options.prm.uniSpeed);
				let cost = getDeutConsumption(minSpeed, distance, flightDuration, i, options.prm.uniSpeed);
				// Если длительность полёта на 100% больше запрашиваемой -значит, точно забрались далеко, можно завершать цикл
				if (speed === 100 && flightDuration > duration + tolerance) {
					break;
				}
				if (flightDuration > duration - toleranceValue && flightDuration < duration + toleranceValue) {
					// нашли расстояние, удовлетворяющее условиям - запомним соответствующие точки
					if (coords[coordElem] - delta > 0) {
						savePoints.push([speed, coordFormat.format(coords[coordElem] - delta), cost, coords[0] + deltas[0], coords[1] + deltas[1], coords[2] + deltas[2]]);
					} else {
						//В случае "круговых" галактик или систем добавим точку на нужном расстоянии от конца вселенной/галактики
						if (coordElem === 0 && options.prm.circularGalaxies)
							savePoints.push([speed, coordFormat.format(limit + 1 - delta), cost, limit + 1 - delta, coords[1], coords[2]]);
						if (coordElem === 1 && options.prm.circularSystems)
							savePoints.push([speed, coordFormat.format(limit + 1 - delta), cost, coords[0], limit + 1 - delta, coords[2]]);
					}
					if (coords[coordElem] + delta <= limit) {
						savePoints.push([speed, coordFormat.format(coords[coordElem] + delta), cost, coords[0] + deltas[0], coords[1] + deltas[1], coords[2] + deltas[2]]);
					} else {
						//В случае "круговых" галактик или систем добавим точку на нужном расстоянии от начала вселенной/галактики
						if (coordElem === 0 && options.prm.circularGalaxies)
							savePoints.push([speed, coordFormat.format(delta - 1), cost, delta - 1, coords[1], coords[2]]);
						if (coordElem === 1 && options.prm.circularSystems)
							savePoints.push([speed, coordFormat.format(delta - 1), cost, coords[0], delta - 1, coords[2]]);
					}
				}
			}
		}
		if (savePoints.length > 0)
			haveResults = true;
		savePoints.sort(compareSavePoints);
		for (let spi = 0; spi < savePoints.length; spi++) {
			$('#' + targetTable).append('<tr class=' + ((spi % 2) === 1 ? 'odd' : 'even') + '><td>' + savePoints[spi][0] + '%</td><td>' +
				'<a href="#" onclick="showFlightTime([' + savePoints[spi][3] + ',' + savePoints[spi][4] + ',' + savePoints[spi][5] + '],\'' + startDT + '\',' + savePoints[spi][0] + ');">' + savePoints[spi][1] + '</a>' +
				'</td><td>' + numToOGame(savePoints[spi][2]) + '</td><tr>');
		}

		savePoints = [];
	}
	// Если ничего не нашли - надо сказать об этом, а то юзер будет в недоумении
	if (!haveResults) {
		$('#'+options.warnindMsgDivId).text(options.msgNoSavepointsFound);
		$('#'+options.warnindDivId).fadeIn(800, function () {
			setTimeout(function() {
				$('#'+options.warnindDivId).fadeOut(800);
			}, 5000);
		  });
	}
	options.save();
}

function showFlightTime(point, depTime, speed) {
	$("#tabs").tabs("select", 0);
	$('#destination-g')[0].value = point[0];
	$('#destination-s')[0].value = point[1];
	$('#destination-p')[0].value = point[2];
	options.prm.destination = point;
	updateNumbers();
	$('#start-datetime')[0].value = depTime;
	let rows = $('#flight-data tr');
	for(let i = 0; i < rows.length; i++) {
		removeFlightRow.apply(rows[i].children[2].children[0]);
	}
	let distance = getDistance(options.prm.departure, options.prm.destination);
	let minSpeed = getMinSpeed();
	let dur = getFlightDuration(minSpeed, distance, speed, options.prm.uniSpeed);
	addFlightRow(dur);
	addFlightRow(dur);
	updateArrival();
}

function showTabsHints(activeTab) {
	// С параметром функция вызывается при загрузке страницы - тогда данные берутся из куков.
	// Без параметра - перед переключением вкладок, т.е. активной станет вкладка, которая на момент вызова функции неактивна.
	if (activeTab === undefined) {
		activeTab = 0;
		try {
			let prevTab = $("#tabs ul").find(".ui-tabs-selected")[0].firstChild.id;
			activeTab = prevTab == 'tabtag2' ? 0 : 1;
		} catch (e) {};
	}
	try {
		localStorage.setItem('flight-tab-num', activeTab);
	} catch (e) {};
	$('#hint-message').text((activeTab === 0)?options.flightmodesNote:options.savepointsNote);
}

function toggleFlightMode() {
	if (options.prm.mode === 1) {
		$('#flight-title-1').text(options.departureTitle);
		$('#flight-title-2').text(options.arrivalTitle);
		options.prm.mode = 0;
	} else {
		$('#flight-title-2').text(options.departureTitle);
		$('#flight-title-1').text(options.arrivalTitle);
		options.prm.mode = 1;
	}
	options.save();
}

function toggleAllianceBonus(event) {
	let input = event.currentTarget;
	if (input.id === "trader-bonus" && input.checked) {
		$('#warrior-bonus')[0].checked = false;
	}
	if (input.id === "warrior-bonus" && input.checked) {
		$('#trader-bonus')[0].checked = false;
		options.prm.traderBonus = false;
	}
	updateNumbers();
}

function populateParams() {
	$('#cmb-drive')[0].value = options.prm.driveLevels[0];
	$('#imp-drive')[0].value = options.prm.driveLevels[1];
	$('#hyp-drive')[0].value = options.prm.driveLevels[2];
	$('#universe-speed')[0].value = options.prm.uniSpeed;
	$('#circular-galaxies')[0].checked = options.prm.circularGalaxies;
	$('#circular-systems')[0].checked = options.prm.circularSystems;
	$('#galaxies-num').val(options.prm.numberOfGalaxies);	
	$('#systems-num').val(options.prm.numberOfSystems);
	$('#deut-factor')[0].value = options.prm.deutFactor;
	$('#deut-generals-bonus')[0].value = options.prm.deutConsReduction;
	$('#departure-g')[0].value = options.prm.departure[0];
	$('#departure-s')[0].value = options.prm.departure[1];
	$('#departure-p')[0].value = options.prm.departure[2];
	$('#destination-g')[0].value = options.prm.destination[0];
	$('#destination-s')[0].value = options.prm.destination[1];
	$('#destination-p')[0].value = options.prm.destination[2];
	$('#hypertech-lvl')[0].value = options.prm.hyperTechLvl;
	for (let i = 0; i < options.shipsData.length; i++){
		$('#'+options.shipsData[i][0])[0].value = options.prm.ships[i];
	}
	$('#start-datetime')[0].value = getDateStr(options.prm.startDT, options.datetimeFormat);
	$('#save-start-datetime')[0].value = getDateStr(options.prm.saveStartDT, options.datetimeFormat);
	$('#save-return-datetime')[0].value = getDateStr(options.prm.saveReturnDT, options.datetimeFormat);
	$('#save-tolerance-time')[0].value = getTimeStr(options.prm.saveTolerance);
	$('#class-'+options.prm.playerClass).attr('checked', true);
	$('#trader-bonus')[0].checked = options.prm.traderBonus;
	$('#sp-cargohold')[0].value = localizeFloat(options.prm.spCargohold);
	$('#lf-mechan-general-enh')[0].value = options.prm.lfMechanGE;
	$('#lf-rocktal-collector-enh')[0].value = options.prm.lfRocktalCE;
	let rows = $('#lf-ships-bonuses tr');
	for (let i = 1; i <= options.prm.lfShipsBonuses.length; i++) {
		rows[i].children[1].children[0].value = localizeFloat(options.prm.lfShipsBonuses[i-1][0]); 
		rows[i].children[2].children[0].value = localizeFloat(options.prm.lfShipsBonuses[i-1][1]); 
		rows[i].children[3].children[0].value = localizeFloat(options.prm.lfShipsBonuses[i-1][2]); 
	}
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
	let shipsBackup = Array.from(options.prm.ships);
	options.load(selectedUni);
	options.prm.ships = Array.from(shipsBackup);
	populateParams();
	$('#universe-load').blur();
	updateNumbers();
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
	let key = "flight_uni_" + name;
	saveToCookie(key, options.prm);
	let uniNameSelect = $('#universe-name-select');
	uniNameSelect.append(new Option(name, key));
	uniNameSelect.val(key);
	uniNameInput.val("");
	$('#universe-add').blur();
}

function saveFleetData() {
	let selectedFleet = $('#fleet-name-select').val();
	if (selectedFleet === '0') {
		alert(options.noFleetSelectedMsg);
		return;
	}
	if (confirm(options.fleetOwrConfMsg) === false) {
		return;
	}
	saveToCookie(selectedFleet, {savedShips: options.prm.ships});
	$('#fleet-save').blur();
}

function loadFleetData() {
	let selectedFleet = $('#fleet-name-select').val();
	if (selectedFleet === '0') {
		alert(options.noFleetSelectedMsg);
		return;
	}
	if (confirm(options.fleetLoadConfMsg) === false) {
		return;
	}
	let storedData = {savedShips: [], validate: function (field, value) {return validateNumber(parseFloat(value), 0, Infinity, 0);}};
	loadFromCookie(selectedFleet, storedData);
	options.prm.ships = Array.from(storedData.savedShips);
	for (let i = 0; i < options.shipsData.length; i++){
		$('#'+options.shipsData[i][0])[0].value = options.prm.ships[i];
	}
	$('#fleet-load').blur();
	updateNumbers();
}

function deleteFleetData() {
	let selectedFleet = $('#fleet-name-select').val();
	if (selectedFleet === '0') {
		alert(options.noFleetSelectedMsg);
		return;
	}
	if (confirm(options.fleetDelConfMsg) === false) {
		return;
	}
	localStorage.removeItem(selectedFleet);
	$('#fleet-name-select option[value="' + selectedFleet + '"]').remove();
	$('#fleet-name-select').val("0");
	$('#fleet-delete').blur();
}

function addFleetData() {
	let fleetNameInput = $('#fleet-name');
	if (fleetNameInput.val().length === 0) {
		alert(options.noFleetNameMsg);
		fleetNameInput.focus();
		return;
	}
	let name = stripHTMLTags(fleetNameInput.val());
	let key = "flight_fleet_" + name;
	saveToCookie(key, {savedShips: options.prm.ships});
	let fleetNameSelect = $('#fleet-name-select');
	fleetNameSelect.append(new Option(name, key));
	fleetNameSelect.val(key);
	fleetNameInput.val("");
	$('#universe-add').blur();
}

function apiGet() {
	ajaxAPI($("#api-code").val());
}

function toggleOvrSpeed(event) {
	let input = event.currentTarget;
	if (input.checked) {
		$('#ovr-speed-t').attr('disabled', false);
		$('#ovr-speed-t').removeClass('ui-state-disabled');
		options.isSpeedOvr = true;
		options.ovrSpeed = getInputNumber($('#ovr-speed-t')[0]);
		if (options.ovrSpeed === 0) {
			options.ovrSpeed = 10000;
			$('#ovr-speed-t').val(10000);
		}
	} else {
		$('#ovr-speed-t').attr('disabled', true);
		$('#ovr-speed-t').addClass('ui-state-disabled');
		options.isSpeedOvr = false;
	}
	updateNumbers();
}

function readShipsBonuses() {
	let textareaContent = $('#lf-bonuses-txtarea').val();
	let lines = textareaContent.split('\n');
	let i = 0, j = 0;
	let scLineIdx = -1;

	while (i < lines.length) {
		if (lines[i].toLowerCase().indexOf(options.smallCargoName.toLowerCase()) >= 0) {
			scLineIdx = i;
			break;
		}
		i++;
	}
	if (scLineIdx === -1) {
		alert(options.missingSCName.replace("sc_name", options.smallCargoName));
		return false;
	}
	try {
		for (i = 0; i < 17; i++) {
			options.prm.lfShipsBonuses[j][0] = Number.parseFloat(lines[scLineIdx + i * 8 + 4].replace('%', '').replace('-', '0'));
			options.prm.lfShipsBonuses[j][1] = Number.parseFloat(lines[scLineIdx + i * 8 + 5].replace('%', '').replace('-', '0'));
			options.prm.lfShipsBonuses[j][2] = Number.parseFloat(lines[scLineIdx + i * 8 + 6].replace('%', '').replace('-', '0'));
			if (i == 9 || i == 13) i++; // пропустим лампочку и краулер
			j++;
		}
		let rows = $('#lf-ships-bonuses tr');
		for (let i = 1; i <= options.prm.lfShipsBonuses.length; i++) {
			rows[i].children[1].children[0].value = options.prm.lfShipsBonuses[i-1][0]; 
			rows[i].children[2].children[0].value = options.prm.lfShipsBonuses[i-1][1]; 
			rows[i].children[3].children[0].value = options.prm.lfShipsBonuses[i-1][2]; 
		}
	} catch (e) {
		alert(e);
		return false;
	};
	return true;
}

function ajaxAPI(code) {
		$.post(
			"/ajax.php",
			{service: "ogameAPI", code: code},
			function(data) {
				try {
					var rcode = Number.parseInt(data.substr(0, data.indexOf('\n')));
					if (rcode == 4) {
						alert(options.badSRCode);
						return;
					}
					if (rcode != 0) {
						return;
					}
					var result = jQuery.parseJSON(data.substr(data.indexOf('\n') + 1));
					if (result["RESULT_CODE"] == 1000) {
						$("#api-code").val(code);
						//Скорость вселенной
						$("#universe-speed option[value='" + result.RESULT_DATA.universes.speedFleetWar + "']").attr('selected', 'selected');

						//Координаты дефа
						let defCore = result.RESULT_DATA.generic.defender_planet_coordinates.split(":");
						$("#departure-g").val(defCore[0]);
						$("#departure-s").val(defCore[1]);
						$("#departure-p").val(defCore[2]);

						//Класс дефа
						let defClass = false;
						switch (result.RESULT_DATA.generic.defender_character_class_id) {
						  case 1: defClass = "class-0"; break;
						  case 2: defClass = "class-1"; break;
						  case 3: defClass = "class-2"; break;
						  default: defClass = false; 
						}
						if (defClass)						
							$("#" + defClass).attr('checked', true);

						//Класс альянса
						if (result.RESULT_DATA.generic.defender_alliance_class_id == 2)
							$("#trader-bonus").attr('checked', true);

						//Циклическая вселенная
						if (result.RESULT_DATA.universes.donutGalaxy == 1)
							$("#circular-systems").attr('checked', true);
						if (result.RESULT_DATA.universes.donutSystem == 1)
							$("#circular-galaxies").attr('checked', true);

						//Кол-во систем/галактик
						$("#systems-num").val(result.RESULT_DATA.universes.systems);
						$("#galaxies-num").val(result.RESULT_DATA.universes.galaxies);

						//Грузоподъёмность Шпионских зондов 
						$("#sp-cargohold").val(result.RESULT_DATA.universes.probeCargo);

						//Потребление дейтерия
						$("#deut-factor option[value='" + result.RESULT_DATA.universes.globalDeuteriumSaveFactor * 10 + "']").attr('selected', 'selected');

						//Техи
						$.each(result.RESULT_DATA.details.research, function (i, v) {
							if (v.research_type == 115) $("#cmb-drive").val(v.level);			
							if (v.research_type == 117) $("#imp-drive").val(v.level);			
							if (v.research_type == 118) $("#hyp-drive").val(v.level);

							if (v.research_type == 114) $("#hypertech-lvl").val(v.level);			
						});

						//Уровень технологии ФЖ
						$.each(result.RESULT_DATA.details.lifeformBonusesNew.dynamic.lifeforms, function (i, v) {
							if (v.id == 2) $("#lf-rocktal-collector-enh").val(v.level);
							if (v.id == 3) $("#lf-mechan-general-enh").val(v.level);
						});

						//Бонусы фж флота
						$.each(result.RESULT_DATA.details["combatInformation"]["ships"], function (i, v) {
							if (v["speed"]) $("." + i + "-speed").val((v["speed"] * 100).toString().replace(".", options.decimalSeparator).substr(0, 6));
								else $("." + i + "-speed").val(0);
							if (v["cargo"]) $("." + i + "-cargo").val((v["cargo"] * 100).toString().replace(".", options.decimalSeparator).substr(0, 6));
								else $("." + i + "-cargo").val(0);
							if (v["fuel"]) $("." + i + "-fuel").val((v["fuel"] * 100).toString().replace(".", options.decimalSeparator).substr(0, 6));
								else $("." + i + "-fuel").val(0);
						});

						updateNumbers();
					}
				} catch(e) {
					consoleLog('exception: '+e);
				}
			}
		);
}

jQuery(function($) {
	const urlParams = new URLSearchParams(window.location.search);
	if (urlParams.has("SR_KEY"))
		ajaxAPI(urlParams.get("SR_KEY"));

	options.load('options_flight');
	$( "#params-accordion" ).accordion({
		autoHeight: false,
		collapsible: true,
		active: 1
	});	
	$( "#lf-bonuses-accordion" ).accordion({
		autoHeight: false,
		collapsible: true,
		active: 1
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

	$('#fleet-control').buttonset();
	$('#fleet-load').button( { icons: {primary:'ui-icon-arrowthickstop-1-n'} } );
	$('#fleet-load').click(loadFleetData);
	$('#fleet-save').button( { icons: {primary:'ui-icon-arrowthickstop-1-s'} } );
	$('#fleet-save').click(saveFleetData);
	$('#fleet-delete').button( { icons: {primary:'ui-icon-close'} } );
	$('#fleet-delete').click(deleteFleetData);
	$('#fleet-add').button( { icons: {primary:'ui-icon-plus'} } );
	$('#fleet-add').click(addFleetData);

	$('#api-get').button( { icons: {primary:'ui-icon-arrowthickstop-1-s'} } );
	$('#api-get').click(apiGet);

	$( "#lf-bonuses-reader" ).dialog({
		autoOpen: false,
		height: 300,
		width: 400,
		modal: true,
		resizable: false,
		buttons: {
			rd: function() {
				$(this).dialog("option", "execute", true);
				if (readShipsBonuses())
					$(this).dialog("close");
			},
			ccl: function() {
				$(this).dialog("option", "execute", false);
				$(this).dialog( "close" );
			}
		},
		close: function() {
			if (!$(this).dialog("option", "execute")) {
			}
		}
	});
	let dialog = $('div[aria-labelledby="ui-dialog-title-lf-bonuses-reader"]');
	let buttons = dialog.find('div.ui-dialog-buttonset');
	buttons[0].children[0].children[0].innerHTML = options.readTitle;
	buttons[0].children[1].children[0].innerHTML = options.cancelTitle;

	populateParams();

	options.isSpeedOvr = false;
	options.ovrSpeed = 10000;
	$('#ovr-speed-t').attr('disabled', true);
	$('#ovr-speed-t').addClass('ui-state-disabled');
	$('#ovr-speed-t').data('constrains', {'min': 1, 'def': 10000, 'max': 1000000000});
	$('#ovr-speed-cb').click(toggleOvrSpeed);

	let flightData = options.prm.flightData.slice();
	
	// для удобства перевернём значение и вызовем функцию, которая его ещё раз перевернёт
	options.prm.mode = options.prm.mode === 0 ? 1 : 0;
	toggleFlightMode();
	
	// на всякий случай удалим все строки в калькуляторе, и создадим их заново с полученными значениями
	let rows = $('#flight-data tr');
	let i = 0;
	for(i = 0; i < rows.length; i++) {
		removeFlightRow.apply(rows[i].children[2].children[0]);
	}
	
	for (i = 0; i < flightData.length; i++)
		addFlightRow(flightData[i]);
	updateArrival();
	
	let tabNum = 0
	try {
		tabNum = localStorage.getItem('flight-tab-num');
	} catch (e) {};
	$( "#tabs" ).tabs({ selected: tabNum });
	showTabsHints(tabNum);

	$('input').focusin(function() {
		$(this).addClass('ui-state-focus');
	});
	$('input').focusout(function() {
		$(this).removeClass('ui-state-focus');
	});

	$('#lf-bonuses-accordion input:text').data('constrains', {'min': 0, 'max': Infinity, 'def': 0, 'allowFloat': true, 'allowNegative': false});
	$('#lf-deut-cons').data('constrains', {'min': 0, 'max': 30, 'def': 0, 'allowFloat': true, 'allowNegative': false});
	$('#lf-mechan-general-enh').data('constrains', {'min': 0, 'max': Infinity, 'def': 0, 'allowFloat': true, 'allowNegative': false});
	$('#lf-rocktal-collector-enh').data('constrains', {'min': 0, 'max': Infinity, 'def': 0, 'allowFloat': true, 'allowNegative': false});
	// $('#universe-name').data('constrains', {});

	$('#class-0').click(updateNumbers);
	$('#class-1').click(updateNumbers);
	$('#class-2').click(updateNumbers);
	$('#flight input:text').not('#universe-name').not('#fleet-name').not('#api-code').keyup('updateNumbers', validateInputNumber);
	$('#flight input:text').not('#universe-name').not('#fleet-name').not('#api-code').blur('updateNumbers', validateInputNumberOnBlur);
	$('#flight select').keyup(updateNumbers);
	$('#flight select').change(updateNumbers);
	$('#flight select').mousemove(updateNumbers);
	$('#circular-systems').click(updateNumbers);
	$('#circular-galaxies').click(updateNumbers);
	$('#reset').click(resetParams);
	$('#set-departure-now').click(setDepartureNow);
	$('#set-departure-zero').click(setDepartureZero);
	$('#add-flight-time').click(addFlightRow);
	$('#warrior-bonus').click(toggleAllianceBonus);
	$('#trader-bonus').click(toggleAllianceBonus);

	$('#start-datetime').unbind();
	$('#start-datetime').keyup(updateArrival);
	$('div.button-taketocalc').click(takeToCalc);

	$('input.flight-time-input').unbind();
	$('input.flight-time-input').inputmask(options.flightTimeFormat);
	$('input.flight-time-input').keyup(updateArrival);
	$('#toggle-mode').click(toggleFlightMode);
	$('div.button-toggle').unbind();
	$('div.button-toggle').click(toggleFlightTimeSign);
	$('div.button-remove').unbind();
	$('div.button-remove').click(removeFlightRow);

	$('#set-save-departure-now').click(setSaveDepartureNow);

	$('#save-start-datetime').unbind();
	$('#save-start-datetime').keyup(validateSPParams);
	$('#save-return-datetime').unbind();
	$('#save-return-datetime').keyup(validateSPParams);
	$('#save-tolerance-time').unbind();
	$('#save-tolerance-time').keyup(validateSPParams);
	$('#save-tolerance-time').blur(validateSPParams);

	$('#calculate-savepoints').click(updateSavePoints);
	$('#open-lfbr').click(function() {
		$("#lf-bonuses-reader").dialog("option", "execute", false);
		$("#lf-bonuses-reader").dialog("open");
	});

 	$("#tabs").bind("tabsselect", function(event, ui) {
		showTabsHints();
	});

	$('#general-settings input:radio').change(function(ev) { updateNumbers(); });

	// Настраиваем ограничения на поля ввода координат
	$('#departure-g').data('constrains', {'min': 1, 'def': 0, 'max': 12});
	$('#destination-g').data('constrains', {'min': 1, 'def': 0, 'max': 12});
	$('#departure-s').data('constrains', {'min': 1, 'def': 0, 'max': 550});
	$('#destination-s').data('constrains', {'min': 1, 'def': 0, 'max': 550});
	$('#departure-p').data('constrains', {'min': 1, 'def': 0, 'max': 16});
	$('#destination-p').data('constrains', {'min': 1, 'def': 0, 'max': 16});

	let keys = [];
	for(let i = 0, len = localStorage.length; i < len; i++) {
		let key = localStorage.key(i);
		if (key.includes("flight_uni_")) {
			keys.push(key);
		}
	}
	keys.sort();
	for (let i = 0; i < keys.length; i++) {
		let key = keys[i];
		$('#universe-name-select').append(new Option(key.replace("flight_uni_", ""), key));
	}
	keys = [];
	for(let i = 0, len = localStorage.length; i < len; i++) {
		let key = localStorage.key(i);
		if (key.includes("flight_fleet_")) {
			keys.push(key);
		}
	}
	keys.sort();
	for (let i = 0; i < keys.length; i++) {
		let key = keys[i];
		$('#fleet-name-select').append(new Option(key.replace("flight_fleet_", ""), key));
	}

	let theme = { value: 'light', validate: function(key, val) { return val; } };
	loadFromCookie('theme', theme);
	toggleLight(theme.value === 'light');
	$('#cb-light-theme').click(function(){toggleLight($('#cb-light-theme')[0].checked);});
	
	updateNumbers();
});
