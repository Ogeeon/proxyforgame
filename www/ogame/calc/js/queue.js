var options = {
	defConstraints: {
		min: -Infinity,
		max: Infinity,
		def: 0,
		allowFloat: false,
		allowNegative: false
	},
		
	prm: {
		universeSpeed: 1,
		ionTechLevel: 0,
		hyperTechLevel: 0,
		totFldPln: 163,
		totFldMn: 1,
		sDTP: 0,
		sDTM: 0,
		slp: [],
		slm: [],
		qp: [],
		qm: [],
		
		validate: function(field, value) {
			switch (field) {
				case 'universeSpeed': return validateNumber(parseFloat(value), 0, 10, 1);
				case 'ionTechLevel': return validateNumber(parseFloat(value), 0, 50, 0);
				case 'hyperTechLevel': return validateNumber(parseFloat(value), 0, 50, 0);
				case 'totFldPln': return validateNumber(parseFloat(value), 1, Infinity, 163);
				case 'totFldMn': return validateNumber(parseFloat(value), 1, Infinity, 1);
				case 'sDTP': return validateNumber(parseFloat(value), 0, Infinity, 0);
				case 'sDTM': return validateNumber(parseFloat(value), 0, Infinity, 0);
				case 'slp': return validateNumber(parseFloat(value), 0, Infinity, 0);
				case 'slm': return validateNumber(parseFloat(value), 0, Infinity, 0);
				case 'qp': return validateNumber(parseFloat(value), 0, Infinity, 1);
				case 'qm': return validateNumber(parseFloat(value), 0, Infinity, 1);
				default: return value;
			}
		} 
	},
		
	load: function() {
		try {
			loadFromCookie('options_queue', options.prm);
		} catch(e) {
			alert(e);
		}
	},

	save: function() {
		saveToCookie('options_queue', options.prm);
	},
	
	defPlfFlds: 163,
	defMnFlds: 1,
	nextLvlsPlanet: [],
	nextLvlsMoon: [],
	currRobotsPlanet: 0,
	currRobotsMoon: 0,
	currNanites: 0,
	currFldPlanet: 0,
	currFldMoon: 0,
	maxFldPlanet: 0,
	maxFldMoon: 0,
	totalsPlanet: [0, 0, 0, 0, 0],
	totalsMoon: [0, 0, 0, 0, 0]
};

function validateDateField(id) {
	if ($('#'+id)[0].value.search('_') >= 0 || parseDate($('#'+id)[0].value, options.datetimeFormat) == 0) {
		// Если в поле вообще пусто, не будем раздражать пользователя красной рамкой.
		if ($('#'+id)[0].value == '' || $('#'+id)[0].value == '__.__.____ __:__:__') {
			$('#'+id).removeClass('ui-state-error').addClass('ui-state-default');
		} else {
			$('#'+id).removeClass('ui-state-default').addClass('ui-state-error');
		}
		return false;
	} else {
		// Если дата в поле парсится нормально, можно гарантированно присваивать соответствующий класс
		$('#'+id).removeClass('ui-state-error').addClass('ui-state-default');
		return true;
	}
}

function getCosts(techID, techLevel, robotsLevel, nanitesLevel, uniSpeed, deconstruction) {
//	consoleLog('getCosts called for '+techID+', '+techLevel+', '+robotsLevel+', '+nanitesLevel+', '+uniSpeed);
	if (techLevel < 0)
		return 0;
	var timeSpan = 1;
	var cost = [0, 0, 0];
	if (!deconstruction) {
		cost = getBuildCost_C(techID, techLevel-1, techLevel, options.techCosts, 0);
		timeSpan = getBuildTime_C(techID, techLevel-1, techLevel, options.techCosts, robotsLevel, nanitesLevel, 0, 1, 0, uniSpeed);
	} else {
		cost = getBuildCost_C(techID, techLevel+1, techLevel, options.techCosts, options.prm.ionTechLevel);
		timeSpan = getBuildTime_C(techID, techLevel+1, techLevel, options.techCosts, robotsLevel, nanitesLevel, 0, 1, 0, uniSpeed);
	}
	
	cost.push(timeSpan);
	return cost;
}

