var options = {
	shipsData: [
			['small-cargo', 2000, 2000, 0],
			['large-cargo', 6000, 6000, 0],
			['light-fighter', 3000, 1000, 0],
			['heavy-fighter', 6000, 4000, 0],
			['cruiser', 20000, 7000, 2000],
			['battleship', 45000, 15000, 0],
			['colony-ship', 10000, 20000, 10000],
			['recycler', 10000, 6000, 2000],
			['esp-probe', 0, 1000, 0],
			['bomber', 50000, 25000, 15000],
			['destroyer', 60000, 50000, 15000],
			['death-star', 5000000, 4000000, 1000000],
			['battlecruiser', 30000, 40000, 15000],
			['reaper', 85000, 55000, 20000],
			['pathfinder', 8000, 15000, 8000]
			],

	defConstraints: {
				min: null,
				max: null,
				def: 0,
				allowFloat: false,
				allowNegative: false
			},
	prm: {
		moonSize: 1,
		dsCount: 1,
		debrisPercent: 30,
		hyperTechLvl: 0,
		
		validate: function(field, value) {
			switch (field) {
				case 'moonSize': return validateNumber(parseFloat(value), 1, 1000, 1);
				case 'dsCount': return validateNumber(parseFloat(value), 1, Infinity, 1);
				case 'debrisPercent': return validateNumber(parseFloat(value), 0, 40, 100);
				case 'hyperTechLvl': return validateNumber(parseFloat(value), 0, 50, 0);
				default: return value;
			}
		} 
	},
		
	load: function() {
		try {
			loadFromCookie('options_moon', options.prm);
		} catch(e) {
			alert(e);
		}
	},

	save: function() {
		saveToCookie('options_moon', options.prm);
	}
};

function resetDestroyParams() {
	options.prm.moonSize = 1;
	options.prm.dsCount = 1;

	$('#moon-size').val(options.prm.moonSize);
	$('#ds-count').val(options.prm.dsCount);
	
	updateNumbers();
}

function resetCreateParams() {
	options.prm.debrisPercent = 30;
	options.prm.hyperTechLvl = 0;
	
	for(i = 0; i < options.shipsData.length; i++)
	{
		$('#'+options.shipsData[i][0]).val(0);
	}
	$('#debris-percent').val(options.prm.debrisPercent);
	$('#hypertech-lvl').val(options.prm.hyperTechLvl);
	updateNumbers();
}

function updateNumbers() {
	options.prm.moonSize = getInputNumber($('#moon-size')[0]);
	options.prm.dsCount = getInputNumber($('#ds-count')[0]);
	options.prm.debrisPercent = getInputNumber($('#debris-percent')[0]);
	options.prm.hyperTechLvl = getInputNumber($('#hypertech-lvl')[0]);
	options.save();

	if (options.prm.moonSize < 0)
		options.prm.moonSize = 0;
	if (options.prm.dsCount < 0)
		options.prm.dsCount = 0;
	var destroyChance = (100 - Math.sqrt(options.prm.moonSize)) * Math.sqrt(options.prm.dsCount);
	destroyChance = clampNumber(destroyChance, 0, 100);
	$('#moon-destroy-chance').text(dropFraction(0.01 * Math.round(100 * destroyChance), 2));
	var blowChance = 0.5 * Math.sqrt(options.prm.moonSize);
	blowChance = clampNumber(blowChance, 0, 100);
	$('#ds-blow-chance').text(dropFraction(0.01 * Math.round(100 * blowChance), 2));
	
	var shipCount = 0;
	var shipResources = 0;
	var totalResources = [0, 0, 0];
	for(i = 0; i < options.shipsData.length; i++)
	{
		// в shipsData[i][0] у нас сокращение - оно же имя поля для ввода количества кораблей
		shipCount = 1 * getInputNumber($('#'+options.shipsData[i][0])[0]);
		shipResources = options.shipsData[i];
		$('#'+options.shipsData[i][0]+'-max').text(Math.ceil(2000000.0/((shipResources[1]+shipResources[2]) * 0.01 * options.prm.debrisPercent)));
		totalResources[0] += shipCount * shipResources[1];
		totalResources[1] += shipCount * shipResources[2];
		totalResources[2] += shipCount * shipResources[3];
	}
	totalRes = totalResources[0] + totalResources[1];
	var createChance = (totalRes==0) ? 0 : clampNumber((totalRes * 0.01 * options.prm.debrisPercent)/10000000.0, 0, 0.20);
	$('#moon-create-chance').text(dropFraction(createChance*100, 2)+'%');
	
	$('#metal-required').text(numToOGame(totalResources[0]));
	$('#crystal-required').text(numToOGame(totalResources[1]));
	$('#deuterium-required').text(numToOGame(totalResources[2]));
	
	$('#metal-recyclable').text(numToOGame(totalResources[0] * 0.01 * options.prm.debrisPercent));
	$('#crystal-recyclable').text(numToOGame(totalResources[1] * 0.01 * options.prm.debrisPercent));
	
	var recycleableRes = (totalResources[0] + totalResources[1]) * 0.01 * options.prm.debrisPercent;
	var cargoSpace = Math.round(20000 * (1 + 0.05 * options.prm.hyperTechLvl));
	var rcNeeded = Math.ceil (recycleableRes / cargoSpace);
	$('#recyclers').text(numToOGame(rcNeeded));
}

$(document).ready(function() {
	options.load();
//	consoleLog(options.prm);
	$('#moon-size').val(options.prm.moonSize);
	$('#ds-count').val(options.prm.dsCount);
	$('#debris-percent').val(options.prm.debrisPercent);
	$('#ds-count').val(options.prm.dsCount);
	$('#hypertech-lvl').val(options.prm.hyperTechLvl);

	$('input').focusin(function() {
		$(this).addClass('ui-state-focus');
	});
	$('input').focusout(function() {
		$(this).removeClass('ui-state-focus');
	});

	$('#moon-size').data('constrains', {'min': 1, 'max': 10000, 'def': 1});
	$('#ds-count').data('constrains', {'min': 1, 'def': 1});

	// После того, как событие будет обработано, нужно вызвать функцию пересчета. Её имя передаём в поле data событий.
	$('#moon input:text').keyup('updateNumbers', validateInputNumber);
	$('#moon input:text').blur('updateNumbers', validateInputNumberOnBlur);
	$('#moon select').keyup(updateNumbers);
	$('#moon select').change(updateNumbers);
	$('#moon select').mousemove(updateNumbers);
	$('#reset-ds').click(resetDestroyParams);
	$('#reset-cr').click(resetCreateParams);

	var theme = $.cookie("theme");
	toggleLight(theme == 'light');
	$('#cb-light-theme').click(function(){toggleLight($('#cb-light-theme')[0].checked);});
	
	updateNumbers();
});
