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
	$result = SqlQuery("SELECT MAX(id) as m FROM change_headers", array());
	$currChange = 0;
	if ($result !== FALSE && isset($result[0]['m'])) {
		$currChange = $result[0]['m'];
	}
	if ( $_SERVER['SERVER_NAME'] == 'proxyforgame.com') {
		$pfgPath = $_SERVER['DOCUMENT_ROOT']; 
	} else {
		$pfgPath = "D:\Programming\JS\pfg.wmp\www"; 
	}
?>

<?php $sidebarCss = $pfgPath . '/css/sidebar_bs.css'; ?>
<link type="text/css" href="/css/sidebar_bs.css?v=<?php echo (file_exists($sidebarCss) ? filemtime($sidebarCss) : 0); ?>" rel="stylesheet" />
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
<?php $sidebarJs = $pfgPath . '/js/sidebar_bs.js'; ?>
<script type="text/javascript" src="/js/sidebar_bs.js?v=<?php echo (file_exists($sidebarJs) ? filemtime($sidebarJs) : 0); ?>"></script>

<!-- Sidebar Toggle Button (visible when sidebar is hidden) -->
<button class="btn btn-primary d-lg-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#sidebarOffcanvas" aria-controls="sidebarOffcanvas">
	<i class="bi bi-list"></i> Menu
</button>

<!-- Sidebar for larger screens -->
<div id="sidebar" class="card d-none d-lg-block">
	<div class="card-body p-0">
		<div class="sidebar-panel bg-primary-subtle text-primary-medium"><?=$loc['ogameMenuItems']['header']?> <small>(12)</small></div>
		<div class="list-group list-group-flush">
		<a class="list-group-item list-group-item-action ogame-menu-item text-center" href="/<?=$lang?>/"><?=$loc['ogameMenuItems']['main-title']?></a>
		<?php foreach ($ogamePages as $page): ?>
			<?php if (!strpos($_SERVER['REQUEST_URI'], $page[0])): ?>
				<a class="list-group-item list-group-item-action ogame-menu-item text-center" href="/<?=$lang.$page[0]?>"><?=$loc['ogameMenuItems'][$page[1]]?></a>
			<?php else: ?>
				<div class="list-group-item list-group-item-action ogame-menu-item active text-center"><?=$loc['ogameMenuItems'][$page[1]]?></div>
			<?php endif; ?>
		<?php endforeach; ?>
		</div>
		<div class="spacer"></div>
		<div class="sidebar-panel bg-primary-subtle text-primary-medium"><?=$loc['feedbackItems']['header']?></div>
		<div class="list-group list-group-flush">
			<div class="list-group-item feedback text-center" onclick="findSelection()">
				<?=str_replace(['<br>', '<br/>'], ' ', $loc['feedbackItems']['misspelling'])?>
			</div>
			<div class="list-group-item feedback text-center" onclick="showEmailWindow()">
				<?=str_replace(['<br>', '<br/>'], ' ', $loc['feedbackItems']['mail'])?>
			</div>
			<div class="list-group-item feedback text-center">
				<?=str_replace(['<br>', '<br/>'], ' ', $loc['feedbackItems']['board'])?>
			</div>
			<div class="list-group-item feedback text-center">
				<?=str_replace(['<br>', '<br/>'], ' ', $loc['feedbackItems']['discord'])?>
			</div>
		</div>
		<div class="spacer"></div>
		<div class="sidebar-panel bg-primary-subtle text-primary-medium">Cookies</div>
		<div class="list-group list-group-flush">
			<div class="list-group-item feedback text-center">
				<a href="/policy.php" class="d-inline" target="_blank">Privacy Policy</a>
			</div>
		</div>
		<div class="spacer"></div>
		<div class="list-group list-group-flush">
			<div class="list-group-item changelog">
				<a href="#" onclick="requestAndShowChangelog(-1); return false;"><?=$loc['changelogStrings']['changelog']?></a>
			</div>
		</div>
	</div>
</div>

