<div class="dropdown">
	<button class="btn dropdown-toggle d-flex align-items-center gap-1 lang-menu-btn" type="button" id="langs-menu" data-bs-toggle="dropdown" aria-expanded="false">
		<img src="/images/langs/<?= $lang ?>.jpg" alt="<?= $lang ?>" width="24" height="16"/>
		<span><?= $availLangsList[$lang] ?></span>
	</button>
	<ul class="dropdown-menu" aria-labelledby="langs-menu">
		<?php foreach ($availLangsList as $abbrev => $name): ?>
		<li>
			<a class="dropdown-item lang-menu-item d-flex align-items-center gap-1" href="/<?= $abbrev . $currUrl ?>">
				<img src="/images/langs/<?= $abbrev ?>.jpg" alt="<?= $abbrev ?>" width="24" height="16"/>
				<span><?= $name ?></span>
			</a>
		</li>
		<?php endforeach; ?>
	</ul>
</div>