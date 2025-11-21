<?php
$lang = get_lang();
require_once('Intl.php');
$loc = Intl::getTranslations($lang, 'sidebar');

$ogamePages = array(
	array('/ogame/calc/trade.php', 'trade-title'),
	array('/ogame/calc/costs.php', 'costs-title'),
	array('/ogame/calc/lfcosts.php', 'lfcosts-title'),
	array('/ogame/calc/queue.php', 'queue-title'),
	array('/ogame/calc/production.php', 'production-title'),
	array('/ogame/calc/graviton.php', 'graviton-title'),
	array('/ogame/calc/terraformer.php', 'terraformer-title'),
	array('/ogame/calc/flight.php', 'flight-title'),
	array('/ogame/calc/moon.php', 'moon-title'),
	array('/ogame/calc/expeditions.php', 'expeditions-title')
);

require_once('db.connect.inc.php');
$result = sqlQuery("SELECT MAX(id) as m FROM change_headers");
$currChange = isset($result[0]['m']) ? $result[0]['m'] : 0;
if ( $_SERVER['SERVER_NAME'] == 'proxyforgame.com') {
	$pfgPath = $_SERVER['DOCUMENT_ROOT']; 
} else {
	$pfgPath = "D:\Programming\JS\pfg.wmp\www"; 
}
?>

<link type="text/css" href="/css/sidebar.css?v=<?php echo filemtime($pfgPath.'/css/sidebar.css'); ?>" rel="stylesheet" />
<script type="text/javascript">
var buttonsText = {};
buttonsText.send = '<?=$loc['reportStrings']['send']?>';
buttonsText.cancel = '<?=$loc['reportStrings']['cancel']?>';
buttonsText.correct = '<?=$loc['reportStrings']['correct']?>';
buttonsText.ok = 'OK';
var currUrl = '<?=$_SERVER['REQUEST_URI']?>';
var currChange = <?=$currChange ?>;
var currLang = '<?=$lang ?>';
</script>
<script type="text/javascript" src="/js/sidebar.js?v=<?php echo filemtime($pfgPath.'/js/sidebar.js'); ?>"></script>

<div id="sidebar">
	<a class="ui-widget-header" href="/<?=$lang?>/"><?=$loc['ogameMenuItems']['main-title']?></a>
	<div class="ui-panel"><?=$loc['ogameMenuItems']['header']?> <font size="1">(12)</font></div>
	<div>
	<?php foreach ($ogamePages as $page): ?>
		<?php if (!strpos($_SERVER['REQUEST_URI'], $page[0])): ?>
			<a class="ui-state-default" href="/<?=$lang.$page[0]?>"><?=$loc['ogameMenuItems'][$page[1]]?></a>
		<?php else: ?>
			<div class="ui-state-active"><?=$loc['ogameMenuItems'][$page[1]]?></div>
		<?php endif; ?>
	<?php endforeach; ?>
	</div>
	<div class="spacer">&nbsp;</div>
	<div class="ui-panel"><?=$loc['feedbackItems']['header']?></div>
	<div class="ui-state-active feedback">
		<?=$loc['feedbackItems']['misspelling']?>
	</div>
	<div class="ui-state-active feedback">
		<?=$loc['feedbackItems']['mail']?>
	</div>
	<div class="ui-state-active feedback">
		<?=$loc['feedbackItems']['board']?>
	</div>
	<div class="ui-state-active feedback">
		<?=$loc['feedbackItems']['discord']?>
	</div>
	<div class="spacer">&nbsp;</div>
	
	<div class="ui-panel"><?=$loc['donateStrings']['header']?></div>
	<div class="ui-state-active feedback">
		<table align="center"><tr><td>
		<a id="donate-link" href="#" onclick="showDonateInfoWindow();">
			<img id="donate-dlg-btn" alt="">
		</a>
		</td></tr></table>
	</div>
		
	<div class="spacer">&nbsp;</div>
	<div class="ui-panel">Cookies</div>
	<div class="ui-state-active feedback">
		<a href="/policy.php" style="display: inline" target="_blank">Privacy Policy</a>
	</div>
	
	<div class="spacer">&nbsp;</div>
	<div class="ui-state-active changelog">
		<a href="#" onclick="requestAndShowChangelog(-1);"><?=$loc['changelogStrings']['changelog']?></a>
	</div>

