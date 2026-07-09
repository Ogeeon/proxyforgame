<?php if ($_SERVER['HTTP_HOST'] == 'proxyforgame.com'): ?>
<style>
	#pfg-cookie-consent {
		display: none;
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 9999;
		background: #f0edff;
		color: #000000;
		border-top: 1px solid #5e65c2;
		padding: 12px 16px;
		font-family: Arial, Helvetica, sans-serif;
		font-size: 14px;
		box-sizing: border-box;
	}
	#pfg-cookie-consent .pfg-cookie-consent-inner {
		max-width: 1000px;
		margin: 0 auto;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	#pfg-cookie-consent a {
		color: #5e65c2;
		text-decoration: underline;
	}
	#pfg-cookie-consent button {
		background: #5e65c2;
		color: #ffffff;
		border: none;
		border-radius: 3px;
		padding: 6px 16px;
		cursor: pointer;
		font-size: 14px;
		white-space: nowrap;
	}
</style>
<script>
(function() {
	function pfgSetCookie(name, value, days) {
		var expires = "";
		if (days) {
			var date = new Date();
			date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
			expires = "; expires=" + date.toUTCString();
		}
		document.cookie = name + "=" + value + expires + "; path=/";
	}

	function pfgGetCookie(name) {
		var nameEq = name + "=";
		var parts = document.cookie.split(';');
		for (var i = 0; i < parts.length; i++) {
			var c = parts[i];
			while (c.charAt(0) === ' ') c = c.substring(1);
			if (c.indexOf(nameEq) === 0) return c.substring(nameEq.length);
		}
		return null;
	}

	function pfgShowCookieConsent() {
		if (pfgGetCookie('cookie_consent') === '1') return;

		var banner = document.createElement('div');
		banner.id = 'pfg-cookie-consent';
		banner.innerHTML =
			'<div class="pfg-cookie-consent-inner">' +
				'<span><?= addslashes($l['cookie-consent-message']) ?> ' +
				'<a href="/policy.php" target="_blank"><?= addslashes($l['cookie-consent-policy']) ?></a></span>' +
				'<button type="button"><?= addslashes($l['cookie-consent-accept']) ?></button>' +
			'</div>';

		document.body.appendChild(banner);
		banner.style.display = 'block';

		banner.querySelector('button').addEventListener('click', function() {
			pfgSetCookie('cookie_consent', '1', 365);
			banner.parentNode.removeChild(banner);
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', pfgShowCookieConsent);
	} else {
		pfgShowCookieConsent();
	}
})();
</script>
<?php endif; ?>
