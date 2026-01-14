var options = {
	prm: {
		universeSpeed: 0,
        highTop: 40000,
        playerClass: 0,
        hyperTechLevel: 0,
        percentRes: 0,
        percentShips: 0,
        classBonusCollector: 0,
        classBonusDiscoverer: 0,
    darkMatterDiscoveryBonus: 0,
    resourceDiscoveryBooster: 5,
        fleet: '{"202":0,"203":0,"204":0,"205":0,"206":0,"207":0,"208":0,"209":0,"210":0,"211":0,"213":0,"214":0,"215":0,"218":0,"219":0}',
		lfShipsBonuses: [],
		
		validate: function(field, value) {
			switch (field) {
				case 'universeSpeed': return validateNumber(parseFloat(value), 0, 10, 0);
				case 'highTop': return validateNumber(parseFloat(value), 40000, 5000000, 40000);
				case 'playerClass': return validateNumber(parseFloat(value), 0, 2, 0);
				case 'hyperTechLevel': return validateNumber(parseFloat(value), 0, 999, 0);
				case 'percentRes': return validateNumber(parseFloat(value), 0, 999, 0);
				case 'percentShips': return validateNumber(parseFloat(value), 0, 999, 0);
                case 'classBonusCollector': return validateNumber(parseFloat(value), 0, 999, 0);
                case 'classBonusDiscoverer': return validateNumber(parseFloat(value), 0, 999, 0);
                case 'darkMatterDiscoveryBonus': return validateNumber(parseFloat(value), 0, 9999, 0);
                case 'resourceDiscoveryBooster': return validateNumber(parseFloat(value), 0, 40, 5);
                case 'fleet': return isValidJSONObject(value.replaceAll("~", ",")) ? value.replaceAll("~", ",") : '{"202":0,"203":0,"204":0,"205":0,"206":0,"207":0,"208":0,"209":0,"210":0,"211":0,"213":0,"214":0,"215":0,"218":0,"219":0}';
				case 'lfShipsBonuses': return validateNumber(parseFloat(value), 0, Infinity, 0);
				default: return value;
			}
		} 
	},
		
	load: function() {
		try {
			loadFromCookie('options_expeditions', options.prm);
			if (options.prm.lfShipsBonuses == undefined || options.prm.lfShipsBonuses.length != 15) {
				options.prm.lfShipsBonuses = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
			}
		} catch(e) {
			alert(e);
		}
	},

	save: function() {
		saveToCookie('options_expeditions', options.prm);
	}
};

String.prototype.stripSlashes = function(){
    return this.replace(/\\(.)/mg, "$1");
}
   
function isValidJSONObject(str) {
    try {
        const result = JSON.parse(str.stripSlashes());
        return result && typeof result === 'object';
    } catch (e) {
        return false;
    }
}

function resetParams() {
	options.prm.universeSpeed = 0;
    options.prm.highTop = 40000;
    options.prm.playerClass = 0;
    options.prm.hyperTechLevel = 0;
    options.prm.percentRes = 0;
    options.prm.percentShips = 0;
    options.prm.classBonusCollector = 0;
    options.prm.classBonusDiscoverer = 0;
    options.prm.lfShipsBonuses = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    options.prm.darkMatterDiscoveryBonus = 0;
    options.prm.resourceDiscoveryBooster = 0;

	$('#universe-speed')[0].selectedIndex = options.prm.universeSpeed;
    $("#highTop").val(options.prm.highTop);
    $("#player-class").val(options.prm.playerClass);
    $("#tech_hyper-level").val(options.prm.hyperTechLevel);
    $("#percent-resources").val(options.prm.percentRes);
    $("#percent-ships").val(options.prm.percentShips);
    $("#class-bonus-collector").val(options.prm.classBonusCollector);
    $("#class-bonus-discoverer").val(options.prm.classBonusDiscoverer);
    $("#dark-matter-discovery-bonus").val(options.prm.darkMatterDiscoveryBonus);
    $("#resource-discovery-booster").val(options.prm.resourceDiscoveryBooster);
	$('#lf-ships-bonuses input:text').val(0);

    clearFleet();
    createFleetJSON();

    compute();
}