<!-- Offcanvas Sidebar for mobile/tablet -->
<div class="offcanvas offcanvas-start d-lg-none" tabindex="-1" id="sidebarOffcanvas" aria-labelledby="sidebarOffcanvasLabel">
	<div class="offcanvas-header">
		<button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
	</div>
	<div class="offcanvas-body p-0">
		<div class="sidebar-panel"><?=$loc['ogameMenuItems']['header']?> <small>(12)</small></div>
		<div class="list-group list-group-flush">
		<a class="list-group-item list-group-item-action ogame-menu-item text-center" href="/<?=$lang?>/"><?=$loc['ogameMenuItems']['main-title']?></a>
		<?php foreach ($ogamePages as $page): ?>
			<?php if (!strpos($_SERVER['REQUEST_URI'], $page[0])): ?>
				<a class="list-group-item list-group-item-action ogame-menu-item text-center" href="/<?=$lang.$page[0]?>"><?=$loc['ogameMenuItems'][$page[1]]?></a>
			<?php else: ?>
				<div class="list-group-item list-group-item-action ogame-menu-item active text-center"><?=$loc['ogameMenuItems'][$page[1]]?></div>
			<?php endif; ?>
		<?php endforeach; ?>
		</div>
		<div class="spacer"></div>
		<div class="sidebar-panel"><?=$loc['feedbackItems']['header']?></div>
		<div class="list-group list-group-flush">
			<div class="list-group-item feedback text-center" onclick="findSelection()">
				<?=str_replace(['<br>', '<br/>'], ' ', $loc['feedbackItems']['misspelling'])?>
			</div>
			<div class="list-group-item feedback text-center" onclick="showEmailWindow()">
				<?=str_replace(['<br>', '<br/>'], ' ', $loc['feedbackItems']['mail'])?>
			</div>
			<div class="list-group-item feedback text-center">
				<?=str_replace(['<br>', '<br/>'], ' ', $loc['feedbackItems']['board'])?>
			</div>
			<div class="list-group-item feedback text-center">
				<?=str_replace(['<br>', '<br/>'], ' ', $loc['feedbackItems']['discord'])?>
			</div>
		</div>
		<div class="spacer"></div>
		<div class="sidebar-panel">Cookies</div>
		<div class="list-group list-group-flush">
			<div class="list-group-item feedback text-center">
				<a href="/policy.php" class="d-inline" target="_blank">Privacy Policy</a>
			</div>
		</div>
		<div class="spacer"></div>
		<div class="list-group list-group-flush">
			<div class="list-group-item changelog">
				<a href="#" onclick="requestAndShowChangelog(-1); return false;"><?=$loc['changelogStrings']['changelog']?></a>
			</div>
		</div>
	</div>
</div>

<!-- Report Modal -->
<div class="modal fade" id="reportModal" tabindex="-1" aria-labelledby="reportModalLabel" aria-hidden="true">
	<div class="modal-dialog">
		<div class="modal-content">
			<div class="modal-header">
				<h5 class="modal-title" id="reportModalLabel"><?=$loc['reportStrings']['title']?></h5>
				<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
			</div>
			<div class="modal-body">
				<div id="report-data">
					<div id="report-info" class="text-center mb-3">
						<?=$loc['reportStrings']['info']?>
					</div>
					<div class="mb-3">
						<label for="misspelled-text" class="form-label"><?=$loc['reportStrings']['input1']?></label>
						<input type="text" class="form-control" id="misspelled-text" />
					</div>
					<div class="mb-3">
						<label for="corrected-text" class="form-label"><?=$loc['reportStrings']['input2']?></label>
						<input type="text" class="form-control" id="corrected-text" />
					</div>
				</div>
				<div id="report-progress" class="d-none text-center">
					<div id="report-progress-text"><?=$loc['reportStrings']['sending-progress']?></div>
					<div class="spinner-border mt-3" role="status">
						<span class="visually-hidden">Loading...</span>
					</div>
				</div>
				<?php for($i = 0; $i <= 7; $i++): ?>
				<div id="report-err-<?=$i?>" class="alert d-none"><p><?=$loc['reportStrings']['msg-'.$i]?></p></div>
				<?php endfor; ?>
				<div id="report-err-99" class="alert d-none"></div>
			</div>
			<div class="modal-footer">
				<button type="button" class="btn btn-secondary" id="report-btn-cancel" data-bs-dismiss="modal"><?=$loc['reportStrings']['cancel']?></button>
				<button type="button" class="btn btn-primary" id="report-btn-ok"><?=$loc['reportStrings']['send']?></button>
			</div>
		</div>
	</div>
