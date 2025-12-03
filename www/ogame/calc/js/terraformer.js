let options = {
	prm: {
		shipyardLevel: 1,
		robotsFactoryLevel: 0,
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
		tfSingleLevel: false,
		tfLevelFrom: 0,
		tfLevelTo: 0,
		isCollector: false,
		energyBoost: 0,
		isTrader: false,
		disChLevel: 0,
		totalLFEnrgBonus: 0,

		validate: function (field, value) {
			switch (field) {
				case 'shipyardLevel':
					return validateNumber(parseFloat(value), 1, 100, 1);
				case 'robotsFactoryLevel':
					return validateNumber(parseFloat(value), 0, 100, 0);
				case 'nanitesFactoryLevel':
					return validateNumber(parseFloat(value), 0, 100, 0);
				case 'universeSpeed':
					return validateNumber(parseFloat(value), 0, 10, 0);
				case 'energyTechLevel':
					return validateNumber(parseFloat(value), 0, 50, 0);
				case 'hyperTechLevel':
					return validateNumber(parseFloat(value), 0, 50, 0);
				case 'maxPlanetTemp':
					return validateNumber(parseFloat(value), -134, Infinity, 0);
				case 'energyBonus':
					return validateNumber(parseFloat(value), 0, 2, 0);
				case 'solarPlantLevel':
					return validateNumber(parseFloat(value), 0, 100, 0);
				case 'solarPlantPercent':
					return validateNumber(parseFloat(value), 0, 100, 100);
				case 'fusionPlantLevel':
					return validateNumber(parseFloat(value), 0, 100, 0);
				case 'fusionPlantPercent':
					return validateNumber(parseFloat(value), 0, 100, 100);
				case 'solarSatellitesCount':
					return validateNumber(parseFloat(value), 0, Infinity, 0);
				case 'tfSingleLevel':
					return value === 'true';
				case 'tfLevelFrom':
					return validateNumber(parseFloat(value), 0, 100, 0);
				case 'tfLevelTo':
					return validateNumber(parseFloat(value), 0, 100, 0);
				case 'isCollector':
					return value === 'true';
				case 'energyBoost':
					return validateNumber(Number.parseInt(value), 0, 4, 0);
				case 'isTrader':
					return value === 'true';
				case 'disChLevel':
					return validateNumber(parseFloat(value), 0, 100, 0);
				case 'totalLFEnrgBonus':
					return validateNumber(parseFloat(value), 0, 100, 0);
				default:
					return value;
			}
		}
	},

	load: function () {
		try {
			loadFromCookie('options_terraformer', options.prm);
		} catch (e) {
			alert(e);
		}
	},

	save: function () {
		saveToCookie('options_terraformer', options.prm);
	},

	// ID технологии, стоимость мет, крис, дейт, коэфф-т удорожания
	techData: {33: [0, 50000, 100000, 2], 212: [0, 2000, 500, 1]},
	techId: 33
};

function resetParams() {
	options.prm.shipyardLevel = 1;
	options.prm.robotsFactoryLevel = 0;
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
	options.prm.tfSingleLevel = false;
	options.prm.tfLevelFrom = 0;
	options.prm.tfLevelTo = 0;
	options.prm.isCollector = false;
	options.prm.energyBoost = 0;
	options.prm.isTrader = false;
	options.prm.disChLevel = 0;
	options.prm.totalLFEnrgBonus = 0;
	
	$('#shipyard-level').val(options.prm.shipyardLevel);
	$('#robots-factory-level').val(options.prm.robotsFactoryLevel);
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
	$('#single-level')[0].checked = options.prm.tfSingleLevel;
	$('#tf-level-from').val(options.prm.tfLevel);
	$('#tf-level-to').val(options.prm.tfLevel);
	$('#class-collector')[0].checked = options.prm.isCollector;
	$('#energy-boost').val(options.prm.energyBoost);
	$('#trader-bonus')[0].checked = options.prm.isTrader;
	$('#disr-chamber-level').val(options.prm.disChLevel);
	$('#total-lf-energy-bonus').val(options.prm.totalLFEnrgBonus);
	updateNumbers();
}


