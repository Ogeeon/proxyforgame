# ProxyForGame task runner.
#
# Requires GNU Make 4.x. The GnuWin32 3.81 build that ships on many Windows
# boxes is too old - install a current one with `choco install make`.
#
# Recipes deliberately run under the platform default shell: cmd.exe on
# Windows, /bin/sh on the CI runner. Every target here is a single command, so
# pinning SHELL to a Git-for-Windows sh.exe would buy nothing and cost two
# things - MSYS rewrites absolute Windows paths, and the Git coreutils are not
# on PATH anyway. Keep recipes to one command per line and use `cd x && y`
# when a target has to run inside a sub-project.

ifeq ($(OS),Windows_NT)
PHP ?= d:/wamp64/bin/php/php7.4.9/php.exe
else
PHP ?= php
endif

# Read by playwright.config.js. Exported so every recipe sees it.
PFG_BASE_URL ?= http://localhost:8000
export PFG_BASE_URL

PORT ?= 8000

DB_HOST ?= 127.0.0.1
DB_USER ?= pfg_usr
DB_PASS ?= secret
DB_NAME ?= proxyforgame

# Extra flags for `playwright install`; CI passes --with-deps.
PW_DEPS ?=

# Overrides `reporter` from playwright.config.js. `list` is the readable choice
# at a terminal; CI passes `list,html` because it uploads the HTML report as an
# artifact and a bare `list` would leave that upload with nothing to collect.
PW_REPORTER ?= list

.DEFAULT_GOAL := help

.PHONY: help install serve db-seed \
        test test-unit test-e2e test-e2e-ui test-one report \
        check audit quality coverage db-validate \
        i18n-validate i18n-report i18n-show i18n-fix \
        new-calc gen-test refactor assets docs

##@ General

help: ## Show this list
	@node scripts/make-help.js

install: ## Install test dependencies and Playwright browsers
	cd playwright-tests && npm ci
	cd playwright-tests && npx playwright install $(PW_DEPS)

##@ Local server

serve: ## Serve www/ with the built-in PHP server on PORT, default 8000
	"$(PHP)" -S localhost:$(PORT) -t www

db-seed: ## Import schema.sql into the configured database
	mysql -h$(DB_HOST) -u$(DB_USER) -p$(DB_PASS) $(DB_NAME) < schema.sql

##@ Tests

test: test-unit test-e2e ## Run both suites - the ritual required before a commit

test-unit: ## Run the node:test unit suite
	npm --prefix unit-tests test

test-e2e: ## Run the Playwright suite against PFG_BASE_URL
	cd playwright-tests && npx playwright test --reporter=$(PW_REPORTER)

test-e2e-ui: ## Open the interactive Playwright runner
	cd playwright-tests && npx playwright test --ui

test-one: ## Run a single spec, e.g. make test-one spec=flight
	$(if $(spec),,$(error Usage: make test-one spec=<name>))
	cd playwright-tests && npx playwright test $(spec) --reporter=$(PW_REPORTER)

report: ## Open the last Playwright HTML report
	cd playwright-tests && npx playwright show-report

##@ Quality gates

# `check` only chains things that are green on the current tree, so that a red
# `make check` always means "you broke something". The three reporters below
# all exit non-zero on pre-existing issues, so they live in `audit` instead and
# are prefixed with `-` there to keep one failure from hiding the other two.
check: i18n-validate test ## Green gate - what must pass before a commit

audit: ## Advisory reports; these flag pre-existing issues and do not gate
	-node scripts/check-test-coverage.js
	-node scripts/validate-database-schema.js

coverage: ## Report which calculators have no spec
	node scripts/check-test-coverage.js

db-validate: ## Compare schema.sql against the SqlQuery calls in PHP
	node scripts/validate-database-schema.js

##@ Translations

i18n-validate: ## Fail if any locale has drifted from en.json
	node scripts/validate-translations.js

i18n-report: ## Show translation completion per language
	node scripts/sync-translations.js --report

i18n-show: ## Show translation completion with the missing keys listed
	node scripts/sync-translations.js --report --show-keys

i18n-fix: ## Add missing keys to every locale as placeholders
	node scripts/sync-translations.js --fix

##@ Generators and maintenance

new-calc: ## Scaffold a calculator, e.g. make new-calc name=fleet-optimizer
	$(if $(name),,$(error Usage: make new-calc name=<calc>))
	node scripts/new-calculator.js $(name)

gen-test: ## Generate a spec template, e.g. make gen-test calc=graviton
	$(if $(calc),,$(error Usage: make gen-test calc=<calc>))
	node scripts/generate-test.js $(calc)

refactor: ## Analyse a calculator JS file, e.g. make refactor calc=flight
	$(if $(calc),,$(error Usage: make refactor calc=<calc>))
	node scripts/refactor-calculator.js $(calc) --analyze

assets: ## Add filemtime versioning to unversioned assets
	node scripts/update-asset-versions.js --apply

docs: ## Regenerate docs/calculators
	node scripts/generate-docs.js
