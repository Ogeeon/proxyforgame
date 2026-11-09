<?php
  // The sidebar's menu: rendered twice by sidebar.tpl, once in the fixed panel
  // for large screens and once in the offcanvas for small ones, so it must stay
  // free of ids. Reads $loc, $lang, $ogamePages and $currUrl from sidebar.tpl.
?>
    <div class="sidebar-panel bg-body-secondary text-primary-emphasis"><?=$loc['ogameMenuItems']['header']?> <small>(13.0)</small></div>
    <div class="list-group list-group-flush">
    <a class="list-group-item list-group-item-action ogame-menu-item text-center" href="/<?=$lang?>/"><?=$loc['ogameMenuItems']['main-title']?></a>
    <?php foreach ($ogamePages as $page): ?>
      <?php if ($page[0] !== ($currUrl ?? '')): ?>
        <a class="list-group-item list-group-item-action ogame-menu-item text-center" href="/<?=$lang.$page[0]?>"><?=$loc['ogameMenuItems'][$page[1]]?></a>
      <?php else: ?>
        <div class="list-group-item list-group-item-action ogame-menu-item active text-center"><?=$loc['ogameMenuItems'][$page[1]]?></div>
      <?php endif; ?>
    <?php endforeach; ?>
    </div>
    <div class="spacer"></div>
    <div class="sidebar-panel bg-body-secondary text-primary-emphasis"><?=$loc['ai-header']?></div>
    <div class="list-group list-group-flush">
    <?php if (($currUrl ?? '') !== '/mcp'): ?>
      <a class="list-group-item list-group-item-action ai-menu-item text-center" href="/<?=$lang?>/mcp"><?=$loc['ai-link']?></a>
    <?php else: ?>
      <div class="list-group-item list-group-item-action ai-menu-item active text-center"><?=$loc['ai-link']?></div>
    <?php endif; ?>
    </div>
    <div class="spacer"></div>
    <div class="sidebar-panel bg-body-secondary text-primary-emphasis"><?=$loc['feedbackItems']['header']?></div>
    <div class="list-group list-group-flush">
      <div class="list-group-item feedback text-center">
        <?=str_replace(['<br>', '<br/>'], ' ', $loc['feedbackItems']['misspelling'])?>
      </div>
      <div class="list-group-item feedback text-center">
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
    <div class="sidebar-panel bg-body-secondary text-primary-emphasis">Cookies</div>
    <div class="list-group list-group-flush">
      <div class="list-group-item feedback text-center">
        <a href="/policy.php" class="d-inline" target="_blank">Privacy Policy</a>
      </div>
    </div>
    <div class="spacer"></div>
    <div class="list-group list-group-flush">
      <div class="list-group-item text-center">
        <a href="https://github.com/Ogeeon/proxyforgame" target="_blank" rel="noopener noreferrer" data-bs-toggle="tooltip" title="ProxyForGame on GitHub">
          <i class="bi bi-github" style="font-size: 1.5rem;"></i>
        </a>
      </div>
      <div class="list-group-item changelog">
        <button type="button" class="btn btn-link changelog-open" onclick="requestAndShowChangelog(-1)"><?=$loc['changelogStrings']['changelog']?></button>
      </div>
    </div>