function updateNumbers() {
	options.prm.shipyardLevel = getInputNumber($('#shipyard-level')[0]);
	options.prm.robotsFactoryLevel = getInputNumber($('#robots-factory-level')[0]);
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
	options.prm.isCollector = $('#class-collector')[0].checked;
	options.prm.energyBoost = $('#energy-boost')[0].value;
	options.prm.isTrader = $('#trader-bonus')[0].checked;
	options.prm.disChLevel = getInputNumber($('#disr-chamber-level')[0]);
	options.prm.totalLFEnrgBonus = getInputNumber($('#total-lf-energy-bonus')[0]);

	let solarPlantEnergy = Math.floor(0.01 * options.prm.solarPlantPercent * Math.floor(20 * options.prm.solarPlantLevel * Math.pow (1.1, options.prm.solarPlantLevel)));
	let fusionPlantEnergy = Math.floor(0.01 * options.prm.fusionPlantPercent * Math.floor(30 * options.prm.fusionPlantLevel * Math.pow (1.05 + options.prm.energyTechLevel * 0.01, options.prm.fusionPlantLevel)));
	let baseEnergyPerSat = 0.01*options.prm.solarSatellitesPercent * Math.floor ((options.prm.maxPlanetTemp + 140) / 6);
	let solarSatsEnergy = options.prm.solarSatellitesCount * baseEnergyPerSat>=0 ? options.prm.solarSatellitesCount * baseEnergyPerSat : 0;
	let totalEnergy = solarPlantEnergy + fusionPlantEnergy + solarSatsEnergy;
	
	let energyPerSat = baseEnergyPerSat;
	let officerBonus = 0;
	if (options.prm.energyBonus === 1) {
		officerBonus = Math.floor(0.1 * totalEnergy);
		energyPerSat += 0.1 * baseEnergyPerSat;
	} else if (options.prm.energyBonus === 2) {
		officerBonus = Math.floor(0.12 * totalEnergy);
		energyPerSat += 0.12 * baseEnergyPerSat;
	}
	var classEnergyBonus = options.prm.isCollector ? Math.floor(0.1 * totalEnergy) : 0;
	energyPerSat += options.prm.isCollector ? 0.1 * baseEnergyPerSat : 0;
	let boostEnergyBonus = Math.floor(0.1 * options.prm.energyBoost * totalEnergy);
	energyPerSat += 0.1 * options.prm.energyBoost * baseEnergyPerSat;
	let allianceEnergyBonus = options.prm.isTrader ? Math.floor(0.05 * totalEnergy) : 0;
	energyPerSat += options.prm.isTrader ? 0.05 * baseEnergyPerSat : 0;

	let disChEnergyBonus = Math.floor(options.prm.disChLevel * 0.015 * totalEnergy);
	energyPerSat += Math.floor(options.prm.disChLevel * 0.015 * baseEnergyPerSat);
	var lfTechBonus = Math.round(options.prm.totalLFEnrgBonus * 0.01 * totalEnergy);
	energyPerSat += 0.01 * options.prm.totalLFEnrgBonus * baseEnergyPerSat;
	
	$('#solar-plant-energy').text(numToOGame(Math.floor(solarPlantEnergy)));
	$('#fusion-plant-energy').text(numToOGame(Math.floor(fusionPlantEnergy)));
	$('#solar-satsellites-energy').text(numToOGame(Math.floor(solarSatsEnergy)));
	$('#officers-bonus-energy').text(numToOGame(officerBonus));
	$('#class-bonus-energy').text(numToOGame(classEnergyBonus));
	$('#alliance-bonus-energy').text(numToOGame(allianceEnergyBonus));
	$('#boost-bonus-energy').text(numToOGame(boostEnergyBonus));
	$('#disr-chamber-bonus-energy').text(numToOGame(disChEnergyBonus));
	$('#lf-tech-bonus-energy').text(numToOGame(lfTechBonus));

	let availableEnergy = Math.floor (solarPlantEnergy + fusionPlantEnergy + solarSatsEnergy
		+ officerBonus + classEnergyBonus + allianceEnergyBonus + boostEnergyBonus + disChEnergyBonus + lfTechBonus);
	$('#energy-produced').text(numToOGame(availableEnergy));
	
	options.prm.tfSingleLevel = $('#single-level')[0].checked;
	if (options.prm.tfSingleLevel) {
		$('#tf-level-from').hide();
		$('#level-spacer').hide();
	} else {
		$('#tf-level-from').show();
		$('#level-spacer').show();
	}
	options.prm.tfLevelFrom = getInputNumber($('#tf-level-from')[0]);
	options.prm.tfLevelTo = getInputNumber($('#tf-level-to')[0]);
	let tfLevelFrom = options.prm.tfSingleLevel ? (options.prm.tfLevelTo - 1) : options.prm.tfLevelFrom;
	let tfLevelTo = options.prm.tfLevelTo
	
	let addedFields = 0;
	if (tfLevelTo > 0)
		for (let i = tfLevelFrom+1; i <= tfLevelTo; i++)
			addedFields += (i % 2 === 0) ? 5 : 4;
	$('#added-fields').text(addedFields);
	
	$('#energy-needed').text(numToOGame(getBuildEnergyCost_C(options.techId, tfLevelTo, options.techData)));
	
	let missingEnergy = getBuildEnergyCost_C(options.techId, tfLevelTo, options.techData) - availableEnergy;
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

	let neededSats = Math.ceil (missingEnergy / energyPerSat);
	$('#solar-satellites-needed').text(numToOGame(neededSats));

	let tfCost = getBuildCost_C(options.techId, tfLevelFrom, tfLevelTo, options.techData);
	
	let crysNeeded = tfCost[1];
	$('#crystal-required-tf').text(numToOGame(crysNeeded));
	let deutNeeded = tfCost[2];
	$('#deuterium-required-tf').text(numToOGame(deutNeeded))
	
	let secsTF = getBuildTime_C(options.techId, tfLevelFrom, tfLevelTo, options.techData, options.prm.robotsFactoryLevel, options.prm.nanitesFactoryLevel, 0, 0, 0, options.prm.universeSpeed);
	$('#time-required-tf').text(timespanToShortenedString(secsTF, options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, false));
	
	crysNeeded = neededSats * 2000;
	$('#crystal-required-ss').text(numToOGame(crysNeeded));
	deutNeeded = neededSats * 500;
	$('#deuterium-required-ss').text(numToOGame(deutNeeded));

	let secsSS = getBuildTime_C(212, 0, neededSats, options.techData, 0, options.prm.nanitesFactoryLevel, 0, 0, options.prm.shipyardLevel, options.prm.universeSpeed);
	$('#time-required-ss').text(timespanToShortenedString(secsSS, options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, false));
	
	crysNeeded = neededSats * 2000 + tfCost[1];
	$('#crystal-required-total').text(numToOGame(crysNeeded));
	deutNeeded = neededSats * 500 + tfCost[2];
	$('#deuterium-required-total').text(numToOGame(deutNeeded));

	let sumResources = crysNeeded + deutNeeded;
	var classBonus = options.prm.isCollector ? 1.25 : 1;
	var capSC = 5000.0 * (1 + 0.05 * options.prm.hyperTechLevel) * classBonus;
	var capLC = 25000.0 * (1 + 0.05 * options.prm.hyperTechLevel) * classBonus;
	let lcNeeded = Math.ceil (sumResources / capLC);
	let scNeeded = Math.ceil (sumResources / capSC);
	$('#cargoes').text(numToOGame(scNeeded)+' '+options.scShort+' / '+numToOGame(lcNeeded)+' '+options.lcShort);

	
	options.save();
}

