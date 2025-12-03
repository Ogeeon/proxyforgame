<script type="text/javascript">
    let theme = { value: 'light', validate: function(key, val) { return val; } };
    loadFromCookie('theme', theme);
    if (!theme) {
        saveToCookie('theme', theme);
    }
</script>

<table cellpadding="0" cellspacing="0" border="0">
    <tr>
        <td>
            <input id="cb-light-theme" type="checkbox" name="light-theme" class="ui-state-default ui-corner-all ui-input ui-input-margin"/>
        </td>
        <td>&nbsp;</td>
        <td>
            <div id="light-toggle" class="ui-state-default ui-corner-all" >
                <span class="ui-icon ui-icon-lightbulb"></span>
            </div>
        </td>
    </tr>
</table>