const fleetCodeMapping = {
    "SC": "202",
    "LC": "203",
    "LF": "204",
    "HF": "205",
    "CR": "206",
    "BS": "207",
    "CS": "208",
    "RC": "209",
    "EP": "210",
    "BM": "211",
    "DR": "213",
    "DS": "214",
    "BC": "215",
    "RE": "218",
    "PA": "219"
};
//	сокращение, скорость, тип двигателя, потр.дейтерия, грузоподъёмность
const shipsData = [
    ['small-cargo', 5000, 0, 10, 5000, 'SC'],		// 0
    ['large-cargo', 7500, 0, 50, 25000, 'LC'],  	// 1
    ['light-fighter', 12500, 0, 20, 50, 'LF'],  	// 2
    ['heavy-fighter', 10000, 1, 75, 100, 'HF'], 	// 3
    ['cruiser', 15000, 1, 300, 800, 'CR'],		    // 4
    ['battleship', 10000, 2, 500, 1500, 'BS'],	    // 5
    ['colony-ship', 2500, 1, 1000, 7500, 'CS'],	    // 6
    ['recycler', 2000, 0, 300, 20000, 'RC'],		// 7
    ['esp-probe', 100000000, 0, 1, 0, 'EP'],		// 8
    ['bomber', 4000, 1, 700, 500, 'BM'],			// 9
    ['destroyer', 5000, 2, 1000, 2000, 'DR'],		// 10
    ['death-star', 100, 2, 1, 1000000, 'DS'],		// 11
    ['battlecruiser', 10000, 2, 250, 750, 'BC'],	// 12
    ['reaper', 7000, 2, 1100, 10000, 'RE'],		    // 13
    ['pathfinder', 12000, 2, 300, 10000, 'PA']	    // 14
];
const shipProperties = [
    ["RC", 16E3],
    ["CS", 3E4],
    ["DS", 9E6],
    ["EP", 1E3],
    ["SC", 4E3],
    ["LF", 4E3],
    ["LC", 12E3],
    ["HF", 1E4],
    ["CR", 27E3],
    ["PA", 23E3],
    ["BS", 6E4],
    ["BC", 7E4],
    ["BM", 75E3],
    ["DR", 11E4],
    ["RE", 14E4]
];

function createFleetJSON() {
    const jsonData = {};
    const inputs = document.querySelectorAll('#data-table input[id]');
    
    inputs.forEach(input => {
        const inputId = input.id;
        const abbreviation = inputId.replace('num', '');
        const code = fleetCodeMapping[abbreviation];        
        if (code) {
            const value = Number.parseInt(input.value) || 0;
            jsonData[code] = value;
        }
    });
    return jsonData;
}

function populateInputsFromJSON(jsonData) {
    const reverseMapping = Object.fromEntries(
        Object.entries(fleetCodeMapping).map(([abbr, code]) => [code, abbr])
    );    
    Object.entries(jsonData).forEach(([code, value]) => {
        const abbreviation = reverseMapping[code];        
        if (abbreviation) {
            const input = document.getElementById(`num${abbreviation}`);
            if (input) {
                input.value = value;
            }
        }
    });
}

function clearFleet() {
    for (var a in shipProperties) $("#num" + shipProperties[a][0]).val(0);
    compute()
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
			options.prm.lfShipsBonuses[j] = Number.parseFloat(lines[scLineIdx + i * 8 + 4].replace('%', '').replace('-', '0'));
			if (i == 9 || i == 13) i++; // пропустим лампочку и краулер
			j++;
		}
		let rows = $('#lf-ships-bonuses tr');
		for (let i = 1; i <= options.prm.lfShipsBonuses.length; i++) {
			rows[i].children[1].children[0].value = options.prm.lfShipsBonuses[i-1];
		}
	} catch (e) {
		alert(e);
		return false;
	};
	return true;
}

