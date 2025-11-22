// Заглушка для вызова функции без учёта наличия всех 5 офицеров и класса игрока
function getProductionRate(techID, techLevel, energyTechLevel, plasmaTechLevel, maxTemp, pos, universeSpeedFactor, geologist, engineer, productionFactor, powerFactor, boosterType) {
	return getProductionRate(techID, techLevel, energyTechLevel, plasmaTechLevel, maxTemp, pos, universeSpeedFactor, geologist, engineer, productionFactor, powerFactor, boosterType, false, 1, false); // По умолчанию класс Генерал, чтобы не было бонуса
}

/**
 * Вычисляет скорость производства ресурсов (ед/час) и энергии.
 * @param techID ID постройки - рудника/синтезатора, электростанции или солн.спутника.
 * @param techLevel уровень постройки или кол-во спутников
 * @param energyTechLevel уровень энерг. технологии
 * @param plasmaTechLevel уровень плазменной технологии
 * @param maxTemp макс. температура на планете
 * @param pos номер позиции планеты
 * @param universeSpeedFactor множитель скорости вселенной
 * @param geologist флаг наличия Геолога
 * @param engineer флаг наличия Инженера
 * @param productionFactor коэффициент производства (0..1, меньше 1, если энергии не хватает)
 * @param powerFactor процент мощности (0..1, устанавливается пользователем)
 * @param boosterType тип ускорителя: 0-отсутствует, 1-бронза (10%), 2-серебро (20%), 3-золото (30%)
 * @param allOfficers флаг наличия всех 5 офицеров  
 * @param playerClass класс игрока: 0-Коллекционер, 1-Генерал, 2-Исследователь
 * @param isTrader принадлежит ли игрок а альянсу с классом "Скупщики"
 * @returns Кол-во производимых ресурсов или энергии
 */
function getProductionRate(techID, techLevel, energyTechLevel, plasmaTechLevel, maxTemp, pos, universeSpeedFactor, geologist, engineer, productionFactor, powerFactor, boosterType, allOfficers, playerClass, isTrader) {
	let prod;
	switch (techID*1) {
		case 1:
		case 2:
		case 3:
			prod = getProductionRateSplit(techID, techLevel, energyTechLevel, plasmaTechLevel, maxTemp, pos, universeSpeedFactor, geologist, engineer, productionFactor, powerFactor, boosterType, allOfficers, playerClass, isTrader);
			return(prod[0] + prod[1] + prod[2] + prod[3] + prod[4] + prod[5] + prod[6] + prod[7]);
		case 4:
		case 12:
		case 212:
			prod = getProductionRateSplit(techID, techLevel, energyTechLevel, plasmaTechLevel, maxTemp, pos, universeSpeedFactor, geologist, engineer, productionFactor, powerFactor, boosterType, allOfficers, playerClass, isTrader);
			return(prod[1]); // powerFactor учтётся, а бонусы инженера, командного состава и класса нужно накладывать на сумму оставшейся энергии
		default: {
			return(0);
		}
	}
}

/**
 * Вычисляет скорость производства ресурсов (ед/час) и энергии. При обсчёте рудников металла и кристалла нулевой строкой отдаст естественное производство
 * @param techID ID постройки - рудника/синтезатора, электростанции или солн.спутника.
 * @param techLevel уровень постройки или кол-во спутников
 * @param energyTechLevel уровень энерг. технологии
 * @param plasmaTechLevel уровень плазменной технологии
 * @param maxTemp макс. температура на планете
 * @param pos позиция планеты в солнечной системе
 * @param universeSpeedFactor множитель скорости вселенной
 * @param geologist флаг наличия Геолога
 * @param engineer флаг наличия Инженера
 * @param productionFactor коэффициент производства (0..1, меньше 1, если энергии не хватает)
 * @param powerFactor процент мощности (0..1, устанавливается пользователем)
 * @param boosterType тип ускорителя: 0-отсутствует, 1-бронза (10%), 2-серебро (20%), 3-золото (30%)
 * @param allOfficers флаг наличия всех 5 офицеров  
 * @param playerClass класс игрока: 0-Коллекционер, 1-Генерал, 2-Исследователь
 * @param isTrader принадлежит ли игрок а альянсу с классом "Скупщики"
 * @returns Кол-во производимых ресурсов или энергии
 */
