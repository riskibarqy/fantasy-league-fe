SHELL := /bin/zsh
NPM ?= npm

.PHONY: help install dev build preview test test-watch typecheck check clean prepare-env

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
