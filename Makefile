SHELL := /bin/zsh
NPM ?= npm
NPX ?= npx

CAP_APP_NAME ?= Fantasy Nusantara
CAP_APP_ID ?= com.riskibarqy.fantasynusantara
CAP_SERVER_URL ?=

.PHONY: help install dev build preview test test-watch typecheck check clean prepare-env \
	cap-install cap-init cap-add-android cap-add-ios cap-sync cap-copy cap-update \
	cap-open-android cap-open-ios cap-android cap-ios

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*##"; print "Available commands:"} /^[a-zA-Z0-9_.-]+:.*##/ {printf "  %-14s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

prepare-env: ## Create .env from .env.example if missing
	@if [ ! -f .env ]; then cp .env.example .env; echo ".env created from .env.example"; else echo ".env already exists"; fi

install: ## Install dependencies
	$(NPM) install

dev: ## Run Next.js dev server
	$(NPM) run dev

build: ## Build production bundle
	$(NPM) run build

preview: ## Run production server (after build)
	$(NPM) run preview

test: ## Run unit tests once
	$(NPM) run test

test-watch: ## Run tests in watch mode
	$(NPM) run test:watch

typecheck: ## Run TypeScript type checks
	$(NPM) run typecheck

check: typecheck test build ## Run full validation suite

clean: ## Remove generated artifacts
	rm -rf dist .next out coverage *.tsbuildinfo

cap-install: ## Install Capacitor dependencies
	$(NPM) install @capacitor/core @capacitor/android @capacitor/ios
	$(NPM) install -D @capacitor/cli

cap-init: ## Initialize Capacitor config (set CAP_APP_NAME / CAP_APP_ID to override)
	@if [ -f capacitor.config.ts ] || [ -f capacitor.config.json ]; then \
		echo "Capacitor config already exists. Skip init."; \
	else \
		$(NPX) cap init "$(CAP_APP_NAME)" "$(CAP_APP_ID)"; \
	fi

cap-add-android: ## Add Android platform project
	@if [ -d android ]; then \
		echo "android platform already exists. Skip."; \
	else \
		$(NPX) cap add android; \
	fi

cap-add-ios: ## Add iOS platform project
	@if [ -d ios ]; then \
		echo "ios platform already exists. Skip."; \
	else \
		$(NPX) cap add ios; \
	fi

cap-sync: ## Sync web assets and plugins to Android/iOS projects
	@if [ -n "$(CAP_SERVER_URL)" ]; then \
		echo "Syncing with remote web app: $(CAP_SERVER_URL)"; \
		CAP_SERVER_URL="$(CAP_SERVER_URL)" $(NPX) cap sync; \
	elif [ -f out/index.html ]; then \
		echo "Syncing local static export from ./out"; \
		$(NPX) cap sync; \
	else \
		echo "No web assets found for Capacitor sync."; \
		echo "Use remote mode: make cap-sync CAP_SERVER_URL=https://your-app.vercel.app"; \
		echo "Or provide local static export at ./out/index.html"; \
		exit 1; \
	fi

cap-copy: ## Copy web assets to native projects (without full plugin sync)
	$(NPX) cap copy

cap-update: ## Update native plugins (after plugin changes)
	$(NPX) cap update

cap-open-android: ## Open Android Studio project
	$(NPX) cap open android

cap-open-ios: ## Open Xcode project
	$(NPX) cap open ios

cap-android: cap-sync cap-open-android ## Sync and open Android

cap-ios: cap-sync cap-open-ios ## Sync and open iOS
