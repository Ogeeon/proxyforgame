'use strict';

// The commit the checkout is on, read straight from .git so that neither git
// nor a shell is needed. The server reports it as part of its version, which
// is how the watchdog tells a server that restarted after a deploy from one
// still running the code from before (deploy/README.md, "The MCP server").

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

/**
 * @param {string} [root] the checkout, by default the one this file is in
 * @returns {string} the full sha, or '' when it cannot be read
 */
function checkoutCommit(root = join(__dirname, '..', '..')) {
    const gitDir = join(root, '.git');
    try {
        const head = readFileSync(join(gitDir, 'HEAD'), 'utf8').trim();
        const ref = /^ref: (.+)$/.exec(head)?.[1];
        if (!ref) {
            return /^[0-9a-f]{40}$/.test(head) ? head : '';
        }
        try {
            return readFileSync(join(gitDir, ref), 'utf8').trim();
        } catch {
            // A ref git has packed lives in packed-refs instead of its own file.
            const packed = readFileSync(join(gitDir, 'packed-refs'), 'utf8');
            const line = packed.split('\n').find((l) => l.endsWith(` ${ref}`));
            return line ? line.slice(0, 40) : '';
        }
    } catch {
        return '';
    }
}

module.exports = { checkoutCommit };