function getProductionRateSplit(techID, techLevel, energyTechLevel, plasmaTechLevel, maxTemp, pos, universeSpeedFactor, geologist, engineer, productionFactor, powerFactor, boosterType, allOfficers, playerClass, isTrader) {
	// Инженер и геолог увеличивают производство на 10%. Если есть все 5 офицеров, к производству ресурсов и энергии добавляется ещё 2%.
	var geologistFactor = geologist === true ? 0.1 : 0;
	var allStaffFactor = allOfficers === true ? 0.02 : 0;
	var engineerFactor = (engineer === true) ? 0.1 : 0;
	var boostFactor = boosterType * 0.1;
	var classFactor = playerClass === 0 ? 0.25 : 0;
	let allianceClassFactor = isTrader ? 0.05 : 0;
	var positionFactor = 1;
	var basePR;
	var rows = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // нат., шахта, геолог, все офицеры, плазма, ускоритель, класс, класс альянса
	switch (techID*1) {
		case 1:
			switch (pos*1) {
				case 6: case 10: positionFactor = 1.17; break;
				case 7: case 9: positionFactor = 1.23; break;
				case 8: positionFactor = 1.35; break;
				default: positionFactor = 1; 
			}
			rows[0] = Math.floor(30 * universeSpeedFactor * positionFactor);
			basePR = 30.0 * techLevel * Math.pow(1.1, techLevel) * productionFactor * powerFactor * positionFactor;
			rows[1] = Math.floor(basePR * universeSpeedFactor);
			rows[2] = Math.round(basePR * 0.01 * plasmaTechLevel * universeSpeedFactor);
			rows[3] = Math.round(basePR * boostFactor * universeSpeedFactor);
			rows[4] = Math.round(basePR * geologistFactor * universeSpeedFactor);
			rows[5] = 0; // тут в таблице Инженер
			rows[6] = Math.round(basePR * allStaffFactor * universeSpeedFactor);
			rows[7] = Math.round(basePR * classFactor * universeSpeedFactor);
			rows[8] = Math.round(basePR * allianceClassFactor * universeSpeedFactor);
			break;
		case 2:
			switch (pos*1) {
				case 1: positionFactor = 1.4; break;
				case 2: positionFactor = 1.296; break;
				case 3: positionFactor = 1.2; break;
				default: positionFactor = 1; 
			}
			rows[0] = Math.floor(15 * universeSpeedFactor * positionFactor);
			basePR = 20.0 * techLevel * Math.pow(1.1, techLevel) * productionFactor * powerFactor * positionFactor;
			rows[1] = Math.floor(basePR * universeSpeedFactor);
			rows[2] = Math.round(basePR * 0.0066 * plasmaTechLevel * universeSpeedFactor);
			rows[3] = Math.round(basePR * boostFactor * universeSpeedFactor);
			rows[4] = Math.round(basePR * geologistFactor * universeSpeedFactor);
			rows[5] = 0; 
			rows[6] = Math.round(basePR * allStaffFactor * universeSpeedFactor);
			rows[7] = Math.round(basePR * classFactor * universeSpeedFactor);
			rows[8] = Math.round(basePR * allianceClassFactor * universeSpeedFactor);
			break;
		case 3:			
			rows[0] = 0;
			basePR = 10.0 * techLevel * Math.pow(1.1, techLevel) * (1.44 - 0.004 * maxTemp) * productionFactor * powerFactor;
			rows[1] = Math.floor(basePR * universeSpeedFactor);
			rows[2] = Math.round(basePR * 0.0033 * plasmaTechLevel * universeSpeedFactor);
			rows[3] = Math.round(basePR * boostFactor * universeSpeedFactor);
			rows[4] = Math.round(basePR * geologistFactor * universeSpeedFactor);
			rows[5] = 0; 
			rows[6] = Math.round(basePR * allStaffFactor * universeSpeedFactor);
			rows[7] = Math.round(basePR * classFactor * universeSpeedFactor);
			rows[8] = Math.round(basePR * allianceClassFactor * universeSpeedFactor);
			break;
		case 4:
			//productionRate = Math.floor(20.0 * techLevel * Math.pow(1.1, techLevel) * engineerFactor * powerFactor);
			basePR = Math.floor(20.0 * techLevel * Math.pow(1.1, techLevel) * powerFactor);
			rows[1] = Math.floor(basePR);
			break;
		case 12:
			//productionRate = Math.floor(30.0 * techLevel * Math.pow((1.05 + energyTechLevel * 0.01), techLevel) * engineerFactor * powerFactor);
			basePR = Math.floor(30.0 * techLevel * Math.pow((1.05 + energyTechLevel * 0.01), techLevel) * powerFactor);
			rows[1] = Math.floor(basePR);
			break;
		case 212:
			//productionRate = techLevel * Math.floor((maxTemp + 140) / 6) * engineerFactor * powerFactor;
			basePR = techLevel * Math.floor((maxTemp + 140) / 6) * powerFactor;
			// Если в калькуляторе ввести температуру планеты меньше -140, он будет показывать, что солнечные спутники производят отрицательное кол-во энергии. Нехорошо это.
			if (basePR < 0) {
				basePR = 0;
			}
			rows[1] = Math.floor(basePR);
	}
	return rows;
}