function getCargoCapacity(singleShipAbbrev) {
	let capacity = 0;
	let i;

    // If a specific ship abbreviation was requested, compute capacity for one ship of that type
    if (singleShipAbbrev) {
        const idx = shipsData.findIndex(s => s[5] === singleShipAbbrev);
        if (idx === -1) return 0;
        i = idx;

        const shipCount = 1;
        let increment = shipCount * (shipsData[i][4] * (1 + 0.05 * options.prm.hyperTechLevel));
        // Collector class bonus for transporters (SC and LC are i < 2)
        if (options.prm.playerClass === 1 && i < 2) {
            increment += Math.floor(shipCount * (shipsData[i][4]) * 0.25 * (1 + options.prm.classBonusCollector * 0.01));
        }
        const bonus = (typeof options.prm.lfShipsBonuses[i] === 'number' && !isNaN(options.prm.lfShipsBonuses[i])) ? options.prm.lfShipsBonuses[i] : 0;
        increment += Math.floor(shipCount * shipsData[i][4] * bonus * 0.01);
        return Math.floor(increment);
    }

    // existing total capacity calculation
    for(i = 0; i < shipsData.length; i++)
    {
        let shipCount = getInputNumber($('#num'+shipsData[i][5])[0]);
		if (shipCount > 0) {
			let increment = shipCount*(shipsData[i][4] * (1 + 0.05 * options.prm.hyperTechLevel));
			if (options.prm.playerClass === 1 && i < 2) { // Collector's transporters have 25% more capacity
				increment += Math.floor(shipCount*(shipsData[i][4]) * 0.25 * (1 + options.prm.classBonusCollector * 0.01));
			}
			if (options.prm.playerClass === 2 && (i === 7 || i === 14)) { // General's Recyclers and Pathfinders have 20% more cargo space
				increment += shipCount*(shipsData[i][4]) * 0.2;
			}
            const bonus = (typeof options.prm.lfShipsBonuses[i] === 'number' && !isNaN(options.prm.lfShipsBonuses[i])) ? options.prm.lfShipsBonuses[i] : 0;
            increment += Math.floor(shipCount * shipsData[i][4] * bonus * 0.01); // data is shown in percents
			capacity += increment;
		}
	}

	return Math.floor(capacity);
}