</div>

<div id="donate-dialog" title="<?=$loc['donateStrings']['why_caption']?>" style="display: none">
	<div id="donate-dlg-body" class="ui-dialog-content ui-widget-content">
		<div id="donate-dlg-info">
			<?=$loc['donateStrings']['why_text']?><br/>
			<div id="payments-accordion">
				<h3><a href="#">Webmoney.Funding</a></h3>
				<div>
<?php if ($_SERVER['HTTP_HOST'] == 'proxyforgame.com' && $lang == 'ru'): ?>
					<iframe src="https://funding.webmoney.ru/widgets/horizontal/646155b8-3fd6-4191-afd8-431ef3d6bdba?bt=0&hs=1&sum=10" width="468" height="150" scrolling="no" style="border:none;"></iframe>
<?php elseif ($_SERVER['HTTP_HOST'] == 'proxyforgame.com'): ?>
					<iframe src="https://funding.wmtransfer.com/widgets/horizontal/646155b8-3fd6-4191-afd8-431ef3d6bdba?bt=0&hs=1&sum=10&hsb=1&hab=1" width="468" height="150" scrolling="no" style="border:none;"></iframe>
<?php endif; ?>
				</div>
				<h3><a href="#"><?=$loc['donateStrings']['alternatives']?></a></h3>
				<div>
					<table align="center">
						<tr>
							<td colspan="2" height="20px;"><a href="https://paypal.me/ProxyForGame" target="_blank">paypal.me/ProxyForGame</a>
							<span style="display: inline-block; width:30px;"></span>ePayments: 000-562870</td>
							<td>PerfectMoney:</td>
						</tr>
						<tr>
							<td height="20px;">BTC</td>
							<td>1CgoSRfUyVj76QycGmNhgrLWvwWiByuESJ</td>
							<td><span style="display: inline-block; width:20px;"></span>U17256587</td>
						</tr>
						<tr>
							<td height="20px;">ETH:</td>
							<td>0x58915237F041422492abbB3E371225E6DF5EbF52</td>
							<td><span style="display: inline-block; width:20px;"></span>E17208900</td>
						</tr>						
						<tr>
							<td height="20px;">LTC:</td>
							<td>ltc1qvyt8ru8xmljs8l3vmwtwm27l4j0zjhd0lyteml</td>
							<td></td>
						</tr>
					</table>
				</div>	
			</div>
		</div>
	</div>
</div>

<div id="report-form" title="<?=$loc['reportStrings']['title']?>" class="ui-helper-hidden">
	<div id="report-data" class="ui-widget-content ui-corner-all">
		<div id="report-info">
			<?=$loc['reportStrings']['info']?>
		</div>
		<table align="center">
			<tr><td><?=$loc['reportStrings']['input1']?></td></tr>
			<tr><td><input type="text" class="ui-state-default ui-input ui-corner-all correction-input" id="misspelled-text" value=""/></td></tr>
			<tr><td><?=$loc['reportStrings']['input2']?></td></tr>
			<tr><td><input type="text" class="ui-state-default ui-input ui-corner-all correction-input" id="corrected-text" value=""/></td></tr>
		</table>
	</div>
	<div id="report-progress">
		<div id="progress-text"><?=$loc['reportStrings']['sending-progress']?></div>
		<div><img src="/images/progress.gif" alt=""/></div>
	</div>
	<div id="report-err-0" class="ui-helper-hidden">
		<p><?=$loc['reportStrings']['msg-0']?></p>
	</div>
	<div id="report-err-1" class="ui-helper-hidden">
		<p><?=$loc['reportStrings']['msg-1']?></p>
	</div>
	<div id="report-err-2" class="ui-helper-hidden">
		<p><?=$loc['reportStrings']['msg-2']?></p>
	</div>
	<div id="report-err-3" class="ui-helper-hidden">
		<p><?=$loc['reportStrings']['msg-3']?></p>
	</div>
	<div id="report-err-4" class="ui-helper-hidden">
		<p><?=$loc['reportStrings']['msg-4']?></p>
	</div>
	<div id="report-err-5" class="ui-helper-hidden">
		<p><?=$loc['reportStrings']['msg-5']?></p>
	</div>
	<div id="report-err-6" class="ui-helper-hidden">
		<p><?=$loc['reportStrings']['msg-6']?></p>
	</div>
	<div id="report-err-7" class="ui-helper-hidden">
		<p><?=$loc['reportStrings']['msg-7']?></p>
	</div>
	<div id="report-err-99" class="ui-helper-hidden">
		<p><?=$loc['reportStrings']['msg-99']?></p>
	</div>
