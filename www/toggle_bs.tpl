<script type="text/javascript">
    let theme = { value: 'light', validate: function(key, val) { return val; } };
    loadFromCookie('theme', theme);
    if (!theme) {
        saveToCookie('theme', theme);
    }
</script>

<div class="d-flex align-items-center">
    <input id="cb-light-theme" type="checkbox" name="light-theme" class="form-check-input"/>
    <div id="light-toggle" class="d-flex align-items-center justify-content-center" style="width: 2rem; height: 2rem; cursor: pointer;">
        <i class="bi bi-lightbulb"></i>
    </div>
</div>