function resetParams() {
	options.prm.universeSpeed = 1;
	options.prm.ionTechLevel = 0;
	options.prm.hyperTechLevel = 0;
	options.prm.sDTP = 0;
	options.prm.sDTM = 0;
	
	$('#universe-speed').val(options.prm.universeSpeed);
	$('#ion-tech-level').val(options.prm.ionTechLevel);
	$('#hyper-tech-level').val(options.prm.hyperTechLevel);
	$('#total-fields-2').val(options.defPlfFlds);
	$('#total-fields-3').val(options.defMnFlds);
	$('#start-2').val('');
	$('#start-3').val('');
	
	for (var tab=2; tab<4; tab++) {
		var rows = $('#table-src-'+tab+' tr');
		for (var row = 1; row < rows.length; row++) {
			$(rows[row].children[2].children[0]).val(0);
		}
	}
	
	clearQueue('planet');
	clearQueue('moon');
	refreshBothQueues();
}

function clearQueue(planet) {
	var place = (arguments[0].data) ? arguments[0].data : planet; 
	if (place == 'planet') {
		var dstTbl = 2;
		var totals = options.totalsPlanet;
		var totalFlds = options.prm.totFldPln;
		var nextLvls = options.nextLvlsPlanet;
		var startLvls = options.prm.slp;
		options.prm.qp = [];
	}
	else {
		var dstTbl = 3;
		var totals = options.totalsMoon;
		var totalFlds = options.prm.totFldMn;
		var nextLvls = options.nextLvlsMoon;
		var startLvls = options.prm.slm;
		options.prm.qm = [];
	}
	
	var currFlds = 0;
	for (var i = 0; i < startLvls.length; i++) {
		currFlds += startLvls[i][1];
		nextLvls[i][1] = startLvls[i][1] + 1;
		$('#nextlvl-'+dstTbl+'-'+nextLvls[i][0]).html(nextLvls[i][1]);
		if (startLvls[i][0] == 14) {
			if (place == 'planet')
				options.currRobotsPlanet = startLvls[i][1];
			else
				options.currRobotsMoon = startLvls[i][1];
		}
		// Нанитка, только на планете
		if (startLvls[i][0] == 15)
			options.currNanites = startLvls[i][1];
	}
	if (place == 'planet') {
		options.currFldPlanet = currFlds;
		options.maxFldPlanet = options.prm.totFldPln;
	} else {
		options.currFldMoon = currFlds;
		options.maxFldMoon = options.prm.totFldMn;
	}
	
	var tbl = $('#table-dst-'+dstTbl)[0];
	for (var i = tbl.rows.length-3; i > 0; i--)
		$(tbl.rows[i]).remove();
	
	totals[0] = currFlds; totals[1] = 0; totals[2] = 0; totals[3] = 0; totals[4] = 0;
	
	var rows = $('#table-dst-'+dstTbl+' tr');
	var totalsRow = rows.length - 2;
	rows[totalsRow].children[1].innerHTML = totals[0]+'/'+totalFlds;
	rows[totalsRow].children[2].innerHTML = numberToShortenedString(totals[1], options.unitSuffix);
	rows[totalsRow].children[3].innerHTML = numberToShortenedString(totals[2], options.unitSuffix);
	rows[totalsRow].children[4].innerHTML = numberToShortenedString(totals[3], options.unitSuffix);
	rows[totalsRow].children[5].innerHTML = timespanToShortenedString(totals[4], options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true);

	rows[totalsRow+1].children[1].innerHTML = 0 + ' <abbr title="'+options.scFull+'">'+options.scShort+'</abbr>';
	rows[totalsRow+1].children[2].innerHTML = 0 + ' <abbr title="'+options.lcFull+'">'+options.lcShort+'</abbr>';
	
	options.save();
}

function getStartLvl(tabNum, techId) {
	var rows = $('#table-src-'+tabNum+' tr');
	var startLvl = 0;
	for (var row = 1; row < rows.length; row++) {
		var listTechId = 1*$(rows[row].children[0]).html();
		if (techId == listTechId) {
			startLvl = $(rows[row].children[2].children[0]).val();
		}
		break;
	}
	return startLvl;
}

