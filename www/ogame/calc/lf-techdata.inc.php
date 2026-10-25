<?php

// Shared Life Form tech data for the LF Costs and Production calculators.
// id => (key_$l, type[1=building,2=research], metal, crystal, deut, energy, time, growth coefficients...)
// Energy consumption of a building at level n = floor(energy * n * pow(coeff[index 10], n)).
//
// The rows live in data/lf-techs.json, in exactly this shape, so the MCP server
// (mcp/) prices life form techs from the same table as the pages.
$lfTechData = array();
foreach (json_decode(file_get_contents(__DIR__ . '/data/lf-techs.json'), true) as $lfId => $lfRow) {
    $lfTechData[(int)$lfId] = $lfRow;
}
