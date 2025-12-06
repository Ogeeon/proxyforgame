<script type="text/javascript">
function getCoord(el, prop) {
	var c = el[prop], b = document.body;
	while ((el = el.offsetParent)) {
			c += el[prop];
	}
	return c;
}

function showLangsMenu(event) {
	var optsEl = document.getElementById('langs-options');
	var stubEl = document.getElementById('lang-options-stub');
	var menuEl = document.getElementById('langs-menu');
	
	if (window.getComputedStyle(optsEl).display === 'none') {
		var el = event.currentTarget || event.srcElement;
		var left = getCoord(menuEl, 'offsetLeft');
		var top = getCoord(menuEl, 'offsetTop') + menuEl.offsetHeight;
		
		optsEl.style.left = left + 'px';
		stubEl.style.left = left + 'px';
		optsEl.style.top = top + 'px';
		stubEl.style.top = (top - 3) + 'px';
		
		stubEl.style.display = 'block';
		optsEl.style.display = 'block';
	} else {
		optsEl.style.display = 'none';
		stubEl.style.display = 'none';
	}
}

function hideLangsMenu(event) {
	var optsEl = document.getElementById('langs-options');
	var stubEl = document.getElementById('lang-options-stub');
	var menuEl = document.getElementById('langs-menu');
	
	if (window.getComputedStyle(optsEl).display === 'none')
		return;
	
	var x = event.pageX || event.x;
	var y = event.pageY || event.y;
	var el = event.currentTarget || event.srcElement;
	var menuLeft = getCoord(optsEl, 'offsetLeft');
	var menuRight = menuLeft + optsEl.offsetWidth;
	var menuTop = getCoord(menuEl, 'offsetTop');
	var menuBottom = menuTop + menuEl.offsetHeight + optsEl.offsetHeight;
	
	if (x < menuLeft || x > menuRight || y < menuTop || y > menuBottom) {
		optsEl.style.display = 'none';
		stubEl.style.display = 'none';
	}
}

document.addEventListener('DOMContentLoaded', function() {
	document.body.addEventListener('click', hideLangsMenu);
});

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