function build() {
	var techId = 1*$(this.parentNode.parentNode.children[0]).eq(0).html();
	var techName = $(this.parentNode.parentNode.children[1]).eq(0).html();
	if (arguments[0].data == 'planet') {
		var nextLvls = options.nextLvlsPlanet;
		var robots = options.currRobotsPlanet;
		var nanites = options.currNanites;
		var dstTbl = 2;
		var totals = options.totalsPlanet;
		var totalFlds = options.maxFldPlanet*1;
		var q = options.prm.qp;
	}
	else {
		var nextLvls = options.nextLvlsMoon;
		var robots = options.currRobotsMoon;
		var nanites = 0;
		var dstTbl = 3;
		var totals = options.totalsMoon;
		var totalFlds = options.maxFldMoon*1;
		var q = options.prm.qm;
	}
	var nextLevel = 0;
	for (var i = 0; i <  nextLvls.length; i++) {
		if (nextLvls[i][0] == techId) {
			nextLevel = nextLvls[i][1];
			nextLvls[i][1] += 1;
			$('#nextlvl-'+dstTbl+'-'+techId).html(nextLvls[i][1]);
			break;
		}
	}
	if (nextLevel == 0) {
		return;
	}
	var costs = getCosts(techId, nextLevel, robots, nanites, options.prm.universeSpeed, false);
	if (techId == 14) {
		if (arguments[0].data == 'planet')
			options.currRobotsPlanet += 1;
		else
			options.currRobotsMoon += 1;
	}
	if (techId == 15)
		options.currNanites +=1;
	
	if (techId != 36) { // космический док не занимает поля на планете
		totals[0] = totals[0] + 1;
	}
	
	var theme = { value: 'light', validate: function(key, val) { return val; } };
	loadFromCookie('theme', theme);
	var fontColor = (totals[0] > totalFlds) ? "brown" : (theme.value == "light" ? "black" : "white");
	
	if (techId == 33) {
		var bonus = (nextLevel % 2 == 0) ? 6 : 5;
		options.maxFldPlanet += bonus;
		totalFlds += bonus;
	}
	
	if (techId == 41) {
		options.maxFldMoon += 3;
		totalFlds += 3;
	}
	
	var tbl = $('#table-dst-'+dstTbl)[0];
	var footer = $('#table-dst-'+dstTbl+' tr').slice(tbl.rows.length-2).detach();
	
	var rowStr = '<tr class='+(((tbl.rows.length-1) % 2) === 1 ? 'odd' : 'even')+'>';
	rowStr += '<td><font color="'+fontColor+'">'+techName+'</font></td>';
	rowStr += '<td align="center"><font color="'+fontColor+'">'+nextLevel+'</font></td>';
	for (var cellNum = 0; cellNum < 4; cellNum++) {
		totals[cellNum+1] = totals[cellNum+1] + costs[cellNum];
		if (cellNum == 3)
			rowStr += '<td align="center"><font color="'+fontColor+'">'+timespanToShortenedString(costs[cellNum], options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true)+'</font></td>';
		else
			rowStr += '<td align="center"><font color="'+fontColor+'">'+numberToShortenedString(costs[cellNum], options.unitSuffix)+'</font></td>';
	}
	var rowId = q.length;
	rowStr += '<td><div id="control-'+dstTbl+'-'+rowId+'"><button id="control-'+dstTbl+'-'+rowId+'-a"></button><button id="control-'+dstTbl+'-'+rowId+'-b"></button><button id="control-'+dstTbl+'-'+rowId+'-c"></button></div></td>';
	rowStr += '</tr>';
	$('#table-dst-'+dstTbl).append(rowStr);
	$( "#control-"+dstTbl+'-'+rowId).buttonset();
	$("#control-"+dstTbl+'-'+rowId+"-a").button( { icons: {primary:'ui-icon-arrowthick-1-n'} } );
	$("#control-"+dstTbl+'-'+rowId+"-b").button( { icons: {primary:'ui-icon-arrowthick-1-s'} } );
	$("#control-"+dstTbl+'-'+rowId+"-c").button( { icons: {primary:'ui-icon-close'} } );
	$("#control-"+dstTbl+'-'+rowId+"-a").click(dstTbl+"|"+rowId, moveUp);
	$("#control-"+dstTbl+'-'+rowId+"-b").click(dstTbl+"|"+(rowId+1), moveUp);
	$("#control-"+dstTbl+'-'+rowId+"-c").click(dstTbl+"|"+rowId, del);
	
	footer.appendTo('#table-dst-'+dstTbl);
	
	var rows = $('#table-dst-'+dstTbl+' tr');
	var totalsRow = rows.length - 2;
	rows[totalsRow].children[1].innerHTML = '<font color="'+fontColor+'">'+totals[0]+'/'+totalFlds+'</font>';
	rows[totalsRow].children[2].innerHTML = numberToShortenedString(totals[1], options.unitSuffix);
	rows[totalsRow].children[3].innerHTML = numberToShortenedString(totals[2], options.unitSuffix);
	rows[totalsRow].children[4].innerHTML = numberToShortenedString(totals[3], options.unitSuffix);
	rows[totalsRow].children[5].innerHTML = timespanToShortenedString(totals[4], options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true);

	var totalRes = totals[1] + totals[2] + totals[3];
	var capSC = 5000.0 * (1 + 0.05 * options.prm.hyperTechLevel);
	var needSC = Math.ceil(totalRes / capSC);
	var capLC = 25000.0 * (1 + 0.05 * options.prm.hyperTechLevel);
	var needLC = Math.ceil(totalRes / capLC);
	rows[totalsRow+1].children[1].innerHTML = numToOGame(needSC) + ' <abbr title="'+options.scFull+'">'+options.scShort+'</abbr>';
	rows[totalsRow+1].children[2].innerHTML = numToOGame(needLC) + ' <abbr title="'+options.lcFull+'">'+options.lcShort+'</abbr>';
	
	q.push([techId, 1]);
	updateCompletion(arguments[0].data);
	options.save();
}

