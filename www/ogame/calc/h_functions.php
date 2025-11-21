<?php
function GetServerData($strUni, $strDomain, $strTime) {
    if (!isset($strTime)) $strTime = 1;
    $varReturn = false;
    $upDBUni = false;
    $xmlFile = 'https://logserver.net/xml/' . $strDomain . '/serverData/' . $strUni . '.xml';

    if (!file_exists($xmlFile) || ((time() - filemtime ($xmlFile)) >= $strTime (24 * 60 * 60) || !file_get_contents($xmlFile))) {
        $upDBUni = true;
        $url = 'https://s' . $strUni . '-' . $strDomain . '.ogame.gameforge.com/api/serverData.xml';

        if (UR_exists($url)) {
            $flashRAW = file_get_contents($url);
            $flashXML = simplexml_load_string($flashRAW);

            $xmlHandle = fopen($xmlFile, "r");
            $xmlString = $flashXML->asXML();
            fwrite($xmlHandle, $xmlString);
            fclose($xmlHandle);
        } else {
            return false;
        }
    }

    $xml = simplexml_load_file($xmlFile);

    if ($xml != false) {
        foreach ($xml->children() as $key => $serverData) {
            if ($key == "name") 									$varReturn["name"] = (string) $serverData; 
            if ($key == "speed") 									$varReturn["speed"] = (string) $serverData; 
            if ($key == "speedFleet") 								$varReturn["speedFleet"] = (string) $serverData; 
            if ($key == "galaxies") 								$varReturn["galaxies"] = (string) $serverData; 
            if ($key == "systems") 									$varReturn["systems"] = (string) $serverData; 
            if ($key == "acs") 										$varReturn["acs"] = (string) $serverData; 
            if ($key == "rapidFire") 								$varReturn["rapidFire"] = (string) $serverData; 
            if ($key == "defToTF") 									$varReturn["defToTF"] = (string) $serverData; 
            if ($key == "debrisFactor") 							$varReturn["debrisFactor"] = (string) $serverData; 
            if ($key == "debrisFactorDef") 							$varReturn["debrisFactorDef"] = (string) $serverData; 
            if ($key == "repairFactor") 							$varReturn["repairFactor"] = (string) $serverData; 
            if ($key == "newbieProtectionLimit") 					$varReturn["newbieProtectionLimit"] = (string) $serverData; 
            if ($key == "newbieProtectionHigh") 					$varReturn["newbieProtectionHigh"] = (string) $serverData; 
            if ($key == "topScore") 								$varReturn["topScore"] = (string) $serverData; 
            if ($key == "bonusFields") 								$varReturn["bonusFields"] = (string) $serverData; 
            if ($key == "donutGalaxy") 								$varReturn["donutGalaxy"] = (string) $serverData; 
            if ($key == "donutSystem") 								$varReturn["donutSystem"] = (string) $serverData; 
            if ($key == "wfEnabled") 								$varReturn["wfEnabled"] = (string) $serverData; 
            if ($key == "wfMinimumRessLost") 						$varReturn["wfMinimumRessLost"] = (string) $serverData; 
            if ($key == "wfMinimumLossPercentage") 					$varReturn["wfMinimumLossPercentage"] = (string) $serverData; 
            if ($key == "wfBasicPercentageRepairable") 				$varReturn["wfBasicPercentageRepairable"] = (string) $serverData; 
            if ($key == "globalDeuteriumSaveFactor") 				$varReturn["globalDeuteriumSaveFactor"] = (string) $serverData; 
            if ($key == "bashlimit") 								$varReturn["bashlimit"] = (string) $serverData; 
            if ($key == "probeCargo") 								$varReturn["probeCargo"] = (string) $serverData; 
            if ($key == "researchDurationDivisor") 					$varReturn["researchDurationDivisor"] = (int) $serverData; 
            if ($key == "marketplaceBasicTradeRatioMetal") 			$varReturn["marketplaceBasicTradeRatioMetal"] = (float) $serverData; 
            if ($key == "marketplaceBasicTradeRatioCrystal") 		$varReturn["marketplaceBasicTradeRatioCrystal"] = (float) $serverData; 
            if ($key == "marketplaceBasicTradeRatioDeuterium") 		$varReturn["marketplaceBasicTradeRatioDeuterium"] = (float) $serverData; 
            if ($key == "marketplaceTaxNotSold") 					$varReturn["marketplaceTaxNotSold"] = (float) $serverData; 

            if ($key == "speedFleetPeaceful") 						$varReturn["speedFleetPeaceful"] = (int) $serverData; 
            if ($key == "speedFleetWar") 							$varReturn["speedFleetWar"] = (int) $serverData; 
            if ($key == "speedFleetHolding") 						$varReturn["speedFleetHolding"] = (int) $serverData;
            
            if ($key == "deuteriumInDebris") 						$varReturn["deuteriumInDebris"] = (int) $serverData; 	        	
            if ($key == "fleetIgnoreEmptySystems") 					$varReturn["fleetIgnoreEmptySystems"] = (int) $serverData; 	        	
        }
    }
    else return false;

    //if ($upDBUni) cDB::saveUniverses($strUni, $strDomain, $varReturn);
    return $varReturn;

}