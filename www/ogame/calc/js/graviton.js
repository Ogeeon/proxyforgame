var options = {
	prm: {
		shipyardLevel: 1,
		nanitesFactoryLevel: 0,
		universeSpeed: 1,
		energyTechLevel: 0,
		hyperTechLevel: 0,
		maxPlanetTemp: 0,
		energyBonus: 0,
		solarPlantLevel: 0,
		solarPlantPercent: 100,
		fusionPlantLevel: 0,
		fusionPlantPercent: 100,
		solarSatellitesCount: 0,
		solarSatellitesPercent: 100,
		debrisPercent: 30,
		isCollector: false,
		isTrader: false,
		energyBoost: 0,
		disChLevel: 0,
		gravitonLevel: 1,
		totalLFEnrgBonus: 0,
		
		validate: function(field, value) {
			switch (field) {
				case 'shipyardLevel': return validateNumber(parseFloat(value), 1, 100, 1);
				case 'nanitesFactoryLevel': return validateNumber(parseFloat(value), 0, 100, 0);
				case 'universeSpeed': return validateNumber(parseFloat(value), 0, 10, 0);
				case 'energyTechLevel': return validateNumber(parseFloat(value), 0, 50, 0);
				case 'hyperTechLevel': return validateNumber(parseFloat(value), 0, 50, 0);
				case 'maxPlanetTemp': return validateNumber(parseFloat(value), -134, Infinity, 0);
				case 'energyBonus': return validateNumber(parseFloat(value), 0, 2, 0);
				case 'solarPlantLevel': return validateNumber(parseFloat(value), 0, 100, 0);
				case 'solarPlantPercent': return validateNumber(parseFloat(value), 0, 100, 100);
				case 'fusionPlantLevel': return validateNumber(parseFloat(value), 0, 100, 0);
				case 'fusionPlantPercent': return validateNumber(parseFloat(value), 0, 100, 100);
				case 'solarSatellitesCount': return validateNumber(parseFloat(value), 0, Infinity, 0);
				case 'debrisPercent': return validateNumber(parseFloat(value), 0, 40, 100);
				case 'isCollector': return value === 'true';
				case 'isTrader': return value === 'true';
				case 'energyBoost': return validateNumber(Number.parseInt(value), 0, 8, 0);
				case 'disChLevel': return validateNumber(parseFloat(value), 0, 100, 0);
				case 'gravitonLevel': return validateNumber(parseFloat(value), 0, 100, 0);
				case 'totalLFEnrgBonus': return validateNumber(parseFloat(value), 0, 100, 0);
				default: return value;
			}
		} 
	},
		
	load: function() {
		try {
			loadFromCookie('options_graviton', options.prm);
		} catch(e) {
			alert(e);
		}
	},

	save: function() {
		saveToCookie('options_graviton', options.prm);
	}
};

function resetParams() {
	options.prm.shipyardLevel = 1;
	options.prm.nanitesFactoryLevel = 0;
	options.prm.universeSpeed = 1;
	options.prm.energyTechLevel = 0;
	options.prm.hyperTechLevel = 0;
	options.prm.maxPlanetTemp = 0;
	options.prm.energyBonus = 0;
	options.prm.solarPlantLevel = 0;
	options.prm.solarPlantPercent = 100;
	options.prm.fusionPlantLevel = 0;
	options.prm.fusionPlantPercent = 100;
	options.prm.solarSatellitesCount = 0;
	options.prm.solarSatellitesPercent = 100;
	options.prm.debrisPercent = 30;
	options.prm.isCollector = false;
	options.prm.isTrader = false;
	options.prm.energyBoost = 0;
	options.prm.disChLevel = 0;
	options.prm.gravitonLevel = 1;
	options.prm.totalLFEnrgBonus = 0;
	
	$('#shipyard-level').val(options.prm.shipyardLevel);
	$('#nanites-factory-level').val(options.prm.nanitesFactoryLevel);
	$('#universe-speed').val(options.prm.universeSpeed);
	$('#energy-tech-level').val(options.prm.energyTechLevel);
	$('#hyper-tech-level').val(options.prm.hyperTechLevel);
	$('#max-planet-temp').val(options.prm.maxPlanetTemp);
	$('#energy-bonus-0').attr('checked', true);
	$('#solar-plant-level').val(options.prm.solarPlantLevel);
	$('#solar-plant-percent').val(options.prm.solarPlantPercent);
	$('#fusion-plant-level').val(options.prm.fusionPlantLevel);
	$('#fusion-plant-percent').val(options.prm.fusionPlantPercent);
	$('#solar-satellites-count').val(options.prm.solarSatellitesCount);
	$('#solar-satellites-percent').val(options.prm.solarSatellitesPercent);
	$('#debris-percent').val(options.prm.debrisPercent);
	$('#class-collector')[0].checked = options.prm.isCollector;
	$('#trader-bonus')[0].checked = options.prm.isTrader;
	$('#energy-boost').val(options.prm.energyBoost);
	$('#disr-chamber-level').val(options.prm.disChLevel);
	$('#graviton-level').val(options.prm.gravitonLevel);
	$('#total-lf-energy-bonus').val(options.prm.totalLFEnrgBonus);
	updateNumbers();
}