function deconstruct() {
	var techId = 1*$(this.parentNode.parentNode.children[0]).eq(0).html();
	var techName = $(this.parentNode.parentNode.children[1]).eq(0).html();
	if (arguments[0].data == 'planet') {
		var nextLvls = options.nextLvlsPlanet;
		var robots = options.currRobotsPlanet;
		var nanites = options.currNanites;
		var dstTbl = 2;
		var totals = options.totalsPlanet;
		var totalFlds = options.maxFldPlanet*1;
		var q = options.prm.qp;
	}
	else {
		var nextLvls = options.nextLvlsMoon;
		var robots = options.currRobotsMoon;
		var nanites = 0;
		var dstTbl = 3;
		var totals = options.totalsMoon;
		var totalFlds = options.maxFldMoon*1;
		var q = options.prm.qm;
	}
	var currLevel = 0;
	for (var i = 0; i <  nextLvls.length; i++) {
		if (nextLvls[i][0] == techId) {
			currLevel = nextLvls[i][1] - 1;
			if (currLevel == 0) { // здание ещё не построено
				return;
			}
			nextLvls[i][1] -= 1;
			$('#nextlvl-'+dstTbl+'-'+techId).html(nextLvls[i][1]);
			break;
		}
	}
	if (currLevel == 0) { // Не нашли здание о_0
		return;
	}
	var costs = getCosts(techId, currLevel, robots, nanites, options.prm.universeSpeed, true);
	if (techId == 14) {
		if (arguments[0].data == 'planet')
			options.currRobotsPlanet -= 1;
		else
			options.currRobotsMoon -= 1;
	}
	if (techId == 15)
		options.currNanites -=1;
	
	totals[0] = totals[0] - 1;
	
	var theme = { value: 'light', validate: function(key, val) { return val; } };
	loadFromCookie('theme', theme);
	var fontColor = (totals[0] > totalFlds) ? "brown" : (theme.value == "light" ? "black" : "white")
	var tbl = $('#table-dst-'+dstTbl)[0];
	var footer = $('#table-dst-'+dstTbl+' tr').slice(tbl.rows.length-2).detach();
	
	var rowStr = '<tr class='+(((tbl.rows.length-1) % 2) === 1 ? 'odd' : 'even')+'>';
	rowStr += '<td><font color="'+fontColor+'">'+techName+' (&darr;)</font></td>';
	rowStr += '<td align="center"><font color="'+fontColor+'">'+(currLevel-1)+'</font></td>';
	for (var cellNum = 0; cellNum < 4; cellNum++) {
		totals[cellNum+1] = totals[cellNum+1] + costs[cellNum];
		if (cellNum == 3)
			rowStr += '<td align="center"><font color="'+fontColor+'">'+timespanToShortenedString(costs[cellNum], options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true)+'</font></td>';
		else
			rowStr += '<td align="center"><font color="'+fontColor+'">'+numberToShortenedString(costs[cellNum], options.unitSuffix)+'</font></td>';
	}
	var rowId = q.length;
	rowStr += '<td><div id="control-'+dstTbl+'-'+rowId+'"><button id="control-'+dstTbl+'-'+rowId+'-a"></button><button id="control-'+dstTbl+'-'+rowId+'-b"></button><button id="control-'+dstTbl+'-'+rowId+'-c"></button></div></td>';
	rowStr += '</tr>';
	$('#table-dst-'+dstTbl).append(rowStr);
	$( "#control-"+dstTbl+'-'+rowId).buttonset();
	$("#control-"+dstTbl+'-'+rowId+"-a").button( { icons: {primary:'ui-icon-arrowthick-1-n'} } );
	$("#control-"+dstTbl+'-'+rowId+"-b").button( { icons: {primary:'ui-icon-arrowthick-1-s'} } );
	$("#control-"+dstTbl+'-'+rowId+"-c").button( { icons: {primary:'ui-icon-close'} } );
	$("#control-"+dstTbl+'-'+rowId+"-a").click(dstTbl+"|"+rowId, moveUp);
	$("#control-"+dstTbl+'-'+rowId+"-b").click(dstTbl+"|"+(rowId+1), moveUp);
	$("#control-"+dstTbl+'-'+rowId+"-c").click(dstTbl+"|"+rowId, del);
	
	footer.appendTo('#table-dst-'+dstTbl);
	
	var rows = $('#table-dst-'+dstTbl+' tr');
	var totalsRow = rows.length - 2;
	rows[totalsRow].children[1].innerHTML = '<font color="'+fontColor+'">'+totals[0]+'/'+totalFlds+'</font>';
	rows[totalsRow].children[2].innerHTML = numberToShortenedString(totals[1], options.unitSuffix);
	rows[totalsRow].children[3].innerHTML = numberToShortenedString(totals[2], options.unitSuffix);
	rows[totalsRow].children[4].innerHTML = numberToShortenedString(totals[3], options.unitSuffix);
	rows[totalsRow].children[5].innerHTML = timespanToShortenedString(totals[4], options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true);

	var totalRes = totals[1] + totals[2] + totals[3];
	var capSC = 5000.0 * (1 + 0.05 * options.prm.hyperTechLevel);
	var needSC = Math.ceil(totalRes / capSC);
	var capLC = 25000.0 * (1 + 0.05 * options.prm.hyperTechLevel);
	var needLC = Math.ceil(totalRes / capLC);
	rows[totalsRow+1].children[1].innerHTML = numToOGame(needSC) + ' <abbr title="'+options.scFull+'">'+options.scShort+'</abbr>';
	rows[totalsRow+1].children[2].innerHTML = numToOGame(needLC) + ' <abbr title="'+options.lcFull+'">'+options.lcShort+'</abbr>';
	
	q.push([techId, 0]);
	updateCompletion(arguments[0].data);
	options.save();
}