/**
 * Вычисляет потребление энергиии рудниками и дейтерия термоядерной электростанцией
 * @param techID ID рудника или электростанции
 * @param techLevel уровень постройки
 * @param universeSpeedFactor множитель скорости вселенной 
 * @param powerFactor процент мощности (0..1, устанавливается пользователем)
 * @returns Кол-во потребляемых постройкой единиц энергии/дейтерия
 */
function getHourlyConsumption(techID, techLevel, universeSpeedFactor, powerFactor) {
	if (techLevel < 1)
		return 0;
	var consump;
	switch (techID*1) {
		case 1: // рудник металла. потребляет энергию
		case 2: // рудник кристалла. потребляет энергию
			consump = Math.floor(10.0 * techLevel * Math.pow(1.1, techLevel) * powerFactor);
			break;
		case 12: // термоядерная электростанция. потребляет дейтерий
			consump = Math.floor(Math.floor(10.0 * techLevel * Math.pow(1.1, techLevel) * universeSpeedFactor) * powerFactor);
			break;
		case 3: // синтезатор дейтерия. потребляет энергию
			consump = Math.floor(20.0 * techLevel * Math.pow(1.1, techLevel) * powerFactor);
			break;
		default:
			return 0;
	}
	return consump;
}

/**
 * Вычисляет ёмкость хранилища ресурсов
 * @param techLevel уровень постройки
 * @returns Кол-во ресурсов, которое может хранить постройка
 */
function getStorageCapacity(level) {
	if (level < 0)
		return 0;
	if (level == 0)
		return 10000;
	return 5000 * Math.floor(2.5 * Math.exp(20.0 * level/33.0));
}

/**
 * Вычисляет кол-во энергии, требуемое для изучения/постройки
 * @param techID ID постройки или исследования
 * @param techLevel уровень постройки/исследования
 * @param techData массив данных о технологиях формата {id:[cost_met, cost_crys, cost_deut, grow_koeff]}
 * @returns Требуемая энергия
 */