function updateNumbers() {
	options.prm.shipyardLevel = getInputNumber($('#shipyard-level')[0]);
	options.prm.nanitesFactoryLevel = getInputNumber($('#nanites-factory-level')[0]);
	options.prm.universeSpeed = $('#universe-speed')[0].value;
	options.prm.energyTechLevel = getInputNumber($('#energy-tech-level')[0]);
	options.prm.hyperTechLevel = getInputNumber($('#hyper-tech-level')[0]);
	options.prm.maxPlanetTemp = getInputNumber($('#max-planet-temp')[0]);
	if ($('#energy-bonus-2').attr('checked'))
		options.prm.energyBonus = 2;
	else {
		if ($('#energy-bonus-1').attr('checked'))
			options.prm.energyBonus = 1;
		else 
			options.prm.energyBonus = 0;
	}
	options.prm.solarPlantLevel = getInputNumber($('#solar-plant-level')[0]);
	options.prm.solarPlantPercent = $('#solar-plant-percent')[0].value;
	options.prm.fusionPlantLevel = getInputNumber($('#fusion-plant-level')[0]);
	options.prm.fusionPlantPercent = $('#fusion-plant-percent')[0].value;
	options.prm.solarSatellitesCount = getInputNumber($('#solar-satellites-count')[0]);
	options.prm.solarSatellitesPercent = $('#solar-satellites-percent')[0].value;
	options.prm.debrisPercent = getInputNumber($('#debris-percent')[0]);
	options.prm.isCollector = $('#class-collector')[0].checked;
	options.prm.isTrader = $('#trader-bonus')[0].checked;
	options.prm.energyBoost = $('#energy-boost')[0].value;
	options.prm.disChLevel = getInputNumber($('#disr-chamber-level')[0]);
	options.prm.gravitonLevel = getInputNumber($('#graviton-level')[0]);
	options.prm.totalLFEnrgBonus = getInputNumber($('#total-lf-energy-bonus')[0]);


	var solarPlantEnergy = Math.floor(0.01 * options.prm.solarPlantPercent * Math.floor(20 * options.prm.solarPlantLevel * Math.pow (1.1, options.prm.solarPlantLevel)));
	var fusionPlantEnergy = Math.floor(0.01 * options.prm.fusionPlantPercent * Math.floor(30 * options.prm.fusionPlantLevel * Math.pow (1.05 + options.prm.energyTechLevel * 0.01, options.prm.fusionPlantLevel)));
	var baseEnergyPerSat = 0.01*options.prm.solarSatellitesPercent * Math.floor ((options.prm.maxPlanetTemp + 140) / 6);
	var solarSatsEnergy = options.prm.solarSatellitesCount * baseEnergyPerSat>=0 ? options.prm.solarSatellitesCount * baseEnergyPerSat : 0;
	var totalEnergy = solarPlantEnergy + fusionPlantEnergy + solarSatsEnergy;
	
	var energyPerSat = baseEnergyPerSat;
	var classEnergyBonus = options.prm.isCollector ? Math.floor(0.1 * totalEnergy) : 0;
	energyPerSat += options.prm.isCollector ? 0.1 * baseEnergyPerSat : 0;
	var allianceEnergyBonus = options.prm.isTrader ? Math.floor(0.05 * totalEnergy) : 0;
	energyPerSat += options.prm.isTrader ? 0.05 * baseEnergyPerSat : 0;

	let disChEnergyBonus = Math.floor(options.prm.disChLevel * 0.015 * totalEnergy);
	energyPerSat += Math.floor(options.prm.disChLevel * 0.015 * baseEnergyPerSat);
	var lfTechBonus = Math.round(options.prm.totalLFEnrgBonus * 0.01 * totalEnergy);
	energyPerSat += 0.01 * options.prm.totalLFEnrgBonus * baseEnergyPerSat;
	
	var officerBonus = 0;
	if (options.prm.energyBonus === 1) {
		officerBonus = Math.floor(0.1 * totalEnergy);
		energyPerSat += 0.1 * baseEnergyPerSat;
	} else if (options.prm.energyBonus === 2) {
		officerBonus = Math.floor(0.12 * totalEnergy);
		energyPerSat += 0.12 * baseEnergyPerSat;
	}
	
	var boostEnergyBonus = Math.floor(0.1 * options.prm.energyBoost * totalEnergy);
	energyPerSat += 0.1 * options.prm.energyBoost * baseEnergyPerSat;
	
	$('#solar-plant-energy').text(numToOGame(Math.floor(solarPlantEnergy)));
	$('#fusion-plant-energy').text(numToOGame(Math.floor(fusionPlantEnergy)));
	$('#solar-satsellites-energy').text(numToOGame(Math.floor(solarSatsEnergy)));

	$('#officers-bonus-energy').text(numToOGame(officerBonus));
	$('#class-bonus-energy').text(numToOGame(classEnergyBonus));
	$('#alliance-bonus-energy').text(numToOGame(allianceEnergyBonus));
	$('#boost-bonus-energy').text(numToOGame(boostEnergyBonus));
	$('#disr-chamber-bonus-energy').text(numToOGame(disChEnergyBonus));
	$('#lf-tech-bonus-energy').text(numToOGame(lfTechBonus));

	var availableEnergy = Math.floor (solarPlantEnergy + fusionPlantEnergy + solarSatsEnergy + officerBonus
		+ classEnergyBonus + allianceEnergyBonus + boostEnergyBonus + disChEnergyBonus + lfTechBonus);
	$('#energy-produced').text(numToOGame(availableEnergy));
	var energyRequirement = options.prm.gravitonLevel > 0 ? 300000 * Math.pow(3, (options.prm.gravitonLevel - 1)) : 0;
	$('#energy-requirement').text(options.energyReqConjunction + " " + numToOGame(energyRequirement));
	
	var missingEnergy = energyRequirement - availableEnergy;
	if (missingEnergy < 0)
		missingEnergy = 0;
		
	if (energyPerSat <= 0) {
		$('#solar-satellites-needed').text('Infinity');
		$('#crystal-required').text('-');
		$('#deuterium-required').text('-');
		$('#cargoes').text('-');
		$('#recyclers').text('-');
		$('#time-required').text('-');
		options.save();
		return;
	}

	var neededSats = Math.ceil (missingEnergy / energyPerSat);
	$('#solar-satellites-needed').text(numToOGame(neededSats));

	var crysNeeded = neededSats * 2000;
	$('#crystal-required').text(numToOGame(crysNeeded));
	var deutNeeded = neededSats *  500;
	$('#deuterium-required').text(numToOGame(deutNeeded));

	var classBonus = options.prm.isCollector ? 1.25 : 1;
	var capSC = 5000.0 * (1 + 0.05 * options.prm.hyperTechLevel) * classBonus;
	var capLC = 25000.0 * (1 + 0.05 * options.prm.hyperTechLevel) * classBonus;
	
	var sumResources = crysNeeded + deutNeeded;
	var lcNeeded = Math.ceil (sumResources / capLC);
	var scNeeded = Math.ceil (sumResources /  capSC);
	$('#cargoes').text(numToOGame(scNeeded)+' '+options.scShort+' / '+numToOGame(lcNeeded)+' '+options.lcShort);

	// Округлим до 2х знаков после запятой, чтобы не было длинных хвостов у чисел.
	var dfPercent = dropFraction(0.01 * options.prm.debrisPercent, 2);
	var dfAmount = Math.floor((crysNeeded + options.prm.solarSatellitesCount * 2000) * dfPercent);
	$('#crystal-recyclable').text(numToOGame(dfAmount));
	var capRc = 20000.0 * (1 + 0.05 * options.prm.hyperTechLevel);
	var rcNeeded = Math.ceil (dfAmount / capRc);
	$('#recyclers').text(numToOGame(rcNeeded));
	var lcNeededForDF = Math.ceil (dfAmount / capLC);
	var scNeededForDF = Math.ceil (dfAmount / capSC);
	$('#cargoes-for-df').text(numToOGame(scNeededForDF)+' '+options.scShort+' / '+numToOGame(lcNeededForDF)+' '+options.lcShort);
	var secsPerSat = Math.max (1, Math.floor (((2000 * 60 * 60) / (2500 * (options.prm.shipyardLevel + 1) * Math.pow (2, options.prm.nanitesFactoryLevel))) / options.prm.universeSpeed));
	var secsTotal = neededSats * secsPerSat;
	var weeks = Math.floor (secsTotal / 604800);
	secsTotal = secsTotal % 604800;
	var days = Math.floor (secsTotal / 86400);
	secsTotal = secsTotal % 86400;
	var hours = Math.floor (secsTotal / 3600);
	var mins = Math.floor ((secsTotal - hours * 3600) / 60);
	var secs = secsTotal - hours * 3600 - mins * 60;
	var timeStr = (weeks>0?(weeks+options.datetimeW+' '):'') +
				(days>0?(days+options.datetimeD+' '):'') +
				(hours>0?(hours+options.datetimeH+' '):'') +
				(mins>0?(mins+options.datetimeM+' '):'') +
				(secs>0?(secs+options.datetimeS):'');
	timeStr = (timeStr == '')?('0'+options.datetimeS):timeStr;
	$('#time-required').text(timeStr);
	options.save();
}