function moveUp(event) {
	var input = event.currentTarget;
	$(input).trigger('blur');
	var args = arguments[0].data.split('|');
	var type = args[0];
	var id = args[1];
	if (id == 0)
		return;
	if (type == 2) {
		var tabNum = '2';
		var q = options.prm.qp;
		var nl = options.nextLvlsPlanet;
	}
	else {
		var tabNum = '3';
		var q = options.prm.qm;
		var nl = options.nextLvlsMoon;
	}
	if (id >= q.length)
		return;
	// Проверка нужна только при сносе здания
	if (q[id][1] == 0) {
		var techId = q[id][0]; 
		var startLvl = getStartLvl(tabNum, techId);
		// Если стартовый уровень - 0, нужно узнать, сколько раз повышался уровень
		// постройки до текущей позиции в очереди
		if (startLvl == 0) {
			var builds = 0;
			for (var qi = 0; qi < id; qi++) {
				if (q[qi][0] == techId) {
					builds++;
				}
			}
			// Если перед сносом осталось только одно задание повышения уровня, перемещать снос вверх нельзя
			if (builds < 2) {
				return;
			}
		}
	}
	var tmp = q[id-1];
	q[id-1] = q[id];
	q[id] = tmp;
	if (type == 2)
		refreshPlanetQueue();
	else
		refreshMoonQueue();
}

function del(event) {
	var input = event.currentTarget;
	$(input).trigger('blur');
	var args = arguments[0].data.split('|');
	var type = args[0];
	var id = args[1];
	if (type == 2)
		q = options.prm.qp;
	else
		q = options.prm.qm;
	q.splice(id, 1);
	if (type == 2)
		refreshPlanetQueue();
	else
		refreshMoonQueue();
}

function refreshBothQueues() {
	refreshQueue(true);
	refreshQueue(false);
}

function refreshPlanetQueue() {
	refreshQueue(true);
}

function refreshMoonQueue() {
	refreshQueue(false);
}