</div>

<div id="email-form" title="<?=$loc['emailStrings']['title']?>" class="ui-helper-hidden">
	<div id="email-data" class="ui-widget-content ui-corner-all">
		<table align="center" width="100%">
			<tr><td><?=$loc['emailStrings']['address']?></td></tr>
			<tr><td><input type="text"  class="ui-state-default ui-input ui-corner-all" id="email-form-address" value=""/></td></tr>
			<tr><td><?=$loc['emailStrings']['subject']?></td></tr>
			<tr><td><input type="text" class="ui-state-default ui-input ui-corner-all" id="email-form-subject" value=""/></td></tr>
			<tr><td><?=$loc['emailStrings']['body']?></td></tr>
			<tr><td>
			<textarea id="email-form-body" rows="7" class="ui-state-default ui-input ui-corner-all"></textarea>
			</td></tr>

		</table>
	</div>
	<div id="email-progress">
		<div id="progress-text"><?=$loc['emailStrings']['sending-progress']?></div>
		<div><img src="/images/progress.gif"/></div>
	</div>
	<div id="email-err-0" class="ui-helper-hidden">
		<p><?=$loc['emailStrings']['msg-0']?></p>
	</div>
	<div id="email-err-1" class="ui-helper-hidden">
		<p><?=$loc['emailStrings']['msg-1']?></p>
	</div>
	<div id="email-err-2" class="ui-helper-hidden">
		<p><?=$loc['emailStrings']['msg-2']?></p>
	</div>
	<div id="email-err-3" class="ui-helper-hidden">
		<p><?=$loc['emailStrings']['msg-3']?></p>
	</div>
	<div id="email-err-4" class="ui-helper-hidden">
		<p><?=$loc['emailStrings']['msg-4']?></p>
	</div>
	<div id="email-err-99" class="ui-helper-hidden">
		<p><?=$loc['emailStrings']['msg-99']?></p>
	</div>
</div>

<div id="changelog-dialog" title="<?=$loc['changelogStrings']['changelog']?>" style="display: none">
	<div id="changelog-dlg-body" class="ui-dialog-content ui-widget-content">
		<div id="changelog-dlg-info">
			<?=$loc['changelogStrings']['chl-dlg-hdr']?>
			<div class="small-spacer">&nbsp;</div>
			<table id="changelog-tbl" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
				<tr>
					<th><?=$loc['changelogStrings']['date']?></th>
					<th><?=$loc['changelogStrings']['description']?></th>
				</tr>
			</table>
			<div class="small-spacer">&nbsp;</div>
			<div id="changelog-link-div" class="ui-state-active changelog" style="float:right;">
				<a id="changelog-link" href="#" onclick="requestAndShowChangelog(-1);"><?=$loc['changelogStrings']['chl-load']?></a>
			</div>
		</div>
	</div>
</div>