function compute() {
    var a = $("#player-class")[0].selectedIndex,
        c = $("#player-class")[0].options[a].value;
    options.prm.playerClass = Number(c);
    a = $("#universe-speed")[0].selectedIndex;
    var b = Number.parseInt($("#universe-speed")[0].options[a].text, 10);
    options.prm.universeSpeed = b;
    a = getInputNumber($("#tech_hyper-level")[0]);
    options.prm.hyperTechLevel = a;
    // Loading from storage will include parsing and splitting key-value pairs by ','
    options.prm.fleet = JSON.stringify(createFleetJSON()).replaceAll(",", "~");

    // Read current bonuses from form inputs into internal array
    let rows = $('#lf-ships-bonuses tr');
	for (let i = 1; i <= options.prm.lfShipsBonuses.length; i++) {
		options.prm.lfShipsBonuses[i-1] = getInputNumber(rows[i].children[1].children[0]);
	}

    // read percent/resources/ships and new class bonuses
    var percentResources = getInputNumber($("#percent-resources")[0]);
    options.prm.percentRes = percentResources;
    var percentShips = getInputNumber($("#percent-ships")[0]);
    options.prm.percentShips = percentShips;

    var classBonusCollector = getInputNumber($("#class-bonus-collector")[0]);
    options.prm.classBonusCollector = classBonusCollector;
    var classBonusDiscoverer = getInputNumber($("#class-bonus-discoverer")[0]);
    options.prm.classBonusDiscoverer = classBonusDiscoverer;

    // New parameters
    var darkMatterDiscoveryBonus = getInputNumber($("#dark-matter-discovery-bonus")[0]);
    options.prm.darkMatterDiscoveryBonus = darkMatterDiscoveryBonus;
    var resourceDiscoveryBooster = Number.parseInt($("#resource-discovery-booster")[0].value, 10) || 0;
    options.prm.resourceDiscoveryBooster = resourceDiscoveryBooster;

    var totalCapacity = getCargoCapacity();
    var e = a = 0,
        g = 0,
        h = 0 < getInputNumber($("#numPA")[0]),
        d;

    for (d in shipProperties) {
        $("#can" + shipProperties[d][0]).text(LOCA_NO);
        $("#can" + shipProperties[d][0]).attr("class", "");
    }
    for (d = 0; d < shipProperties.length; d++) {
        var f = Number.parseInt($("#num" + shipProperties[d][0])[0].value, 10);
        if (2 < d && 0 < f) {
            for (j = 3; j <= d; j++) {
                $("#can" + shipProperties[j][0]).text(LOCA_YES);
                $("#can" + shipProperties[j][0]).attr("class", "bolder-label");
            }
            if (d < shipProperties.length - 1) {
                $("#can" + shipProperties[j][0]).text(LOCA_YES);
                $("#can" + shipProperties[j][0]).attr("class", "bolder-label");
                g = Math.max(g, shipProperties[j][1]);
            } else {
                g = Math.max(g, shipProperties[d][1]);
            }
        }
    }
    a = e = totalCapacity;
    
    f = $("#highTop")[0].selectedIndex;
    d = Number.parseInt($("#highTop")[0].options[f].value, 10);
    options.prm.highTop = d;
    f = 1;
    if (h) { // there are Pathfinders in the fleet
        if (c == 0) // player is a Discoverer
            c = 3 * b;
        else
            c = 2;
    } else {
        if (c == 0)
            c = 1.5 * b;
        else
            c = 1;
    }
    b = c * d;
    var discovererBonus = options.prm.playerClass === 0 ? (1 + classBonusDiscoverer / 100) : 1;

    // compute max points (value shown before parentheses)
    var maxPointsValue = Math.floor(b * (1 + percentResources/100) * discovererBonus);

    // get capacity of a single Large Cargo (LC) taking into account hypertech & bonuses
    var singleLCCap = getCargoCapacity('LC');
    var minLC = (singleLCCap > 0) ? Math.ceil(maxPointsValue / singleLCCap) : 0;

    // show max points and minimal LC count in parentheses
    $("#max_points")[0].innerHTML = numToOGame(maxPointsValue) + " (" + minLC + " " + options.largeCargoAbbrev + ")";

    d = Math.max(1E3 * b, 2E5);
    c = 0 == g ? 0 : Math.max(Math.min(e, b), 1E4);
    0 == e && (c = 0);
    d *= .001;
    d = d * (1 +  percentResources/100) * discovererBonus * (1 + resourceDiscoveryBooster/100);
    g = Math.floor(Math.min(d, a));
    b = Math.floor(Math.min(d / 2, a));
    h = Math.floor(Math.min(d / 3, a));
    $("#storageCapacity").text(numToOGame(a));
    $("#storageCapacity").css("font-style", d > a ? "italic" : "normal");   
    $("#maxFindMet").text(0 < e ? numToOGame(g) : "0");
    $("#maxFindCry").text(0 < e ? numToOGame(b) : "0");
    $("#maxFindDeu").text(0 < e ? numToOGame(h) : "0");
    for (d = 3; d < shipProperties.length; d++) {
        a = $("#can" + shipProperties[d][0]).text() == LOCA_NO ? 0 : numToOGame(Math.floor(c / shipProperties[d][1] + c / shipProperties[d][1] * percentShips / 100));
        $("#find" + shipProperties[d][0]).text(a);
        $("#find" + shipProperties[d][0]).attr("class", 0 < a ? "bolder-label" : "");
    }
    $("#darkMatterFind").text(numToOGame(Math.floor(1800 * f * (1 + darkMatterDiscoveryBonus/100))));

    options.save();
}