function refreshQueue(planet) {
	options.prm.universeSpeed = $('#universe-speed').val();
	options.prm.ionTechLevel = $('#ion-tech-level').val();
	options.prm.hyperTechLevel = $('#hyper-tech-level').val();
	options.prm.totFldPln = 1*$('#total-fields-2').val();
	options.maxFldPlanet = options.prm.totFldPln; 
	options.prm.totFldMn = 1*$('#total-fields-3').val();
	options.maxFldMoon = options.prm.totFldMn;
	
	if (planet) {
		var tabNum = '2';
		options.nextLvlsPlanet = [];
		options.totalsPlanet = [0, 0, 0, 0, 0];
		options.currFldPlanet = 0;
		var q = options.prm.qp;
	}
	else {
		var tabNum = '3';
		options.nextLvlsMoon = [];
		options.totalsMoon = [0, 0, 0, 0, 0];
		options.currFldMoon = 0;
		var q = options.prm.qm;
	}
	purgeDeconstr(q, tabNum);
	
	var rows = $('#table-src-'+tabNum+' tr');
	sl = [];
	var techId = 0;
	var techLvl = 0;
	for (var row = 1; row < rows.length; row++) {
		techId = $(rows[row].children[0]).html();
		techLvl = getInputNumber($(rows[row].children[2].children[0])[0]);
		sl.push([techId, techLvl]);
		$('#nextlvl-'+tabNum+'-'+techId).html(techLvl+1);
		if (planet) {
			options.nextLvlsPlanet.push([techId, techLvl+1]);
			if (techId == 14)
				options.currRobotsPlanet = techLvl;
			if (techId == 15)
				options.currNanites = techLvl;
			options.currFldPlanet += techLvl;
		}
		else {
			options.nextLvlsMoon.push([techId, techLvl+1]);
			if (techId == 14)
				options.currRobotsMoon = techLvl;
			options.currFldMoon += techLvl;
		}
	}
	if (planet) {
		options.prm.slp = sl;
		options.totalsPlanet[0] = options.currFldPlanet;
		var totals = options.totalsPlanet;
		var nextLvls = options.nextLvlsPlanet;
		var robots = options.currRobotsPlanet;
		var nanites = options.currNanites;
		var totalFlds = options.maxFldPlanet*1;
	}
	else {
		options.prm.slm = sl;
		options.totalsMoon[0] = options.currFldMoon;
		var totals = options.totalsMoon;
		var nextLvls = options.nextLvlsMoon;
		var robots = options.currRobotsMoon;
		var nanites = 0;
		var totalFlds = options.maxFldMoon*1;
	}
	
	var tbl = $('#table-dst-'+tabNum)[0];
	for (var i = tbl.rows.length-3; i > 0; i--)
		$(tbl.rows[i]).remove();
	var footer = $('#table-dst-'+tabNum+' tr').slice(tbl.rows.length-2).detach();
	var theme = { value: 'light', validate: function(key, val) { return val; } };
	loadFromCookie('theme', theme);
	var fontColor = theme.value == "light" ? "black" : "white";
	
	var rows;
	var techId = 0;
	var techName = '';
	var techLvl = 0;
	var rm = false;
	var inc = 0;
	for (var qi = 0; qi < q.length; qi++) {
		rows = $('#table-src-'+tabNum+' tr');
		techId = 0;
		techLvl = 0;
		for (var row = 1; row < rows.length; row++) {
			techId = 1*$(rows[row].children[0]).html();
			if (techId == q[qi][0]) {
				rm = q[qi][1] == 0; // Сносим здание?
				inc = rm ? -1 : 1;
				techName = $(rows[row].children[1]).html();
				// поскольку порядок строк в таблице соответствует порядку элементов в nextLevels, мы можем себе такое позволить
				techLvl = rm ? nextLvls[row-1][1] - 2 : nextLvls[row-1][1]; // -1 будет текущий уровень, -2 - тот, до которого сносим
				nextLvls[row-1][1] += inc;
				$('#nextlvl-'+tabNum+'-'+techId).html(nextLvls[row-1][1]);
				
				var costs = getCosts(techId, techLvl, robots, nanites, options.prm.universeSpeed, rm);
				if (techId == 14) {
					if (planet) {
						options.currRobotsPlanet += inc;
						robots += inc;
					}
					else {
						options.currRobotsMoon += inc;
						robots += inc;
					}
				}
				if (techId == 15) {
					options.currNanites +=inc;
					nanites += inc;
				}
				if (techId != 36) { // космический док не занимает поля на планете
					totals[0] = totals[0] + inc;
				}
				fontColor = (totals[0] > totalFlds) ? "brown" : (theme == "light" ? "black" : "white")
				
				if (techId == 33) {
					var bonus = (techLvl % 2 == 0) ? 6 : 5;
					options.maxFldPlanet += bonus;
					totalFlds += bonus;
				}
				
				if (techId == 41) {
					options.maxFldMoon += 3;
					totalFlds += 3;
				}

				var rowStr = '<tr class='+(((tbl.rows.length-1) % 2) === 1 ? 'odd' : 'even')+'>';
				rowStr += '<td><font color="'+fontColor+'">'+techName+(rm ? ' (&darr;)' : '')+'</font></td>';
				rowStr += '<td align="center"><font color="'+fontColor+'">'+techLvl+'</font></td>';
				for (var cellNum = 0; cellNum < 4; cellNum++) {
					totals[cellNum+1] = totals[cellNum+1] + costs[cellNum];
					if (cellNum == 3)
						rowStr += '<td align="center"><font color="'+fontColor+'">'+timespanToShortenedString(costs[cellNum], options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true)+'</font></td>';
					else
						rowStr += '<td align="center"><font color="'+fontColor+'">'+numberToShortenedString(costs[cellNum], options.unitSuffix)+'</font></td>';
				}
				var rowId = qi;
				rowStr += '<td><div id="control-'+tabNum+'-'+rowId+'"><button id="control-'+tabNum+'-'+rowId+'-a"></button><button id="control-'+tabNum+'-'+rowId+'-b"></button><button id="control-'+tabNum+'-'+rowId+'-c"></button></div></td>';
				rowStr += '</tr>';
				$('#table-dst-'+tabNum).append(rowStr);
				$( "#control-"+tabNum+'-'+rowId).buttonset();
				$("#control-"+tabNum+'-'+rowId+"-a").button( { icons: {primary:'ui-icon-arrowthick-1-n'} } );
				$("#control-"+tabNum+'-'+rowId+"-b").button( { icons: {primary:'ui-icon-arrowthick-1-s'} } );
				$("#control-"+tabNum+'-'+rowId+"-c").button( { icons: {primary:'ui-icon-close'} } );
				$("#control-"+tabNum+'-'+rowId+"-a").click(tabNum+"|"+rowId, moveUp);
				$("#control-"+tabNum+'-'+rowId+"-b").click(tabNum+"|"+(rowId+1), moveUp);
				$("#control-"+tabNum+'-'+rowId+"-c").click(tabNum+"|"+rowId, del);
				
				break;
			}
		}
	}
	
	footer.appendTo('#table-dst-'+tabNum);
	
	var rows = $('#table-dst-'+tabNum+' tr');
	var totalsRow = rows.length - 2;
	rows[totalsRow].children[1].innerHTML = '<font color="'+fontColor+'">'+totals[0]+'/'+totalFlds+'</font>';
	rows[totalsRow].children[2].innerHTML = numberToShortenedString(totals[1], options.unitSuffix);
	rows[totalsRow].children[3].innerHTML = numberToShortenedString(totals[2], options.unitSuffix);
	rows[totalsRow].children[4].innerHTML = numberToShortenedString(totals[3], options.unitSuffix);
	rows[totalsRow].children[5].innerHTML = timespanToShortenedString(totals[4], options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true);

	var totalRes = totals[1] + totals[2] + totals[3];
	var capSC = 5000.0 * (1 + 0.05 * options.prm.hyperTechLevel);
	var needSC = Math.ceil(totalRes / capSC);
	var capLC = 25000.0 * (1 + 0.05 * options.prm.hyperTechLevel);
	var needLC = Math.ceil(totalRes / capLC);
	rows[totalsRow+1].children[1].innerHTML = numToOGame(needSC) + ' <abbr title="'+options.scFull+'">'+options.scShort+'</abbr>';
	rows[totalsRow+1].children[2].innerHTML = numToOGame(needLC) + ' <abbr title="'+options.lcFull+'">'+options.lcShort+'</abbr>';

	updateCompletion(planet?"planet":"moon");
	options.save();
}

