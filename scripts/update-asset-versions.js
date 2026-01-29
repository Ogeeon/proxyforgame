#!/usr/bin/env node

/**
 * Asset Version Updater for ProxyForGame
 *
 * Scans templates for asset references and updates them with filemtime()
 * versioning parameters. This ensures browser cache busting when assets change.
 *
 * Run: node scripts/update-asset-versions.js [--check] [--apply]
 * Example: node scripts/update-asset-versions.js --check
 */

const fs = require('fs');
const path = require('path');

const WWW_DIR = path.join(__dirname, '..', 'www');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function colorize(text, color) {
  return `${color}${text}${colors.reset}`;
}

/**
 * Find all TPL files
 */
function findTemplateFiles() {
  const files = [];

  function scanDir(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else if (item.endsWith('.tpl')) {
        files.push(fullPath);
      }
    }
  }

  scanDir(WWW_DIR);
  return files;
}

/**
 * Extract asset references from a template
 */
function extractAssetReferences(content) {
  const references = [];

  // Match script tags with src
  const scriptRegex = /<script[^>]+src=["']([^"']+)["'][^>]*>/g;
  let match;
  while ((match = scriptRegex.exec(content)) !== null) {
    const fullTag = match[0];
    const src = match[1];
    const hasVersion = fullTag.includes('?v=');

    references.push({
      type: 'script',
      src: src,
      hasVersion: hasVersion,
      tag: fullTag,
      position: match.index
    });
  }

  // Match link tags with href
  const linkRegex = /<link[^>]+href=["']([^"']+)["'][^>]*>/g;
  while ((match = linkRegex.exec(content)) !== null) {
    const fullTag = match[0];
    const href = match[1];
    const hasVersion = fullTag.includes('?v=');

    // Only check CSS files
    if (href.includes('.css')) {
      references.push({
        type: 'stylesheet',
        href: href,
        hasVersion: hasVersion,
        tag: fullTag,
        position: match.index
      });
    }
  }

  return references;
}

/**
 * Check if an asset exists and needs versioning
 */