function getBuildEnergyCost_C(techID, techLevel, techData) {
	// Технологии "Терраформер", "Космический док" и "Гравитационная технология" - особенные. Они требуют энергии для изучения/постройки.
	if (techLevel < 1)
		return 0;
	var data = techData[techID];
	if (data === undefined)
		return [0, 0, 0];
	var buildCost = 0;
	switch (techID*1) {
		case 33:
			buildCost = 1000 * Math.pow(data[3], techLevel - 1);
			break;
		case 36:
			// Цена космического дока в металле и кристалле растёт не так, как требования к энергии
			buildCost = Math.floor(50 * Math.pow(data[3]/2, techLevel - 1)); 
			break;
		case 199:
			buildCost = 300000 * Math.pow(data[3], techLevel - 1);
			break;
		default:
			buildCost = 0;
	}
	return buildCost;
}

/**
 * Вычисляет стоимость сноса постройки
 * @param techID ID постройки
 * @param techLevel Результирующий уровень постройки
 * @param techData массив данных о технологиях формата {id:[cost_met, cost_crys, cost_deut, grow_koeff]}
 * @returns Стоимость сноса постройки
 */
function calcDeconstrCost(techID, techLevel, techData, ionTechLevel) {
	var cost = [0, 0, 0];
	if (techLevel < 0) {
		return cost;
	}
	// Сносить можно только здания; терраформер и лунную базу снести нельзя
	if (techID > 100 || techID == 33 || techID == 41) {
		return cost;
	}
	// https://github.com/jstar88/Ogame-algorithms/blob/master/Cost.php
	// http://calc.antigame.de/

	var data = techData[techID];
	for (var i = 0; i < 3; i++)
		cost[i] = Math.floor(Math.floor(data[i] * Math.pow(data[3], techLevel - 1)) * (1 - 0.04 * ionTechLevel));
	return cost;
}

/**
 * Вычисляет стоимость изучения/постройки
 * @param techID ID постройки или исследования
 * @param techLevel уровень постройки/исследования
 * @param techData массив данных о технологиях формата {id:[cost_met, cost_crys, cost_deut, grow_koeff]}
 * @returns Стоимость постройки/изучения указанного уровня технологии
 */
function calcBuildCost_C(techID, techLevel, techData) {
	if (techLevel < 1)
		return [0, 0, 0];
	var data = techData[techID];
	if (data === undefined)
		return [0, 0, 0];
	var cost = [0, 0, 0];
	var price = 0;
	// В редизайне астрофизика дорожает с коэффициентом 1.75, и стоимость округляется до сотен
	if (techID == 124) {
		for (var i = 0; i < 3; i++) {
			price = data[i] * Math.pow(1.75, (techLevel - 1));
			cost[i] = 100 * Math.round(0.01 * price);
		}
	} else {
		for (var i = 0; i < 3; i++)
			cost[i] = Math.floor(data[i] * Math.pow(data[3], (techLevel - 1)));
	}
	return cost;
}

/**
 * Вычисляет стоимость изучения/постройки нескольких уровней техи
 * @param techID ID постройки или исследования
 * @param techLevelFrom стартовый уровень постройки/исследования (не включается в расчёт)
 * @param techLevelTo конечный уровень постройки/исследования
 * @param techData массив данных о технологиях формата {id:[cost_met, cost_crys, cost_deut, grow_koeff]}
 * @param ionTechLevel уровень ионной технологии
 * @returns Общая стоимость апгрейда постройки/исследования 
 */