function purgeDeconstr(queue, tabNum) {
	var deconstrs = [];
	for (var idx = 0; idx < queue.length; idx++) {
		if (queue[idx][1] == 0) {
			if ($.inArray(queue[idx][0], deconstrs) == -1) {
				deconstrs.push(queue[idx][0]);
			}
		}
	}
	for (var didx = 0; didx < deconstrs.length; didx++) {
		var startLvl = getStartLvl(tabNum, deconstrs[didx]);
		var currLvl;
		var complete = false;
		var qidx;
		while (!complete) {
			currLvl = startLvl;
			for (qidx = 0; qidx < queue.length; qidx++) {
				if (queue[qidx][0] == deconstrs[didx]) {
					if (queue[qidx][1] == 1) {
						currLvl++;
					} else {
						currLvl--;
						// Постройка была и так нулевого уровня, сносить нельзя
						if (currLvl < 0) {
							currLvl++;
							queue.splice(qidx, 1);
						}
					}
				}
			}
			if (qidx == queue.length) {
				complete = true;
			}
		}
	}
}

function setStartNow(planet) {
	var place = (arguments[0].data) ? arguments[0].data : planet; 
	var ts = (new Date()).getTime();
	if (place == 'planet') {
		var dstSuff = '2';
		options.prm.sDTP = ts;
	} else  {
		var dstSuff = '3';
		options.prm.sDTM = ts;
	}
	 
	$('#start-'+dstSuff)[0].value = getDateStr(ts, options.datetimeFormat); 
	
	updateCompletion(place);
}