function checkAsset(assetPath) {
  const fullPath = path.join(WWW_DIR, assetPath.replace(/^\//, ''));

  if (!fs.existsSync(fullPath)) {
    return { exists: false, needsVersion: false };
  }

  const stat = fs.statSync(fullPath);
  return {
    exists: true,
    needsVersion: true,
    mtime: stat.mtimeMs,
    path: fullPath
  };
}

/**
 * Analyze a template file
 */
function analyzeTemplate(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const references = extractAssetReferences(content);

  const analysis = {
    filePath: path.relative(WWW_DIR, filePath),
    total: references.length,
    versioned: 0,
    unversioned: [],
    missing: [],
    issues: []
  };

  for (const ref of references) {
    const assetPath = ref.src || ref.href;
    const assetInfo = checkAsset(assetPath);

    if (!assetInfo.exists) {
      analysis.missing.push({
        type: ref.type,
        path: assetPath
      });
    } else if (!ref.hasVersion && assetInfo.needsVersion) {
      analysis.unversioned.push({
        type: ref.type,
        path: assetPath,
        mtime: assetInfo.mtime
      });
    } else {
      analysis.versioned++;
    }
  }

  return analysis;
}

/**
 * Print analysis report
 */
function printAnalysisReport(results) {
  console.log('\n' + colorize('═════════════════════════════════════════════════════════', colors.cyan));
  console.log(colorize('               Asset Version Report', colors.cyan));
  console.log(colorize('═════════════════════════════════════════════════════════', colors.cyan));

  let totalUnversioned = 0;
  let totalMissing = 0;
  let filesWithIssues = 0;

  for (const result of results) {
    if (result.unversioned.length > 0 || result.missing.length > 0) {
      filesWithIssues++;
      console.log(colorize(`\n📄 ${result.filePath}`, colors.blue));

      if (result.unversioned.length > 0) {
        totalUnversioned += result.unversioned.length;
        console.log(colorize(`  ⚠️  Unversioned assets (${result.unversioned.length}):`, colors.yellow));
        result.unversioned.slice(0, 5).forEach(asset => {
          console.log(colorize(`     - ${asset.path}`, colors.gray));
        });
        if (result.unversioned.length > 5) {
          console.log(colorize(`     ... and ${result.unversioned.length - 5} more`, colors.gray));
        }
      }

      if (result.missing.length > 0) {
        totalMissing += result.missing.length;
        console.log(colorize(`  ❌ Missing assets (${result.missing.length}):`, colors.red));
        result.missing.forEach(asset => {
          console.log(colorize(`     - ${asset.path}`, colors.gray));
        });
      }
    }
  }

  if (filesWithIssues === 0) {
    console.log(colorize('\n✅ All assets are properly versioned!', colors.green));
  } else {
    console.log('\n' + colorize('──────────────────────────────────────────────────────────', colors.gray));
    console.log(colorize(`\nTemplates with issues: ${filesWithIssues}`, colors.yellow));
    console.log(colorize(`Total unversioned assets: ${totalUnversioned}`, totalUnversioned > 0 ? colors.yellow : colors.green));
    console.log(colorize(`Total missing assets: ${totalMissing}`, totalMissing > 0 ? colors.red : colors.green));

    console.log(colorize('\nRun with --apply to add versioning to unversioned assets.', colors.gray));
  }

  console.log('\n' + colorize('──────────────────────────────────────────────────────────', colors.gray));

  return filesWithIssues === 0;
}

/**
 * Add versioning to assets in a template
 */
function addVersioning(filePath, dryRun = false) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let updatedContent = content;

  // Process script tags
  updatedContent = updatedContent.replace(
    /<script([^>]+)src=["']([^"']+)["']([^>]*)>/g,
    (match, beforeSrc, src, afterSrc) => {
      // Skip if already has version
      if (src.includes('?v=')) {
        return match;
      }

      const assetPath = path.join(WWW_DIR, src.replace(/^\//, ''));
      if (!fs.existsSync(assetPath)) {
        return match;
      }

      const stat = fs.statSync(assetPath);
      const version = `?v=${Math.floor(stat.mtimeMs / 1000)}`;

      modified = true;
      return `<script${beforeSrc}src="${src}${version}"${afterSrc}>`;
    }
  );

  // Process link tags
  updatedContent = updatedContent.replace(
    /<link([^>]+)href=["']([^"']+\.css)["']([^>]*)>/g,
    (match, beforeHref, href, afterHref) => {
      // Skip if already has version
      if (href.includes('?v=')) {
        return match;
      }

      const assetPath = path.join(WWW_DIR, href.replace(/^\//, ''));
      if (!fs.existsSync(assetPath)) {
        return match;
      }

      const stat = fs.statSync(assetPath);
      const version = `?v=${Math.floor(stat.mtimeMs / 1000)}`;

      modified = true;
      return `<link${beforeHref}href="${href}${version}"${afterHref}>`;
    }
  );

  if (modified && !dryRun) {
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    return { modified: true };
  }

  return { modified, wouldModify: modified };
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const checkMode = args.includes('--check');
  const applyMode = args.includes('--apply');

  console.log('\n' + colorize('═════════════════════════════════════════════════════════', colors.cyan));
  console.log(colorize('              Asset Version Checker', colors.cyan));
  console.log(colorize('═════════════════════════════════════════════════════════', colors.cyan));

  // Find all template files
  console.log(colorize('\nScanning for template files...', colors.gray));
  const templateFiles = findTemplateFiles();
  console.log(colorize(`Found ${templateFiles.length} template files`, colors.blue));

  // Analyze each template
  const results = templateFiles.map(filePath => analyzeTemplate(filePath));

  // Print report
  const allGood = printAnalysisReport(results);

  // Apply if requested
  if (applyMode && !allGood) {
    console.log(colorize('\nApplying versioning...', colors.cyan));

    let modifiedCount = 0;
    for (const result of results) {
      if (result.unversioned.length > 0) {
        const fullPath = path.join(WWW_DIR, result.filePath);
        const { modified } = addVersioning(fullPath, false);
        if (modified) {
          modifiedCount++;
          console.log(colorize(`  ✓ Updated ${result.filePath}`, colors.green));
        }
      }
    }

    console.log(colorize(`\n✅ Updated ${modifiedCount} template file(s)`, colors.green));
  }

  process.exit(allGood ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { analyzeTemplate, addVersioning };
