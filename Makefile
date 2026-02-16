SHELL := /bin/zsh
NPM ?= npm

.PHONY: help install dev build preview test test-watch typecheck check clean prepare-env cap-copy cap-sync cap-sync-android cap-sync-ios mobile-android mobile-ios open-android open-ios

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*##"; print "Available commands:"} /^[a-zA-Z0-9_.-]+:.*##/ {printf "  %-14s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

prepare-env: ## Create .env from .env.example if missing
	@if [ ! -f .env ]; then cp .env.example .env; echo ".env created from .env.example"; else echo ".env already exists"; fi

install: ## Install dependencies
	$(NPM) install

dev: ## Run Vite dev server
	$(NPM) run dev

build: ## Build production bundle
	$(NPM) run build

preview: ## Preview production build
	$(NPM) run preview

test: ## Run unit tests once
	$(NPM) run test

test-watch: ## Run tests in watch mode
	$(NPM) run test:watch

typecheck: ## Run TypeScript type checks
	$(NPM) run typecheck

check: typecheck test build ## Run full validation suite

clean: ## Remove generated artifacts
	rm -rf dist coverage *.tsbuildinfo

cap-copy: ## Build app and copy web assets to native projects
	$(NPM) run cap:copy

cap-sync: ## Build app and sync all Capacitor platforms
	$(NPM) run cap:sync

cap-sync-android: ## Build app and sync Android platform
	$(NPM) run cap:sync:android

cap-sync-ios: ## Build app and sync iOS platform
	$(NPM) run cap:sync:ios

open-android: ## Open Android project in Android Studio
	$(NPM) run cap:open:android

open-ios: ## Open iOS project in Xcode
	$(NPM) run cap:open:ios

mobile-android: ## Build+sync then open Android Studio
	$(NPM) run mobile:android

mobile-ios: ## Build+sync then open Xcode
	$(NPM) run mobile:ios