function updateCompletion(planet) {
	// Содержимое полей, определяющих момент старта строительства, проверяется регулярным выражением.
	// Невалидное значение там может быть только если поле содержит placeholder.
	var place = (arguments[0].data) ? arguments[0].data : planet; 
	if (place == 'planet') {
		var dstSuff = '2';
	} else  {
		var dstSuff = '3';
	}
	var startDT = $('#start-'+dstSuff).inputmask('unmaskedvalue');
	var showResult = validateDateField('start-'+dstSuff);
	var t = parseDate(startDT, options.datetimeFormat);
	if (place == 'planet') {
		var dstSuff = '2';
		options.prm.sDTP = t;
		var totals = options.totalsPlanet;
	} else  {
		var dstSuff = '3';
		options.prm.sDTM = t;
		var totals = options.totalsMoon;
	}

	// getDateStr принимает кол-во миллисекунд с начала эпохи
	if (showResult && totals[4] > 0)
		$('#finish-moment-'+dstSuff).text(getDateStr(t+totals[4]*1000, options.datetimeFormat));
	else
		$('#finish-moment-'+dstSuff).text('?');
	
	options.save();
}

$(document).ready(function() {
	$("#tabs").tabs({	cookie: {	expires: 365 } });	// UI сохраняет в куках номер открытой вкладки	
	
	options.load();
	$('#universe-speed').val(options.prm.universeSpeed);
	$('#ion-tech-level').val(options.prm.ionTechLevel);
	$('#hyper-tech-level').val(options.prm.hyperTechLevel);
	$('#total-fields-2').val(options.prm.totFldPln);
	$('#total-fields-3').val(options.prm.totFldMn);
	$('#start-2').val(getDateStr(options.prm.sDTP, options.datetimeFormat));
	$('#start-3').val(getDateStr(options.prm.sDTM, options.datetimeFormat));

	if(options.prm.slp)
		for (var i = 0; i < options.prm.slp.length; i++) 
			$('#startlvl-'+2+'-'+options.prm.slp[i][0]).val(options.prm.slp[i][1]);
	if(options.prm.slm)
		for (var i = 0; i < options.prm.slm.length; i++) 
			$('#startlvl-'+3+'-'+options.prm.slm[i][0]).val(options.prm.slm[i][1]);
		
	refreshBothQueues();

	$('input').focusin(function() {
		$(this).addClass('ui-state-focus');
	});
	$('input').focusout(function() {
		$(this).removeClass('ui-state-focus');
	});

	// После того, как событие будет обработано, нужно вызвать функцию пересчета. Её имя передаём в поле data событий.
	$('#tab-2 input:text').keyup('refreshPlanetQueue', validateInputNumber);
	$('#tab-2 input:text').blur('refreshPlanetQueue', validateInputNumberOnBlur);
	$('#tab-3 input:text').keyup('refreshMoonQueue', validateInputNumber);
	$('#tab-3 input:text').blur('refreshMoonQueue', validateInputNumberOnBlur);
	
	$('#ion-tech-level').keyup('refreshBothQueues', validateInputNumber);
	$('#hyper-tech-level').keyup('refreshBothQueues', validateInputNumber);
	
	$('#tab-2 div.button-build').click('planet', build);
	$('#tab-3 div.button-build').click('moon', build);

	$('#tab-2 div.button-destroy').click('planet', deconstruct);
	$('#tab-3 div.button-destroy').click('moon', deconstruct);
	
	$('#queue select').keyup(refreshBothQueues);
	$('#queue select').change(refreshBothQueues);
//	$('#queue select').mousemove(refreshBothQueues);
	$('#clear-2').click('planet', clearQueue);
	$('#clear-3').click('moon', clearQueue);
	$('#reset').click(resetParams);

	$('#start-2').unbind();
	$('#start-2').keyup('planet', updateCompletion);
	$('#start-3').unbind();
	$('#start-3').keyup('moon', updateCompletion);
	
	$('#set-start-now-2').click('planet', setStartNow);
	$('#set-start-now-3').click('moon', setStartNow);

	var theme = { value: 'light', validate: function(key, val) { return val; } };
	loadFromCookie('theme', theme);
	toggleLight(theme.value == 'light');
	$('#cb-light-theme').click(function(){toggleLight($('#cb-light-theme')[0].checked); refreshBothQueues()});
});