function getBuildCost_C(techID, techLevelFrom, techLevelTo, techData, ionTechLevel) {
	let cost;
	let i;
	if (typeof ionTechLevel == "undefined" )
		ionTechLevel = 0;
	let totalCost = [0, 0, 0];
	// После techID==200 идут корабли и оборона, у них прироста стоимости от количества нет - их будем считать не так, как постройки
	if (techID < 200) {
		// Если целевой уровень меньше исходного, посчитаем стоимость сноса. Функция вернёт 0 там, где снос невозможен (исследования, терраформер, лунная база).
		if (1*techLevelFrom > techLevelTo) {
			for (i = 1*techLevelFrom - 1; i >= techLevelTo; i--) {
				cost = calcDeconstrCost(techID, i, techData, ionTechLevel);
				totalCost[0] += cost[0];
				totalCost[1] += cost[1];
				totalCost[2] += cost[2];
			}
		} else {
			// Получим стоимость строительства всех уровней техи от стартового до конечного и просто сложим результаты
			for (i = 1*techLevelFrom + 1; i <= techLevelTo; i++) {
				cost = calcBuildCost_C(techID, i, techData);
				totalCost[0] += cost[0];
				totalCost[1] += cost[1];
				totalCost[2] += cost[2];
			}
		}
	} else {
		// Получим стоимость строительства одной единицы и умножим на количество
		cost = calcBuildCost_C(techID, 1, techData);
		totalCost[0] = techLevelTo * cost[0];
		totalCost[1] = techLevelTo * cost[1];
		totalCost[2] = techLevelTo * cost[2];
	}
	return totalCost;
}

/**
 * Вычисляет длительность изучения/постройки нескольких уровней или нескольких кораблей
 * @param techID ID Постройки или исследования
 * @param techLevelFrom Стартовый уровень постройки/исследования (не включается в расчёт)
 * @param techLevelTo Конечный уровень постройки/исследования
 * @param techData Массив данных о технологиях формата {id:[cost_met, cost_crys, cost_deut, grow_koeff]}
 * @param robotsLevel Уровень Фабрики роботов
 * @param nanitesLevel Уровень Фабрики нанитов
 * @param researchLabLevel Уровень исследовательской лаборатории
 * @param technocratFactor Множитель технократа - 1, если отутствует
 * @param shipyardLevel Уровень Верфи
 * @param uniSpeed Скорость вселенной
 * @param techReqs Требования для исследований в формате {id: req_level}
 * @returns Общая длительность апгрейда постройки/исследования, строительства кораблей 
 */
function getBuildTime_C(techID, techLevelFrom, techLevelTo, techData, robotsLevel, nanitesLevel, researchLabLevel, technocratFactor, shipyardLevel, uniSpeed, techReqs) {
	if (techLevelFrom < 0)
		return 0;
	var data = techData[techID];
	if (data === undefined)
		return 0;
	if (techLevelFrom >= techLevelTo && techID > 100)
		return 0;
	var timeSpan = 0;
	var reduction = 1;
	// Узнаем стоимость постройки - она участвует в формулах расчёта времени строительства
	var cost = [0, 0, 0];
	// Техи с ID до 100 - это здания. Скорость их строительства зависит от наличия и уровня фабрик роботов и нанитов
	if (techID <= 100) {
		if (techLevelFrom < techLevelTo) {
			var curr = 1*techLevelFrom;
			for (var next = 1*techLevelFrom + 1; next <= techLevelTo; next++) {
				cost = getBuildCost_C(techID, curr, next, techData);
				// Время постройки всех зданий, кроме Фабрики нанитов, Лунной базы, Фаланги и Ворот, снижается (вплоть до 8го уровня)
				reduction = 1;
				if (techID != 15 && techID != 41 && techID != 42 && techID != 43) 
					reduction = Math.max(4 - next / 2.0, 1);
				// Формула ОГейма даёт время в часах - переведём в секунды
				timeSpan += Math.floor(3600 * (cost[0] + cost[1]) / (2500.0 * reduction * (robotsLevel + 1.0) * Math.pow(2.0, nanitesLevel)));
				curr = next;
			}
		} else {
			// Терраформер и лунную базу сносить нельзя
			if (techID == 33 || techID == 41)
				return 0;
			var curr = 1*techLevelFrom;
			for (var next = 1*techLevelFrom - 1; next >= techLevelTo; next--) {
				cost = getBuildCost_C(techID, curr, next, techData);
				reduction = 1;
				if (techID != 15 && techID != 41 && techID != 42 && techID != 43) 
					reduction = Math.max(4 - next / 2.0, 1);
				// Формула ОГейма даёт время в часах - переведём в секунды
				timeSpan += Math.ceil(3600 * (cost[0] + cost[1]) / (2500.0 * reduction * (robotsLevel + 1.0) * Math.pow(2.0, nanitesLevel)));
				curr = next;
			}
		}
	}

	// Техи с ID от 100 до 200 - это технологии. Скорость их исследования зависит от уровня исследовательской лаборатории и наличия технократа
	if (100 < techID && techID <= 200) {
		if (researchLabLevel < techReqs[techID])
			return -1;
		cost = getBuildCost_C(techID, techLevelFrom, techLevelTo, techData);
		// Формула ОГейма даёт время в часах - переведём в секунды
		timeSpan = 3600 * (cost[0] + cost[1]) / (1000 * (1.0 + researchLabLevel));
		// Если есть технократ, время на исследование нужно умножить на его поправочный коэффициент
		timeSpan *= technocratFactor;
	}

	// Техи с ID больше 200 - это корабли и оборона. Скорость их строительства зависит от наличия и уровня верфи и фабрики нанитов
	if (techID > 200) {
		// Для кораблей и обороны нельзя считать время, исходя из полного кол-ва ресурсов - нужно считать по одному.
		cost = calcBuildCost_C(techID, 1,  techData);
		//((metal + crystal) / 5'000) * (2 / ((level shipyard) + 1)) * (0.5 ^ (level nanite factory))
		// Формула ОГейма даёт время в часах - переведём в секунды, округлим и умножим на кол-во единиц, которые нужно построить
		timeSpan = 3600 * (cost[0] + cost[1]) / 5000.0 * 2.0 / (shipyardLevel + 1.0) * Math.pow(0.5, nanitesLevel);
		// При слишком высоких уровнях нанитки скорость постройки СС может стать 0 - надо это учесть
		if (timeSpan == 0) {
			timeSpan = 1;
		}
	}
	// Если расчёт заказан для ускоренной вселенной, разделим вычисленное время на поправочный коэффициент
	if (uniSpeed > 1) {
		timeSpan /= uniSpeed;
	}
	if (timeSpan < 1) {
		timeSpan = 1;
	}
	if (techID > 200) {
		timeSpan = techLevelTo*Math.floor(timeSpan);
	}

	return timeSpan;
}