jQuery(function($) {
    if ([api_hightop_idx, api_universe_speed, api_player_class, api_hypertech_level,
        api_percent_res, api_percent_ships, api_fleet,
        api_class_bonus_collector, api_class_bonus_discoverer,
        api_resource_discovery_booster, api_dark_matter_discovery_bonus].some(Boolean)) {
        resetParams();
        if (api_hightop_idx) $('#highTop')[0].selectedIndex = api_hightop_idx;
        if (api_universe_speed) $('#universe-speed').val(api_universe_speed);
        if (api_player_class) $("#player-class").val(api_player_class);
        if (api_hypertech_level) $("#tech_hyper-level").val(api_hypertech_level);
        if (api_percent_res) $("#percent-resources").val(localizeFloat(api_percent_res));
        if (api_percent_ships) $("#percent-ships").val(localizeFloat(api_percent_ships));
        if (typeof api_class_bonus_collector !== 'undefined' && api_class_bonus_collector) $("#class-bonus-collector").val(localizeFloat(api_class_bonus_collector));
        if (typeof api_class_bonus_discoverer !== 'undefined' && api_class_bonus_discoverer) $("#class-bonus-discoverer").val(localizeFloat(api_class_bonus_discoverer));
        if (typeof api_resource_discovery_booster !== 'undefined' && api_resource_discovery_booster) $("#resource-discovery-booster").val(api_resource_discovery_booster);
        if (typeof api_dark_matter_discovery_bonus !== 'undefined' && api_dark_matter_discovery_bonus) $("#dark-matter-discovery-bonus").val(localizeFloat(api_dark_matter_discovery_bonus));
        if (api_fleet) populateInputsFromJSON(api_fleet); // no parsing because it's a ready-made JSON
    } else {
	    options.load();
        $('#universe-speed').val(options.prm.universeSpeed);
        $("#highTop").val(options.prm.highTop);
        $("#player-class").val(options.prm.playerClass);
        $("#tech_hyper-level").val(options.prm.hyperTechLevel);
        $("#percent-resources").val(localizeFloat(options.prm.percentRes));
        $("#percent-ships").val(localizeFloat(options.prm.percentShips));
        $("#class-bonus-collector").val(localizeFloat(options.prm.classBonusCollector));
        $("#class-bonus-discoverer").val(localizeFloat(options.prm.classBonusDiscoverer));
        $("#dark-matter-discovery-bonus").val(localizeFloat(options.prm.darkMatterDiscoveryBonus));
        $("#resource-discovery-booster").val(options.prm.resourceDiscoveryBooster);
        populateInputsFromJSON(JSON.parse(options.prm.fleet));
    }

	$( "#lf-bonuses-accordion" ).accordion({
		autoHeight: false,
		collapsible: true,
		active: 1
	});
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
    
    $("#open-lfbr").button();
	$('#open-lfbr').click(function() {
		$("#lf-bonuses-reader").dialog("option", "execute", false);
		$("#lf-bonuses-reader").dialog("open");
	});

    $("#api-accordion").accordion({
		autoHeight: false,
		collapsible: true,
		active: 1
	});	

	$('#reset').click(resetParams);

    document.getElementById('percent-resources')._constrains = {'min': 0, 'max': 999, 'def': 0, 'allowNegative': false, 'allowFloat': true};
    document.getElementById('percent-ships')._constrains = {'min': 0, 'max': 999, 'def': 0, 'allowNegative': false, 'allowFloat': true};
    document.getElementById('class-bonus-collector')._constrains = {'min': 0, 'max': 999, 'def': 0, 'allowNegative': false, 'allowFloat': true};
    document.getElementById('class-bonus-discoverer')._constrains = {'min': 0, 'max': 999, 'def': 0, 'allowNegative': false, 'allowFloat': true};
    document.getElementById('dark-matter-discovery-bonus')._constrains = {'min': 0, 'max': 9999, 'def': 0, 'allowNegative': false, 'allowFloat': true};
    $('#lf-ships-bonuses input:text').each(function() {
        this._constrains = {'min': 0, 'max': Infinity, 'def': 0, 'allowNegative': false, 'allowFloat': true};
    });

	// После того, как событие будет обработано, нужно вызвать функцию пересчета. Её имя передаём в поле data событий.
    $('#settings-panel input:text').keyup('compute', validateInputNumber);
    $('#settings-panel input:text').blur('compute', validateInputNumberOnBlur);
	
	$('#data-table input:text').keyup('compute', validateInputNumber);
	$('#data-table input:text').blur('compute', validateInputNumberOnBlur);
    
	$('#settings-panel select').keyup(compute);
	$('#settings-panel select').change(compute);
	
    let rows = $('#lf-ships-bonuses tr');
	for (let i = 1; i <= options.prm.lfShipsBonuses.length; i++) {
		rows[i].children[1].children[0].value = localizeFloat(options.prm.lfShipsBonuses[i-1]);
	}

    compute();
    
	let theme = { value: 'light', validate: function(key, val) { return val; } };
	loadFromCookie('theme', theme);
	toggleLight(theme.value === 'light');
	$('#cb-light-theme').click(function(){toggleLight($('#cb-light-theme')[0].checked);});
});
