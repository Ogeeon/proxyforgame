<script type="text/javascript">
/*
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
*/
</script>

<div class="dropdown">
	<button class="btn btn-light dropdown-toggle d-flex align-items-center gap-2 lang-menu-btn" type="button" id="langs-menu" data-bs-toggle="dropdown" aria-expanded="false">
		<img src="/images/langs/<?= $lang ?>.jpg" alt="<?= $lang ?>" width="24" height="16"/>
		<span><?= $availLangsList[$lang] ?></span>
	</button>
	<ul class="dropdown-menu" aria-labelledby="langs-menu">
		<?php foreach ($availLangsList as $abbrev => $name): ?>
		<li>
			<a class="dropdown-item lang-menu-item d-flex align-items-center gap-2" href="/<?= $abbrev . $currUrl ?>">
				<img src="/images/langs/<?= $abbrev ?>.jpg" alt="<?= $abbrev ?>" width="24" height="16"/>
				<span><?= $name ?></span>
			</a>
		</li>
		<?php endforeach; ?>
	</ul>
</div>