</div>

<!-- Email Modal -->
<div class="modal fade" id="emailModal" tabindex="-1" aria-labelledby="emailModalLabel" aria-hidden="true">
	<div class="modal-dialog modal-lg">
		<div class="modal-content">
			<div class="modal-header">
				<h5 class="modal-title" id="emailModalLabel"><?=$loc['emailStrings']['title']?></h5>
				<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
			</div>
			<div class="modal-body">
				<div id="email-data">
					<div class="mb-3">
						<label for="email-form-address" class="form-label"><?=$loc['emailStrings']['address']?></label>
						<input type="email" class="form-control" id="email-form-address" />
					</div>
					<div class="mb-3">
						<label for="email-form-subject" class="form-label"><?=$loc['emailStrings']['subject']?></label>
						<input type="text" class="form-control" id="email-form-subject" />
					</div>
					<div class="mb-3">
						<label for="email-form-body" class="form-label"><?=$loc['emailStrings']['body']?></label>
						<textarea class="form-control" id="email-form-body" rows="7"></textarea>
					</div>
				</div>
				<div id="email-progress" class="d-none text-center">
					<div id="email-progress-text"><?=$loc['emailStrings']['sending-progress']?></div>
					<div class="spinner-border mt-3" role="status">
						<span class="visually-hidden">Sending...</span>
					</div>
				</div>
				<?php for($i = 0; $i <= 4; $i++): ?>
				<div id="email-err-<?=$i?>" class="alert d-none"><p><?=$loc['emailStrings']['msg-'.$i]?></p></div>
				<?php endfor; ?>
				<div id="email-err-99" class="alert d-none"></div>
			</div>
			<div class="modal-footer">
				<button type="button" class="btn btn-secondary" id="email-btn-cancel" data-bs-dismiss="modal"><?=$loc['emailStrings']['cancel']?></button>
				<button type="button" class="btn btn-primary" id="email-btn-ok"><?=$loc['emailStrings']['send']?></button>
			</div>
		</div>
	</div>
</div>

<!-- Changelog Modal -->
<div class="modal fade" id="changelogModal" tabindex="-1" aria-labelledby="changelogModalLabel" aria-hidden="true">
	<div class="modal-dialog modal-lg">
		<div class="modal-content">
			<div class="modal-header">
				<h5 class="modal-title" id="changelogModalLabel"><?=$loc['changelogStrings']['changelog']?></h5>
				<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
			</div>
			<div class="modal-body">
				<div id="changelog-dlg-info">
					<?=$loc['changelogStrings']['chl-dlg-hdr']?>
					<div class="small-spacer"></div>
					<div class="table-responsive">
						<table id="changelog-tbl" class="table table-striped table-bordered">
							<thead>
								<tr>
									<th style="width: 20%"><?=$loc['changelogStrings']['date']?></th>
									<th><?=$loc['changelogStrings']['description']?></th>
								</tr>
							</thead>
							<tbody></tbody>
						</table>
					</div>
					<div class="small-spacer"></div>
					<div id="changelog-link-div" class="text-end">
						<a id="changelog-link" href="#" class="changelog-link" onclick="requestAndShowChangelog(-1); return false;"><?=$loc['changelogStrings']['chl-load']?></a>
					</div>
				</div>
			</div>
			<div class="modal-footer">
				<button type="button" class="btn btn-primary" id="changelog-btn-ok" data-bs-dismiss="modal">OK</button>
			</div>
		</div>
	</div>
</div>