/**
 * Вычисляет стоимость одного ускорения постройки/исследования за ТМ
 * @param techID ID Постройки, корабля или исследования
 * @param timeSpan Изначальные затраты времени на строительство/исследование
 * @returns Сумма необходимой ТМ
 */
function getHalvingCost(techID, timeSpan) {
	if (Number(timeSpan) === 0)
		return 0;
	let tmCost = 750;
	if (techID < 200 && timeSpan > 1800) {
		let halves = Math.ceil(Math.ceil(timeSpan/60)/30);
		tmCost = 750 * halves;
		if (techID < 100 && tmCost > 72000)
			tmCost = 72000;
		if (techID > 100 && techID < 200 && tmCost > 108000)
			tmCost = 108000;
		return tmCost;
	}
	if (techID > 200 && timeSpan > 1800) {
		let halves = 0.1 * Math.ceil(Math.floor(timeSpan/60)/3);
		tmCost = Math.floor(750 * halves);
		if (tmCost > 72000)
			tmCost = 72000;
		return tmCost;
	}
	return tmCost;
}

/**
 * Вычисляет стоимость сноса постройки для Форм Жизни
 * @param techID ID постройки
 * @param techLevel Результирующий уровень постройки
 * @param techData массив данных о технологиях формата {id:[cost_met, cost_crys, cost_deut, cost_energy, grow_koeff]}
 * @returns Стоимость сноса постройки
 */
function calcDeconstrCostLF(techID, techLevel, techData, ionTechLevel) {
	var cost = [0, 0, 0];
	if (techLevel < 0) {
		return cost;
	}
	// Сносить можно только здания
	if (Number(techID) % 1000 > 100) {
		return cost;
	}
	var data = techData[techID];
	for (var i = 0; i < 3; i++)
		cost[i] = Math.floor(Math.floor(data[i] * techLevel * Math.pow(data[5 + i], techLevel - 1)) * (1 - 0.04 * ionTechLevel));
	return cost;
}

