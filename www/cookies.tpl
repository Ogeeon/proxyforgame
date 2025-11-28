<?php if ($_SERVER['HTTP_HOST'] == 'proxyforgame.com'): ?>
<link rel="stylesheet" type="text/css" href="//wpcc.io/lib/1.0.2/cookieconsent.min.css"/>
<script type="text/javascript" src="//wpcc.io/lib/1.0.2/cookieconsent.min.js"></script>
<script>
	window.addEventListener("load", function(){
		window.wpcc.init({"border":"thin","corners":"small","colors":{"popup":{"background":"#f0edff","text":"#000000","border":"#5e65c2"},
			"button":{"background":"#5e65c2","text":"#ffffff"}},"position":"bottom",
			"content":{"message":"This site uses cookies to personalize content and to store values you input in its calculators.",
			"href":"http://proxyforgame.com/policy.php"}})}
	);
</script>
<?php endif; ?>