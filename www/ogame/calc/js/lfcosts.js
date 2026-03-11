let options = {
    defConstraints: {
        min: -Infinity,
        max: Infinity,
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

        validate: function (field, value) {
            switch (field) {
                case 'robotFactoryLevel': return validateNumber(parseFloat(value), 0, 100, 0);
                case 'naniteFactoryLevel': return validateNumber(parseFloat(value), 0, 100, 0);
                case 'universeSpeed': return validateNumber(parseFloat(value), 1, 10, 1);
                case 'ionTechLevel': return validateNumber(parseFloat(value), 0, 50, 0);
                case 'hyperTechLevel': return validateNumber(parseFloat(value), 0, 50, 0);
                case 'playerClass': return validateNumber(parseFloat(value), 0, 2, 0);
                case 'fullNumbers': return value === 'true';
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

    load: function () {
        try {
            loadFromCookie('options_lfcosts', options.prm);
        } catch (e) {
            alert(e);
        }
    },

    save: function () {
        saveToCookie('options_lfcosts', options.prm);
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

    document.getElementById('robot-factory-level').value = options.prm.robotFactoryLevel;
    document.getElementById('nanite-factory-level').value = options.prm.naniteFactoryLevel;
    document.getElementById('universe-speed').selectedIndex = options.prm.universeSpeed;
    document.getElementById('ion-tech-level').value = options.prm.ionTechLevel;
    document.getElementById('hyper-tech-level').value = options.prm.hyperTechLevel;
    document.getElementById('sc-capacity-increase').value = options.prm.capIncrSC;
    document.getElementById('lc-capacity-increase').value = options.prm.capIncrLC;
    document.getElementById('megalith-level').value = options.prm.megalithLvl;
    document.getElementById('mrc-level').value = options.prm.mineralResCntrLvl;
    document.getElementById('research-cost-reduction').value = options.prm.researchCostReduction;
    document.getElementById('research-time-reduction').value = options.prm.researchTimeReduction;

    for (let outer = 0; outer < 2; outer++) {
        let innerNums = [1, 2];
        for (let innerIdx = 0; innerIdx < innerNums.length; innerIdx++) {
            let inner = innerNums[innerIdx];
            let rows = document.querySelectorAll('#table-' + outer + '-' + inner + ' tr');
            for (let row = 1; row < rows.length - footerRows; row++) {
                rows[row].children[2].children[0].value = 0;
                if (outer === 1)
                    rows[row].children[3].children[0].value = 0;
                let firstDataCol = (outer === 1) ? 4 : 3;
                for (let cell = firstDataCol; cell < firstDataCol + (outer === 0 ? 6 : 5); cell++) {
                    if (cell === firstDataCol + 3)
                        rows[row].children[cell].innerHTML = '0' + options.datetimeS;
                    else
                        rows[row].children[cell].innerHTML = '0';
                }
                let techID = Number(rows[row].children[0].innerHTML);
                if ([1002, 2002, 3002, 4002].includes(techID)) {
                    const hintEl = rows[row].children[1].querySelector('.energy-cost-hint');
                    if (hintEl) {
                        const existing = bootstrap.Tooltip.getInstance(hintEl);
                        if (existing) existing.dispose();
                        hintEl.setAttribute('title', options.energyCostToBuildLabel + ': 0');
                        new bootstrap.Tooltip(hintEl);
                    }
                }
            }
        }
    }
    Object.entries(options.techData).forEach(([key]) => {
        options.techData[key] = null;
    });

    document.getElementById('tech-types-select').value = 1;
    document.getElementById('tab2-from-level').value = 0;
    document.getElementById('tab2-to-level').value = 0;

    document.getElementById('class-' + options.prm.playerClass).checked = true;
    document.getElementById('full-numbers').checked = false;
    for (let outer = 0; outer < 3; outer++) {
        for (let inner = 1; inner < 3; inner++) {
            const mEl = document.getElementById(`metal-available-${outer}-${inner}`);
            const cEl = document.getElementById(`crystal-available-${outer}-${inner}`);
            const dEl = document.getElementById(`deut-available-${outer}-${inner}`);
            if (mEl) mEl.value = 0;
            if (cEl) cEl.value = 0;
            if (dEl) dEl.value = 0;
        }
    }

    updateTotals();
    updateOneMultTab();
}

// Обновляет данные по строке, в которой сделано изменение и записывает изменённые значения в глобальный массив рассчитанных значений
function updateRow() {
    let techID = Number(this.parentNode.parentNode.children[0].innerHTML);
    if (!(techID > 0))
        return;
    let row = this.parentNode.parentNode;
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
        techLevelFrom = 1 * row.children[2].children[0].value;
        techLevelTo = 1 * row.children[3].children[0].value;
        firstDataCol = 4;
    } else {
        techLevelTo = 1 * row.children[2].children[0].value;
        techLevelFrom = techLevelTo === 0 ? 0 : techLevelTo - 1;
        firstDataCol = 3;
    }
    const rsrCostRdc = getInputNumber(document.getElementById('research-cost-reduction'));
    const ionTechLevel = (techLevelTo > techLevelFrom) ? 0 : getInputNumber(document.getElementById('ion-tech-level'));
    var bldCostRdc = Number(document.getElementById('race-selector').value) === 2 ? 0.01 * getInputNumber(document.getElementById('megalith-level')) : 0;
    const reductables = [1, 2, 3, 4, 12, 2001, 2002];
    const mrcRdc = Number(document.getElementById('race-selector').value) === 2 ? 0.005 * getInputNumber(document.getElementById('mrc-level')) : 0;
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
        row.children[firstDataCol].innerHTML = ogamizeNum(resCost[0], options.unitSuffix);
        row.children[firstDataCol + 1].innerHTML = ogamizeNum(resCost[1], options.unitSuffix);
        row.children[firstDataCol + 2].innerHTML = ogamizeNum(resCost[2], options.unitSuffix);
        row.children[firstDataCol + 3].innerHTML = timespanToShortenedString(timeSpan, options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true);
        row.children[firstDataCol + 4].innerHTML = ogamizeNum(points, options.unitSuffix);
        if (outerTab === 0) {
            let tmCost = getHalvingCost(techID, timeSpan);
            row.children[firstDataCol + 5].innerHTML = ogamizeNum(tmCost, options.unitSuffix);
        }
        if ([1002, 2002, 3002, 4002].includes(techID)) {
            const hintEl = row.children[1].querySelector('.energy-cost-hint');
            if (hintEl) {
                const tooltipText = options.energyCostToBuildLabel + ': ' + ogamizeNum(energyCost, options.unitSuffix);
                const existing = bootstrap.Tooltip.getInstance(hintEl);
                if (existing) existing.dispose();
                hintEl.setAttribute('title', tooltipText);
                new bootstrap.Tooltip(hintEl);
            }
        }
        dataRow[0] = resCost[0];
        dataRow[1] = resCost[1];
        dataRow[2] = resCost[2];
        dataRow[3] = energyCost;
        dataRow[4] = timeSpan;
        dataRow[5] = points;
        options.techData[rowKey] = dataRow;
    } else {
        row.children[firstDataCol].innerHTML = '0';
        row.children[firstDataCol + 1].innerHTML = '0';
        row.children[firstDataCol + 2].innerHTML = '0';
        row.children[firstDataCol + 3].innerHTML = '0' + options.datetimeS;
        row.children[firstDataCol + 4].innerHTML = '0';
        if (outerTab === 0)
            row.children[firstDataCol + 5].innerHTML = '0';
        options.techData[rowKey] = null;
    }
    updateTotals();
}

// Учитывает изменения в параметрах: уровни фабрики роботов, фабрики нанитов, скорость вселенной, . Обновляет время в соответствующих полях глобального массива рассчитанных значений
function updateParams() {
    let techTypes = [1, 2];
    options.prm.robotFactoryLevel = getInputNumber(document.getElementById('robot-factory-level'));
    options.prm.naniteFactoryLevel = getInputNumber(document.getElementById('nanite-factory-level'));
    options.prm.universeSpeed = document.getElementById('universe-speed').value;
    options.prm.ionTechLevel = getInputNumber(document.getElementById('ion-tech-level'));
    options.prm.hyperTechLevel = getInputNumber(document.getElementById('hyper-tech-level'));
    options.prm.capIncrSC = getInputNumber(document.getElementById('sc-capacity-increase'));
    options.prm.capIncrLC = getInputNumber(document.getElementById('lc-capacity-increase'));
    options.prm.megalithLvl = getInputNumber(document.getElementById('megalith-level'));
    options.prm.mineralResCntrLvl = getInputNumber(document.getElementById('mrc-level'));
    options.prm.researchCostReduction = getInputNumber(document.getElementById('research-cost-reduction'));
    options.prm.researchTimeReduction = getInputNumber(document.getElementById('research-time-reduction'));
    if (document.getElementById('class-2').checked)
        options.prm.playerClass = 2;
    else {
        if (document.getElementById('class-1').checked)
            options.prm.playerClass = 1;
        else
            options.prm.playerClass = 0;
    }
    options.prm.fullNumbers = document.getElementById('full-numbers').checked;
    let needUpd = { 0: false, 1: false };
    let techLevelFrom;
    let techLevelTo;
    const rsrCostRdc = getInputNumber(document.getElementById('research-cost-reduction'));
    var baseBbldCostRdc = Number(document.getElementById('race-selector').value) === 2 ? 0.01 * getInputNumber(document.getElementById('megalith-level')) : 0;
    const reductables = [1, 2, 3, 4, 12, 2001, 2002];
    const mrcRdc = Number(document.getElementById('race-selector').value) === 2 ? 0.005 * getInputNumber(document.getElementById('mrc-level')) : 0;
    const ionTechLevel = (techLevelTo > techLevelFrom) ? 0 : getInputNumber(document.getElementById('ion-tech-level'));
    Object.entries(options.techData).forEach(([key, value]) => {
        if (value == null)
            return;
        let keyParts = key.split(/-/);
        if (techTypes.includes(1 * keyParts[2])) {
            let bldCostRdc = baseBbldCostRdc;
            let rows = document.querySelectorAll('#table-' + keyParts[1] + '-' + keyParts[2] + ' tr');
            for (let idx = 1; idx < rows.length; idx++) {
                let rowID = rows[idx].children[0].innerHTML;
                if (rowID === keyParts[0]) {
                    if (keyParts[1] * 1 === 1) {
                        techLevelFrom = 1 * rows[idx].children[2].children[0].value;
                        techLevelTo = 1 * rows[idx].children[3].children[0].value;
                    } else {
                        techLevelTo = 1 * rows[idx].children[2].children[0].value;
                        techLevelFrom = techLevelTo === 0 ? 0 : techLevelTo - 1;
                    }
                    let techID = Number(rowID);
                    if (reductables.includes(techID))
                        bldCostRdc += mrcRdc;
                    let newCost = getBuildCostLF(techID, techLevelFrom, techLevelTo, options.techCosts, ionTechLevel, rsrCostRdc, bldCostRdc);
                    let newTime = getAdjustedTime(techID, techLevelFrom, techLevelTo);
                    let newEnergy = getBuildEnergyCostLF(techID, techLevelTo, options.techCosts, ionTechLevel, bldCostRdc);
                    let firstDataCol = (keyParts[1] * 1 === 1) ? 4 : 3;
                    if (newTime > 0) {
                        options.techData[key][0] = newCost[0];
                        rows[idx].children[firstDataCol].innerHTML = ogamizeNum(newCost[0], options.unitSuffix);
                        options.techData[key][1] = newCost[1];
                        rows[idx].children[firstDataCol + 1].innerHTML = ogamizeNum(newCost[1], options.unitSuffix);
                        options.techData[key][2] = newCost[2];
                        rows[idx].children[firstDataCol + 2].innerHTML = ogamizeNum(newCost[2], options.unitSuffix);
                        options.techData[key][3] = newEnergy;
                        options.techData[key][4] = newTime;
                        rows[idx].children[firstDataCol + 3].innerHTML = timespanToShortenedString(newTime, options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true);
                        if (Number(keyParts[1]) === 0) {
                            if (Number(keyParts[2]) < 5) {
                                let tmCost = getHalvingCost(techID, newTime);
                                rows[idx].children[firstDataCol + 5].innerHTML = ogamizeNum(tmCost, options.unitSuffix);
                            } else {
                                rows[idx].children[firstDataCol + 5].innerHTML = '0';
                            }
                        }
                        if ([1002, 2002, 3002, 4002].includes(techID)) {
                            const hintEl = rows[idx].children[1].querySelector('.energy-cost-hint');
                            if (hintEl) {
                                const tooltipText = options.energyCostToBuildLabel + ': ' + ogamizeNum(newEnergy, options.unitSuffix);
                                const existing = bootstrap.Tooltip.getInstance(hintEl);
                                if (existing) existing.dispose();
                                hintEl.setAttribute('title', tooltipText);
                                new bootstrap.Tooltip(hintEl);
                            }
                        }
                    } else {
                        rows[idx].children[2].children[0].value = 0;
                        if (keyParts[1] * 1 === 1)
                            rows[idx].children[3].children[0].value = 0;
                        rows[idx].children[firstDataCol].innerHTML = '0';
                        rows[idx].children[firstDataCol + 1].innerHTML = '0';
                        rows[idx].children[firstDataCol + 2].innerHTML = '0';
                        rows[idx].children[firstDataCol + 3].innerHTML = '0' + options.datetimeS;
                        rows[idx].children[firstDataCol + 4].innerHTML = '0';
                        if (Number(keyParts[1]) === 0)
                            rows[idx].children[firstDataCol + 5].innerHTML = '0';
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

function initTooltips(root) {
    (root || document).querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function (el) {
        const existing = bootstrap.Tooltip.getInstance(el);
        if (existing) existing.dispose();
        new bootstrap.Tooltip(el);
    });
}

// Обновляет промежуточные и общие итоги на основании данных из глобального массива рассчитанных значений
function updateTotals(needUpd) {
    options.prm.robotFactoryLevel = getInputNumber(document.getElementById('robot-factory-level'));
    options.prm.naniteFactoryLevel = getInputNumber(document.getElementById('nanite-factory-level'));
    options.prm.universeSpeed = document.getElementById('universe-speed').value;
    options.prm.ionTechLevel = getInputNumber(document.getElementById('ion-tech-level'));
    options.prm.hyperTechLevel = getInputNumber(document.getElementById('hyper-tech-level'));
    options.prm.fullNumbers = document.getElementById('full-numbers').checked;
    options.prm.capIncrSC = getInputNumber(document.getElementById('sc-capacity-increase'));
    options.prm.capIncrLC = getInputNumber(document.getElementById('lc-capacity-increase'));
    options.prm.megalithLvl = getInputNumber(document.getElementById('megalith-level'));
    options.prm.mineralResCntrLvl = getInputNumber(document.getElementById('mrc-level'));
    options.prm.researchCostReduction = getInputNumber(document.getElementById('research-cost-reduction'));
    options.prm.researchTimeReduction = getInputNumber(document.getElementById('research-time-reduction'));

    for (let outer = 0; outer < 2; outer++) {
        if (needUpd && needUpd[outer] === false)
            continue;
        let innerNums = [1, 2];
        let firstDataCol = (outer === 0) ? 3 : 4;
        let grandTotals = [0, 0, 0, 0, 0, 0];
        for (let innerIdx = 0; innerIdx < innerNums.length; innerIdx++) {
            let inner = innerNums[innerIdx];
            let rows = document.querySelectorAll('#table-' + outer + '-' + inner + ' tr');
            let totals = [0, 0, 0, 0, 0, 0, 0];
            let row;
            for (row = 1; row < rows.length - footerRows; row++) {
                let techID = rows[row].children[0].innerHTML;
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
            rows[row].children[2].innerHTML = '';
            rows[row].children[3].innerHTML = '<b>' + ogamizeNum(totals[0], options.unitSuffix) + '</b>';
            rows[row].children[4].innerHTML = '<b>' + ogamizeNum(totals[1], options.unitSuffix) + '</b>';
            rows[row].children[5].innerHTML = '<b>' + ogamizeNum(totals[2], options.unitSuffix) + '</b>';
            rows[row].children[6].innerHTML = '<b>' + timespanToShortenedString(totals[4], options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true) + '</b>';
            rows[row].children[7].innerHTML = '<b>' + ogamizeNum(totals[5], options.unitSuffix) + '</b>';
            grandTotals[0] += totals[0];
            grandTotals[1] += totals[1];
            grandTotals[2] += totals[2];
            grandTotals[3] += totals[3];
            grandTotals[4] += totals[4];
            grandTotals[5] += totals[5];
        }
        // После того, как обработали все данные на внутренних вкладках, надо показать общий итог по данной внешней вкладке.
        for (let innerIdx = 0; innerIdx < innerNums.length; innerIdx++) {
            let inner = innerNums[innerIdx];
            let rows = document.querySelectorAll('#table-' + outer + '-' + inner + ' tr');
            let row = rows.length - 4;
            rows[row].children[2].innerHTML = '<b>' + ogamizeNum(grandTotals[0], options.unitSuffix) + '</b>';
            rows[row].children[3].innerHTML = '<b>' + ogamizeNum(grandTotals[1], options.unitSuffix) + '</b>';
            rows[row].children[4].innerHTML = '<b>' + ogamizeNum(grandTotals[2], options.unitSuffix) + '</b>';
            rows[row].children[5].innerHTML = '<b>' + timespanToShortenedString(grandTotals[4], options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true) + '</b>';
            rows[row].children[6].innerHTML = '<b>' + ogamizeNum(grandTotals[5], options.unitSuffix) + '</b>';
            if (outer === 0)
                rows[row].children[7].innerHTML = '<b>0</b>';
            let avbMet = getInputNumber(document.getElementById(`metal-available-${outer}-${inner}`));
            let avbCrys = getInputNumber(document.getElementById(`crystal-available-${outer}-${inner}`));
            let avbDeut = getInputNumber(document.getElementById(`deut-available-${outer}-${inner}`));
            const needMet = Math.max(0, grandTotals[0] - avbMet);
            const needCrys = Math.max(0, grandTotals[1] - avbCrys);
            const needDeut = Math.max(0, grandTotals[2] - avbDeut);
            rows[rows.length - 2].children[2].innerHTML = '<b>' + ogamizeNum(needMet, options.unitSuffix) + '</b>';
            rows[rows.length - 2].children[3].innerHTML = '<b>' + ogamizeNum(needCrys, options.unitSuffix) + '</b>';
            rows[rows.length - 2].children[4].innerHTML = '<b>' + ogamizeNum(needDeut, options.unitSuffix) + '</b>';

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
            rows[rows.length - 1].children[2].innerHTML = numToOGame(needSC) + ' ' + '<abbr data-bs-toggle="tooltip" title="' + options.scFull + '">' + options.scShort + '</abbr>';
            rows[rows.length - 1].children[3].innerHTML = numToOGame(needLC) + ' ' + '<abbr data-bs-toggle="tooltip" title="' + options.lcFull + '">' + options.lcShort + '</abbr>';
        }
    }

    options.save();
    initTooltips();
}

function getAdjustedTime(techID, techLevelFrom, techLevelTo) {
    if (techLevelFrom == 0 & techLevelTo == 0)
        return 0;
    const rsrTimeRdc = getInputNumber(document.getElementById('research-time-reduction'));
    const megalithRdc = Math.min(0.99, Number(document.getElementById('race-selector').value) === 2 ? 0.01 * getInputNumber(document.getElementById('megalith-level')) : 0);
    return getBuildTimeLF(techID, techLevelFrom, techLevelTo, options.techCosts,
        options.prm.robotFactoryLevel, options.prm.naniteFactoryLevel, options.prm.universeSpeed, rsrTimeRdc, megalithRdc);
}

function updateOneMultTab() {
    options.prm.robotFactoryLevel = getInputNumber(document.getElementById('robot-factory-level'));
    options.prm.naniteFactoryLevel = getInputNumber(document.getElementById('nanite-factory-level'));
    options.prm.universeSpeed = document.getElementById('universe-speed').value;
    options.prm.ionTechLevel = getInputNumber(document.getElementById('ion-tech-level'));
    options.prm.hyperTechLevel = getInputNumber(document.getElementById('hyper-tech-level'));
    options.prm.fullNumbers = document.getElementById('full-numbers').checked;
    options.prm.capIncrSC = getInputNumber(document.getElementById('sc-capacity-increase'));
    options.prm.capIncrLC = getInputNumber(document.getElementById('lc-capacity-increase'));
    options.prm.megalithLvl = getInputNumber(document.getElementById('megalith-level'));
    options.prm.mineralResCntrLvl = getInputNumber(document.getElementById('mrc-level'));
    options.prm.researchCostReduction = getInputNumber(document.getElementById('research-cost-reduction'));
    options.prm.researchTimeReduction = getInputNumber(document.getElementById('research-time-reduction'));

    let techID = Number(document.getElementById('tech-types-select').value);
    if (techID == 0) {
        let tbl = document.getElementById('commons-table');
        let allRows = tbl.querySelectorAll('tr');
        let footer = Array.from(allRows).slice(tbl.rows.length - 5);
        footer.forEach(r => r.parentNode.removeChild(r));
        for (let i = tbl.rows.length - 1; i > 0; i--) {
            tbl.rows[i].remove();
        }
        footer.forEach(r => tbl.tBodies[0].appendChild(r));
        let rows = tbl.querySelectorAll('tr');
        let totalsRow = rows.length - 4;
        rows[totalsRow].children[1].innerHTML = '<b>0</b>';
        rows[totalsRow].children[2].innerHTML = '<b>0</b>';
        rows[totalsRow].children[3].innerHTML = '<b>0</b>';
        rows[totalsRow].children[4].innerHTML = '<b>' + timespanToShortenedString(0, options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true) + '</b>';
        rows[totalsRow].children[5].innerHTML = '<b>0</b>';
        rows[totalsRow + 2].children[1].innerHTML = '<b>0</b>';
        rows[totalsRow + 2].children[2].innerHTML = '<b>0</b>';
        rows[totalsRow + 2].children[3].innerHTML = '<b>0</b>';
        rows[totalsRow + 3].children[1].innerHTML = '0 <abbr data-bs-toggle="tooltip" title="' + options.scFull + '">' + options.scShort + '</abbr>';
        rows[totalsRow + 3].children[2].innerHTML = '0 <abbr data-bs-toggle="tooltip" title="' + options.lcFull + '">' + options.lcShort + '</abbr>';
        initTooltips();
        return;
    }
    const inputs = ['metal', 'crystal', 'deut'];
    let focusedInput = -1;
    inputs.forEach((input, id) => {
        const el = document.getElementById(`${input}-available-2-1`);
        if (el && el === document.activeElement)
            focusedInput = id;
    });
    let targetTable = 'commons-table';
    let tbl = document.getElementById(targetTable);
    let allRows = Array.from(tbl.querySelectorAll('tr'));
    let footer = allRows.slice(tbl.rows.length - 5);
    footer.forEach(r => r.parentNode.removeChild(r));
    for (let i = tbl.rows.length - 1; i > 0; i--) {
        tbl.rows[i].remove();
    }

    let levelFrom = getInputNumber(document.getElementById('tab2-from-level'));
    let levelTo = getInputNumber(document.getElementById('tab2-to-level'));

    if (techID === 0) {
        levelFrom = 0;
        levelTo = 0;
    }
    const rsrCostRdc = getInputNumber(document.getElementById('research-cost-reduction'));
    const ionTechLevel = (levelTo > levelFrom) ? 0 : getInputNumber(document.getElementById('ion-tech-level'));
    var bldCostRdc = Number(document.getElementById('race-selector').value) === 2 ? 0.01 * getInputNumber(document.getElementById('megalith-level')) : 0;
    const reductables = [1, 2, 3, 4, 12, 2001, 2002];
    const mrcRdc = Number(document.getElementById('race-selector').value) === 2 ? 0.005 * getInputNumber(document.getElementById('mrc-level')) : 0;
    if (reductables.includes(techID))
        bldCostRdc += mrcRdc;
    let resCost = [0, 0, 0];
    let totalMet = 0, totalCrys = 0, totalDeut = 0, totalTime = 0, points = 0, totalPts = 0;
    let rowData = Array();
    let rowStr;
    for (let i = levelFrom; i < levelTo; i++) {
        rowData = Array();
        rowStr = '';
        rowData.push(i + 1);
        resCost = getBuildCostLF(techID, i, i + 1, options.techCosts, ionTechLevel, rsrCostRdc, bldCostRdc);
        rowData.push(ogamizeNum(resCost[0], options.unitSuffix));
        rowData.push(ogamizeNum(resCost[1], options.unitSuffix));
        rowData.push(ogamizeNum(resCost[2], options.unitSuffix));
        totalMet += resCost[0];
        totalCrys += resCost[1];
        totalDeut += resCost[2];
        let time = getAdjustedTime(techID, i, i + 1);
        rowData.push(timespanToShortenedString(time, options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true));
        totalTime += time;
        points = (resCost[0] + resCost[1] + resCost[2]) / 1000;
        totalPts += points;
        rowData.push(ogamizeNum(Math.round((resCost[0] + resCost[1] + resCost[2]) / 1000), options.unitSuffix));

        rowStr = '<tr class=' + ((i % 2) === 1 ? 'odd' : 'even') + '>';
        for (const cell of rowData) {
            rowStr += '<td align="center">' + cell + '</td>';
        }
        rowStr += '</tr>';
        tbl.tBodies[0].insertAdjacentHTML('beforeend', rowStr);
    }
    footer.forEach(r => tbl.tBodies[0].appendChild(r));
    inputs.forEach((input, id) => {
        if (focusedInput == id) {
            const el = document.getElementById(`${input}-available-2-1`);
            if (el) el.focus();
        }
    });

    let rows = tbl.querySelectorAll('tr');
    let totalsRow = rows.length - 4;
    rows[totalsRow].children[1].innerHTML = '<b>' + ogamizeNum(totalMet, options.unitSuffix) + '</b>';
    rows[totalsRow].children[2].innerHTML = '<b>' + ogamizeNum(totalCrys, options.unitSuffix) + '</b>';
    rows[totalsRow].children[3].innerHTML = '<b>' + ogamizeNum(totalDeut, options.unitSuffix) + '</b>';
    rows[totalsRow].children[4].innerHTML = '<b>' + timespanToShortenedString(totalTime, options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true) + '</b>';
    rows[totalsRow].children[5].innerHTML = '<b>' + ogamizeNum(Math.round(totalPts), options.unitSuffix) + '</b>';

    let avbMet = getInputNumber(document.getElementById('metal-available-2-1'));
    let avbCrys = getInputNumber(document.getElementById('crystal-available-2-1'));
    let avbDeut = getInputNumber(document.getElementById('deut-available-2-1'));
    const needMet = Math.max(0, totalMet - avbMet);
    const needCrys = Math.max(0, totalCrys - avbCrys);
    const needDeut = Math.max(0, totalDeut - avbDeut);
    rows[totalsRow + 2].children[1].innerHTML = '<b>' + ogamizeNum(needMet, options.unitSuffix) + '</b>';
    rows[totalsRow + 2].children[2].innerHTML = '<b>' + ogamizeNum(needCrys, options.unitSuffix) + '</b>';
    rows[totalsRow + 2].children[3].innerHTML = '<b>' + ogamizeNum(needDeut, options.unitSuffix) + '</b>';

    let totalRes = totalMet + totalCrys + totalDeut;
    let capSC = 5000 * (1 + 0.05 * options.prm.hyperTechLevel);
    if (options.prm.playerClass === 0) {
        capSC += 5000 * 0.25;
    }
    capSC += Math.floor(5000 * 0.01 * options.prm.capIncrSC);
    let needSC = Math.ceil(totalRes / capSC);
    let capLC = 25000 * (1 + 0.05 * options.prm.hyperTechLevel);
    if (options.prm.playerClass === 0) {
        capLC += 25000 * 0.25;
    }
    capLC += Math.floor(25000 * 0.01 * options.prm.capIncrLC);
    let needLC = Math.ceil(totalRes / capLC);
    rows[totalsRow + 3].children[1].innerHTML = numToOGame(needSC) + ' <abbr data-bs-toggle="tooltip" title="' + options.scFull + '">' + options.scShort + '</abbr>';
    rows[totalsRow + 3].children[2].innerHTML = numToOGame(needLC) + ' <abbr data-bs-toggle="tooltip" title="' + options.lcFull + '">' + options.lcShort + '</abbr>';

    options.save();
    initTooltips();
}

function hideNShowItems() {
    let race = document.getElementById('race-selector').value;
    for (let outer = 0; outer < 2; outer++) {
        for (let inner = 1; inner < 3; inner++) {
            let rows = document.querySelectorAll(`#table-${outer}-${inner} tr`);
            for (let row = 1; row < rows.length - footerRows; row++) {
                let rowID = Number(rows[row].children[0].innerHTML);
                if (Math.floor(rowID / 1000) == race) {
                    rows[row].style.display = '';
                } else {
                    rows[row].style.display = 'none';
                }
            }
        }
    }
    const opts = document.querySelectorAll('#tech-types-select option');
    for (const opt of opts) {
        if (Math.floor(Number(opt.value) / 1000) == race) {
            opt.style.display = '';
        } else {
            opt.style.display = 'none';
        }
    }
    document.getElementById('tech-types-select').value = '';

    // Show/hide megalith and mrc controls for Rock'tal (race 2)
    const iRocktAl = Number(race) === 2;
    ['megalith-level-wrap', 'mrc-level-wrap'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = iRocktAl ? '' : 'none';
    });

    updateOneMultTab();
}

function spreadValue() {
    const type = this.id.match(/metal|crystal|deut/)[0];
    const value = getInputNumber(document.getElementById(this.id));
    for (let outer = 0; outer < 3; outer++) {
        for (let inner = 1; inner < 3; inner++) {
            const el = document.getElementById(`${type}-available-${outer}-${inner}`);
            if (el) el.value = value;
        }
    }
    updateParams();
}

function storeTabsState() {
    const activeMain = document.querySelector('#mainTabs .nav-link.active');
    const activeInner0 = document.querySelector('#innerTabs0 .nav-link.active');
    const activeInner1 = document.querySelector('#innerTabs1 .nav-link.active');
    options.prm.tabsState = [
        activeMain ? activeMain.dataset.bsTarget : '',
        activeInner0 ? activeInner0.dataset.bsTarget : '',
        activeInner1 ? activeInner1.dataset.bsTarget : ''
    ].join('^');
    options.save();
}

function restoreTabsState() {
    if (!options.prm.tabsState) return;
    const [t0, t1, t2] = options.prm.tabsState.split('^');
    if (t0) {
        const btn = document.querySelector(`#mainTabs [data-bs-target="${t0}"]`);
        if (btn) bootstrap.Tab.getOrCreateInstance(btn).show();
    }
    if (t1) {
        const btn = document.querySelector(`#innerTabs0 [data-bs-target="${t1}"]`);
        if (btn) bootstrap.Tab.getOrCreateInstance(btn).show();
    }
    if (t2) {
        const btn = document.querySelector(`#innerTabs1 [data-bs-target="${t2}"]`);
        if (btn) bootstrap.Tab.getOrCreateInstance(btn).show();
    }
}

function initializeLfCostsCalculator() {
    // Store tab state on tab change
    document.getElementById('mainTabs').addEventListener('shown.bs.tab', storeTabsState);
    const innerTabs0 = document.getElementById('innerTabs0');
    const innerTabs1 = document.getElementById('innerTabs1');
    if (innerTabs0) innerTabs0.addEventListener('shown.bs.tab', storeTabsState);
    if (innerTabs1) innerTabs1.addEventListener('shown.bs.tab', storeTabsState);

    options.load();

    document.getElementById('robot-factory-level').value = options.prm.robotFactoryLevel;
    document.getElementById('nanite-factory-level').value = options.prm.naniteFactoryLevel;
    document.getElementById('universe-speed').value = options.prm.universeSpeed;
    document.getElementById('ion-tech-level').value = options.prm.ionTechLevel;
    document.getElementById('hyper-tech-level').value = options.prm.hyperTechLevel;
    document.getElementById('tech-types-select').value = 1;
    document.getElementById('tab2-from-level').value = 0;
    document.getElementById('tab2-to-level').value = 0;
    document.getElementById('class-' + options.prm.playerClass).checked = true;
    document.getElementById('full-numbers').checked = options.prm.fullNumbers;
    document.getElementById('sc-capacity-increase').value = options.prm.capIncrSC;
    document.getElementById('lc-capacity-increase').value = options.prm.capIncrLC;
    document.getElementById('megalith-level').value = options.prm.megalithLvl;
    document.getElementById('mrc-level').value = options.prm.mineralResCntrLvl;
    document.getElementById('research-cost-reduction').value = options.prm.researchCostReduction;
    document.getElementById('research-time-reduction').value = options.prm.researchTimeReduction;

    // Table inputs
    ['tab-0', 'tab-1'].forEach(tabId => {
        document.querySelectorAll(`#${tabId} input[type=text]`).forEach(inp => {
            inp.addEventListener('input', function (e) { validateInputNumber({ currentTarget: this, data: 'updateRow' }); });
        });
    });
    document.querySelectorAll('#tab-2 input[type=text]').forEach(inp => {
        inp.addEventListener('input', function (e) { validateInputNumber({ currentTarget: this, data: 'updateOneMultTab' }); });
        inp.addEventListener('blur', function (e) { validateInputNumberOnBlur({ currentTarget: this, data: 'updateOneMultTab' }); });
    });

    // Settings inputs
    document.querySelectorAll('#general-settings input[type=text]').forEach(inp =>
        inp.addEventListener('input', function (e) { validateInputNumber({ currentTarget: this, data: 'updateParams' }); }));
    document.querySelectorAll('#general-settings select').forEach(sel => {
        sel.addEventListener('keyup', updateParams);
        sel.addEventListener('change', updateParams);
    });
    document.querySelectorAll('#general-settings input[type=radio]').forEach(r =>
        r.addEventListener('click', updateParams));
    document.getElementById('full-numbers').addEventListener('click', updateParams);
    document.getElementById('reset').addEventListener('click', resetParams);
    document.getElementById('tech-types-select').addEventListener('change', updateOneMultTab);
    document.getElementById('race-selector').addEventListener('change', hideNShowItems);

    // Resource available inputs - spread value across all tabs
    for (let outer = 0; outer < 3; outer++) {
        for (let inner = 1; inner < 3; inner++) {
            ['metal', 'crystal', 'deut'].forEach(res => {
                const el = document.getElementById(`${res}-available-${outer}-${inner}`);
                if (el) {
                    el.addEventListener('input', function (e) { validateInputNumber({ currentTarget: this, data: 'spreadValue' }); });
                }
            });
        }
    }

    document.getElementById('sc-capacity-increase')._constrains = { 'min': 0, 'max': 1000, 'def': 0, 'allowFloat': true, 'allowNegative': false };
    document.getElementById('lc-capacity-increase')._constrains = { 'min': 0, 'max': 1000, 'def': 0, 'allowFloat': true, 'allowNegative': false };
    document.getElementById('megalith-level')._constrains = { 'min': 0, 'max': 100, 'def': 0, 'allowFloat': false, 'allowNegative': false };
    document.getElementById('mrc-level')._constrains = { 'min': 0, 'max': 100, 'def': 0, 'allowFloat': false, 'allowNegative': false };
    document.getElementById('research-cost-reduction')._constrains = { 'min': 0, 'max': 25, 'def': 0, 'allowFloat': true, 'allowNegative': false };
    document.getElementById('research-time-reduction')._constrains = { 'min': 0, 'max': 99, 'def': 0, 'allowFloat': true, 'allowNegative': false };

    let theme = { value: 'light', validate: function (key, val) { return val; } };
    loadFromCookie('theme', theme);
    toggleLightBS(theme.value === 'light');
    const cbLight = document.getElementById('cb-light-theme');
    if (cbLight) cbLight.addEventListener('click', function () { toggleLightBS(this.checked); });

    restoreTabsState();
    hideNShowItems();
    updateTotals();
    updateOneMultTab();
}