$(document).ready(function() {
	options.load();
//	consoleLog(options.prm);
	$('#shipyard-level').val(options.prm.shipyardLevel);
	$('#robots-factory-level').val(options.prm.robotsFactoryLevel);
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
	$('#single-level')[0].checked = options.prm.tfSingleLevel;
	$('#tf-level-from').val(options.prm.tfLevelFrom);
	$('#tf-level-to').val(options.prm.tfLevelTo);
	$('#class-collector')[0].checked = options.prm.isCollector;
	$('#energy-boost').val(options.prm.energyBoost);
	$('#trader-bonus')[0].checked = options.prm.isTrader;
	$('#disr-chamber-level').val(options.prm.disChLevel);
	$('#total-lf-energy-bonus').val(options.prm.totalLFEnrgBonus);

	$('input').focusin(function() {
		$(this).addClass('ui-state-focus');
	});
	$('input').focusout(function() {
		$(this).removeClass('ui-state-focus');
	});

	$('#shipyard-level').data('constrains', {'min': 1, 'def': 1});
	$('#max-planet-temp').data('constrains', {'min': -134, 'def': 0, 'allowNegative': true});

	// После того, как событие будет обработано, нужно вызвать функцию пересчета. Её имя передаём в поле data событий.
	$('#terraformer input:text').keyup('updateNumbers', validateInputNumber);
	$('#terraformer input:text').blur('updateNumbers', validateInputNumberOnBlur);
	$('#terraformer select').keyup(updateNumbers);
	$('#terraformer select').change(updateNumbers);
	$('#terraformer select').mousemove(updateNumbers);
	$('#general-settings input:radio').change(function(ev) { updateNumbers(); });
	$('#reset').click(resetParams);
	$('#single-level').click(updateNumbers);
	$('#class-collector').click(updateNumbers);
	$('#trader-bonus').click(updateNumbers);

	let theme = { value: 'light', validate: function(key, val) { return val; } };
	loadFromCookie('theme', theme);
	toggleLight(theme.value === 'light');
	$('#cb-light-theme').click(function(){toggleLight($('#cb-light-theme')[0].checked);});
	
	updateNumbers();
});
