<script type="text/javascript">
function getCoord(el, prop) {
	var c = el[prop], b = document.body;
	while ((el = el.offsetParent)) {
			c += el[prop];
	}
	return c;
}

function showLangsMenu(event) {
	if ($('#langs-options').css('display') == 'none') {
		var el = (event.currentTarget) ? event.currentTarget : event.srcElement;
		var left = getCoord($('#langs-menu')[0], 'offsetLeft');
		var top = getCoord($('#langs-menu')[0], 'offsetTop') + $('#langs-menu')[0].offsetHeight;
		var opts = $('#langs-options')[0];
		var stub = $('#lang-options-stub')[0];
		$(opts).css('left', left);
		$(stub).css('left', left);
		$(opts).css('top', top);
		$(stub).css('top', top - 3);
		$('#lang-options-stub').slideDown("fast");
		$('#langs-options').slideDown("fast");
	} else {
		$('#langs-options').slideUp("fast");
		$('#lang-options-stub').slideUp("fast");
	}
}

function hideLangsMenu(event) {
	if ($('#langs-options').css('display') == 'none')
		return;
	var x = event.pageX || event.x;
	var y = event.pageY || event.y;
	var el = (event.currentTarget) ? event.currentTarget : event.srcElement;
	var menuLeft = getCoord($('#langs-options')[0], 'offsetLeft');
	var menuRight = menuLeft + $('#langs-options')[0].offsetWidth;
	var menuTop = getCoord($('#langs-menu')[0], 'offsetTop');
	var menuBottom = menuTop + $('#langs-menu')[0].offsetHeight + $('#langs-options')[0].offsetHeight;
	if (x < menuLeft || x > menuRight || y < menuTop || y > menuBottom) {
		$('#langs-options').slideUp("fast");
		$('#lang-options-stub').hide();
	}
}

$(function(){$('body').click(hideLangsMenu);});

</script>

<div id="langs-menu" class="ui-state-default ui-input ui-corner-all" onclick="showLangsMenu(event);">
	<table>
		<tr>
			<td><img src="/images/langs/<?= $lang ?>.jpg" alt="<?= $lang ?>"/></td>
			<td><?= $availLangsList[$lang] ?></td>
		</tr>
	</table>
</div>
<div id="lang-options-stub" class="ui-state-default ui-input"></div>
<div id="langs-options">
<?php $c = 0; ?>
<?php foreach ($availLangsList as $abbrev => $name): ?>
	<div>
		<a class="ui-state-active <?=($c == count($availLangsList)-1)?'last-option':''?>" href="/<?= $abbrev . $currUrl ?>">
			<table>
				<tr>
					<td><img src="/images/langs/<?= $abbrev ?>.jpg" alt="<?= $abbrev ?>"/></td>
					<td><?= $name ?></td>
				</tr>
			</table>
		</a>
	</div>
	<?php $c++; ?>
<?php endforeach; ?>
</div>