$(document).ready(function() {
	options.load();
//	consoleLog(options.prm);
	$('#shipyard-level').val(options.prm.shipyardLevel);
	$('#nanites-factory-level').val(options.prm.nanitesFactoryLevel);
	$('#universe-speed').val(options.prm.universeSpeed);
	$('#energy-tech-level').val(options.prm.energyTechLevel);
	$('#hyper-tech-level').val(options.prm.hyperTechLevel);
	$('#max-planet-temp').val(options.prm.maxPlanetTemp);
	$('#energy-bonus-'+options.prm.energyBonus).attr('checked', true);
	$('#solar-plant-level').val(options.prm.solarPlantLevel);
	$('#solar-plant-percent').val(options.prm.solarPlantPercent);
	$('#fusion-plant-level').val(options.prm.fusionPlantLevel);
	$('#fusion-plant-percent').val(options.prm.fusionPlantPercent);
	$('#solar-satellites-count').val(options.prm.solarSatellitesCount);
	$('#solar-satellites-percent').val(options.prm.solarSatellitesPercent);
	$('#debris-percent').val(options.prm.debrisPercent);
	$('#class-collector')[0].checked = options.prm.isCollector;
	$('#trader-bonus')[0].checked = options.prm.isTrader;
	$('#energy-boost').val(options.prm.energyBoost);
	$('#disr-chamber-level').val(options.prm.disChLevel);
	$('#graviton-level').val(options.prm.gravitonLevel);
	$('#total-lf-energy-bonus').val(options.prm.totalLFEnrgBonus);


	$('input').focusin(function() {
		$(this).addClass('ui-state-focus');
	});
	$('input').focusout(function() {
		$(this).removeClass('ui-state-focus');
	});

	document.getElementById('shipyard-level')._constrains = {'min': 1, 'def': 1};
	document.getElementById('max-planet-temp')._constrains = {'min': -134, 'def': 0, 'allowNegative': true};
	document.getElementById('total-lf-energy-bonus')._constrains = {'min': 0, 'max': 999, 'def': 0, 'allowNegative': false, 'allowFloat': true};

	// После того, как событие будет обработано, нужно вызвать функцию пересчета. Её имя передаём в поле data событий.
	$('#graviton input:text').keyup('updateNumbers', validateInputNumber);
	$('#graviton input:text').blur('updateNumbers', validateInputNumberOnBlur);
	$('#graviton select').keyup(updateNumbers);
	$('#graviton select').change(updateNumbers);
	$('#graviton select').mousemove(updateNumbers);
	$('#general-settings input:radio').change(function(ev) { updateNumbers(); });
	$('#reset').click(resetParams);
	$('#class-collector').click(updateNumbers);
	$('#trader-bonus').click(updateNumbers);

	let theme = { value: 'light', validate: function(key, val) { return val; } };
	loadFromCookie('theme', theme);
	toggleLight(theme.value === 'light');
	$('#cb-light-theme').click(function(){toggleLight($('#cb-light-theme')[0].checked);});
	
	updateNumbers();
});