/**
 * Вычисляет стоимость изучения/постройки для Форм Жизни
 * @param techID ID постройки или исследования
 * @param techLevel уровень постройки/исследования
 * @param techData массив данных о технологиях формата {id:[cost_met, cost_crys, cost_deut, cost_energy, grow_koeff]}
 * @param costRdc бонус, снижающий стоимость  (в %)
 * @returns Стоимость постройки/изучения указанного уровня технологии
 */
function calcBuildCostLF(techID, techLevel, techData, costRdc) {
	if (techLevel < 1)
		return [0, 0, 0];
	var data = techData[techID];
	if (data === undefined)
		return [0, 0, 0];
	var cost = [0, 0, 0];
	costRdc = Math.min(0.99, costRdc);
	for (var i = 0; i < 3; i++)
		cost[i] = Math.floor((1 - costRdc) * Math.floor(data[i] * techLevel * Math.pow(data[5 + i], (techLevel - 1))));
	return cost;
}

/**
 * Вычисляет стоимость изучения/постройки нескольких уровней техи для Форм Жизни
 * @param techID ID постройки или исследования
 * @param techLevelFrom стартовый уровень постройки/исследования (не включается в расчёт)
 * @param techLevelTo конечный уровень постройки/исследования
 * @param techData массив данных о технологиях формата {id:[cost_met, cost_crys, cost_deut, cost_energy, grow_koeff]}
 * @param ionTechLevel уровень ионной технологии
 * @param rsrCostRdc бонус, снижающий стоимость исследований (в %)
 * @param bldCostRdc бонус от зданий
 * @returns Общая стоимость апгрейда постройки/исследования 
 */
function getBuildCostLF(techID, techLevelFrom, techLevelTo, techData, ionTechLevel, rsrCostRdc, bldCostRdc=0) {
	let cost;
	let i;
	if (typeof ionTechLevel == "undefined" )
		ionTechLevel = 0;
	let totalCost = [0, 0, 0];
	// Мегалит снижает стоимость только зданий
	const costReduction = Number(techID) % 1000 < 100 ? bldCostRdc : 0.01 * rsrCostRdc;
	// Если целевой уровень меньше исходного, посчитаем стоимость сноса. Функция вернёт 0 там, где снос невозможен (исследования, терраформер, лунная база).
	if (Number(techLevelFrom) > Number(techLevelTo)) {
		for (i = Number(techLevelFrom) - 1; i >= Math.max(Number(techLevelTo), 0); i--) {
			if (i == 0) {
				cost = calcDeconstrCostLF(techID, 1, techData, ionTechLevel);
			} else {
				cost = calcDeconstrCostLF(techID, i, techData, ionTechLevel);
			}
			totalCost[0] += cost[0];
			totalCost[1] += cost[1];
			totalCost[2] += cost[2];
		}
	} else {
		// Получим стоимость строительства всех уровней техи от стартового до конечного и просто сложим результаты
		for (i = Number(techLevelFrom) + 1; i <= Number(techLevelTo); i++) {
			cost = calcBuildCostLF(techID, i, techData, costReduction);
			totalCost[0] += cost[0];
			totalCost[1] += cost[1];
			totalCost[2] += cost[2];
		}
	}
	return totalCost;
}

/**
 * Вычисляет длительность изучения/постройки нескольких уровней для Форм Жизни
 * @param techID ID Постройки или исследования
 * @param techLevelFrom Стартовый уровень постройки/исследования (не включается в расчёт)
 * @param techLevelTo Конечный уровень постройки/исследования
 * @param techData Массив данных о технологиях формата {id:[cost_met, cost_crys, cost_deut, cost_energy, grow_koeff]}
 * @param robotsLevel Уровень Фабрики роботов
 * @param nanitesLevel Уровень Фабрики нанитов
 * @param uniSpeed Скорость вселенной
 * @param rsrTimeRdc Сокращение времени исследований (в %)
 * @param megalithRdc бонус от Мегалита
 * @returns Общая длительность апгрейда постройки/исследования, строительства кораблей 
 */
function getBuildTimeLF(techID, techLevelFrom, techLevelTo, techData, robotsLevel, nanitesLevel, uniSpeed, rsrTimeRdc, megalithRdc=0) {
	if (techLevelFrom < 0)
		return 0;
	var data = techData[techID];
	if (data === undefined)
		return 0;
	if (techLevelFrom >= techLevelTo && Number(techID) % 1000 > 100)
		return 0;
	var timeSpan = 0;
	// Техи с ID до 100 - это здания. Скорость их строительства зависит от наличия и уровня фабрик роботов и нанитов
	if (Number(techID) % 1000 <= 100) {
		if (techLevelFrom < techLevelTo) {
			for (var next = Number(techLevelFrom) + 1; next <= Number(techLevelTo); next++) {
				timeSpan += Math.floor((next * data[4] * Math.pow(data[9], next)) / ((robotsLevel + 1.0) * Math.pow(2.0, nanitesLevel)));
			}
		} else {
			for (var next = Number(techLevelFrom) - 1; next >= Math.max(Number(techLevelTo), 0); next--) {
				if (next == 0) {
					timeSpan += Math.floor((data[4] * Math.pow(data[9], 1)) / ((robotsLevel + 1.0) * Math.pow(2.0, nanitesLevel)));
				} else {
					timeSpan += Math.floor((next * data[4] * Math.pow(data[9], next)) / ((robotsLevel + 1.0) * Math.pow(2.0, nanitesLevel)));
				}
			}
		}
		timeSpan = Math.floor(timeSpan * (1 - megalithRdc));
		timeSpan = Math.floor(timeSpan / uniSpeed);
	} else {
		// Техи с ID больше 100 - это технологии. Скорость их исследования зависит от уровня исследовательской лаборатории и наличия технократа
		if (techLevelFrom < techLevelTo) {
			for (var next = Number(techLevelFrom) + 1; next <= Number(techLevelTo); next++) {
				let duration = Math.floor(next * data[4] * Math.pow(data[9], next));
				duration = Math.floor(duration * (1 - 0.01 * rsrTimeRdc));
				timeSpan += Math.floor(duration / uniSpeed);
			}
		}
	}

	if (timeSpan < 1) {
		timeSpan = 1;
	}

	return timeSpan;
}

/**
 * Вычисляет кол-во энергии, требуемое для изучения/постройки для Форм Жизни
 * @param techID ID постройки или исследования
 * @param techLevel уровень постройки/исследования
 * @param techData массив данных о технологиях формата {id:[cost_met, cost_crys, cost_deut, cost_energy, grow_koeff]}
 * @param ionTechLevel уровень ионной технологии
 * @param bldCostRdc снижающий затраты бонус от зданий
 * @returns Требуемая энергия
 */
function getBuildEnergyCostLF(techID, techLevel, techData, ionTechLevel, bldCostRdc=0) {
	if (techLevel < 1)
		return 0;
	var data = techData[techID];
	if (data === undefined)
		return 0;
	buildCost = Math.floor(Math.floor(data[3] * techLevel * Math.pow(data[8], techLevel)) * (1 - 0.04 * ionTechLevel));
	if (bldCostRdc > 0)
		buildCost = Math.floor(buildCost * (1 - bldCostRdc));
	return buildCost;
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
 * // shorten(1234567) -> "1.234.567" (format depends on numToOGame implementation)
 *
 * // When fullNumbers is false:
 * // shorten(1500000, "M") -> "1.5M" (format depends on numberToShortenedString implementation)
 */
function ogamizeNum(num, suffix) {
	if (options.prm.fullNumbers)
		return numToOGame(num);
	else
		return numberToShortenedString(num, suffix);
}