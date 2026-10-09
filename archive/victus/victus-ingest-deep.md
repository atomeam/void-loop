# Victus deep ingest (archive + hold + Desktop)

Generated: 2026-09-23T16:48:18.338299+00:00
Deep-only items: 146
Merged with surface: 206

## Deep-only counts by layer (six-layer skeleton)
- **Absorb**: 33
- **Bridge**: 5
- **Capability**: 10
- **Domain**: 1
- **Loop**: 3
- **Review**: 89
- **Runner**: 2
- **Void**: 3

## Deep-only counts by Loop object
- **Absorb**: 27
- **Capability**: 24
- **Domain**: 1
- **Review**: 87
- **Waste**: 7

## Layer: Void

### `_archive_old_mono\apps\void`
- source: archive_apps
- loop_object: Capability
- tag: void_app
- rationale: Archive app 'void' salvages into layer Void; rebuild under A-to-Mind, don't run from archive.

### `Desktop\a-to-mind-board`
- source: desktop
- loop_object: Capability
- tag: desktop_surface
- rationale: Desktop project folder -> Void
- package: a-to-mind-board — React Router Cloudflare D1 template
- head: Welcome to React Router on Cloudflare Workers with D1!

### `hold\apps\void`
- source: hold
- loop_object: Capability
- tag: void
- rationale: hold/apps/void -> Void
- package: void — 

## Layer: Bridge

### `_archive_old_mono\apps\backend`
- source: archive_apps
- loop_object: Capability
- tag: backend_api
- rationale: Archive app 'backend' salvages into layer Bridge; rebuild under A-to-Mind, don't run from archive.
- package: @aether/backend — 

### `_archive_old_mono\apps\bridge`
- source: archive_apps
- loop_object: Capability
- tag: bridge_app
- rationale: Archive app 'bridge' salvages into layer Bridge; rebuild under A-to-Mind, don't run from archive.
- package: @aether/bridge — 
- head: Aether Bridge

### `_archive_old_mono\packages\api-gateway`
- source: archive_packages
- loop_object: Capability
- tag: bridge
- rationale: Shared package candidate for Bridge
- package: @aether/api-gateway — 
- head: @aether/api-gateway

### `hold`
- source: hold
- loop_object: Capability
- tag: phase_1_5_spine
- rationale: Declared Phase 1.5 execution plane; bridge + hold-gate + ledger. Canonical live spine.
- head: hold

### `hold\apps\bridge`
- source: hold
- loop_object: Capability
- tag: bridge_worker
- rationale: hold/apps/bridge -> Bridge
- package: bridge — 

## Layer: Loop

### `_archive_old_mono\packages\ledger`
- source: archive_packages
- loop_object: Capability
- tag: loop
- rationale: Shared package candidate for Loop
- package: @aether/ledger — 
- head: @aether/ledger

### `_archive_old_mono\packages\signed-provenance`
- source: archive_packages
- loop_object: Capability
- tag: loop
- rationale: Shared package candidate for Loop
- package: @aether/signed-provenance — 

### `hold\packages\ledger`
- source: hold
- loop_object: Capability
- tag: evidence_ledger
- rationale: hold/packages/ledger -> Loop

## Layer: Runner

### `_archive_old_mono\apps\crew-room`
- source: archive_apps
- loop_object: Capability
- tag: crew_room
- rationale: Archive app 'crew-room' salvages into layer Runner; rebuild under A-to-Mind, don't run from archive.
- package: @aether/crew-room — 

### `_archive_old_mono\packages\test-runner`
- source: archive_packages
- loop_object: Capability
- tag: runner
- rationale: Shared package candidate for Runner
- package: @aether/test-runner — 
- head: @aether/test-runner

## Layer: Capability

### `_archive_old_mono\apps\ambient`
- source: archive_apps
- loop_object: Capability
- tag: ambient_app
- rationale: Archive app 'ambient' salvages into layer Capability; rebuild under A-to-Mind, don't run from archive.
- package: @aether/ambient — 

### `_archive_old_mono\apps\frontend`
- source: archive_apps
- loop_object: Capability
- tag: frontend_app
- rationale: Archive app 'frontend' salvages into layer Capability; rebuild under A-to-Mind, don't run from archive.
- package: @aether/frontend — 

### `_archive_old_mono\apps\homebase`
- source: archive_apps
- loop_object: Capability
- tag: homebase_app
- rationale: Archive app 'homebase' salvages into layer Capability; rebuild under A-to-Mind, don't run from archive.
- head: Automation Consolidation v2

### `_archive_old_mono\apps\notion-worker`
- source: archive_apps
- loop_object: Capability
- tag: notion_worker
- rationale: Archive app 'notion-worker' salvages into layer Capability; rebuild under A-to-Mind, don't run from archive.
- package: @aether/notion-worker — 
- head: Notion Worker

### `_archive_old_mono\apps\ops-cockpit`
- source: archive_apps
- loop_object: Capability
- tag: ops_cockpit
- rationale: Archive app 'ops-cockpit' salvages into layer Capability; rebuild under A-to-Mind, don't run from archive.
- package: @aether/ops-cockpit — 

### `_archive_old_mono\apps\stripe-sentinel`
- source: archive_apps
- loop_object: Capability
- tag: stripe_sentinel
- rationale: Archive app 'stripe-sentinel' salvages into layer Capability; rebuild under A-to-Mind, don't run from archive.
- package: @aether/stripe-sentinel — Portable revenue insurance primitive - Stripe webhook processing with DLQ resilience
- head: Stripe Sentinel (Revenue Insurance Primitive)

### `_archive_old_mono\packages\deploy-automation`
- source: archive_packages
- loop_object: Capability
- tag: capability
- rationale: Shared package candidate for Capability
- package: @aether/deploy-automation — 

### `_archive_old_mono\packages\monitoring`
- source: archive_packages
- loop_object: Capability
- tag: capability
- rationale: Shared package candidate for Capability
- package: @aether/monitoring — 

### `_archive_old_mono\packages\notion-connector`
- source: archive_packages
- loop_object: Capability
- tag: capability
- rationale: Shared package candidate for Capability
- package: @aether/notion-connector — 
- head: @aether/notion-connector

### `Desktop\atom-deploy`
- source: desktop
- loop_object: Capability
- tag: desktop_surface
- rationale: Desktop project folder -> Capability
- head: A-to-Mind / Blackglass — Full State

## Layer: Domain

### `_archive_old_mono\apps\provenance-marketplace`
- source: archive_apps
- loop_object: Domain
- tag: provenance_marketplace
- rationale: Archive app 'provenance-marketplace' salvages into layer Domain; rebuild under A-to-Mind, don't run from archive.
- package: provenance-marketplace — 
- head: React + TypeScript + Vite

## Layer: Absorb

### `_archive_old_mono\AETHER-UNIFIED-Graph.html`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: <!DOCTYPE html>

### `_archive_old_mono\aether-unified-graph.json`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: {

### `_archive_old_mono\AGENT-HUB-ASSESSMENT.md`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: Aether Agent Hub - Assessment & Action Plan

### `_archive_old_mono\AGENT-SYSTEM-DOCUMENTATION.md`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: Aether Agent System - Comprehensive Documentation

### `_archive_old_mono\AGENT_UTILITY_LAYER.md`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: a-to-mind Agent Utility Layer

### `_archive_old_mono\AGENTS.md`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: Aether - ALPHA Stack Monorepo

### `_archive_old_mono\API-DOCUMENTATION.md`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: Aether API Documentation

### `_archive_old_mono\API.md`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: Aether API Documentation

### `_archive_old_mono\API_SPEC.md`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: a-to-mind API Specification

### `_archive_old_mono\ARCHITECTURE.md`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: Aether System Architecture

### `_archive_old_mono\AUTOMATION_SYSTEMS_COMPLETE.md`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: 🚀 Complete Autonomous Automation Suite - Summary

### `_archive_old_mono\AUTONOMOUS-MONEY-GENERATION-COMPLETE.md`
- source: archive_docs
- loop_object: Waste
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: Autonomous Money Generation - Complete Implementation

### `_archive_old_mono\AUTONOMOUS-REVENUE-GENERATION-COMPLETE.md`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: Autonomous Revenue Generation - Complete Summary

### `_archive_old_mono\AUTONOMOUS_SAAS_BUILDER_COMPLETE.md`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: 🚀 World's Most Advanced Autonomous Micro-SaaS Builder - Complete (11/10 Smart + 11/10 Safe)

### `_archive_old_mono\COMPLETE-MONETIZATION-SUMMARY.md`
- source: archive_docs
- loop_object: Waste
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: COMPLETE MONETIZATION SUMMARY - 3 DIFFERENT STRATEGIES

### `_archive_old_mono\EXTERNAL_SYSTEMS_UPDATE_GUIDE.md`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: External Systems Secret Update Guide

### `_archive_old_mono\FINAL-AUTONOMOUS-SYSTEM.md`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: FINAL AUTONOMOUS MONETIZATION SYSTEM - COMPLETE

### `_archive_old_mono\GITHUB_ACTIONS_AUTOMATION_COMPLETE.md`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: 🔀 GitHub Actions Automation - Complete

### `_archive_old_mono\GITHUB_AUTOMATION_COMPLETE.md`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: 🔀 GitHub Automation - Complete

### `_archive_old_mono\GITHUB_AUTOMATION_ELIMINATED_MANUAL_STEPS.md`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: 🚀 GitHub Automation - Complete Elimination of Manual Steps

### `_archive_old_mono\openapi.json`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: {

### `_archive_old_mono\RAPIDAPI-MONETIZATION-PLAN.md`
- source: archive_docs
- loop_object: Waste
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: RapidAPI Monetization Plan - Cloudflare Workers

### `_archive_old_mono\RECONCILIATION_SAAS_COMPLETE.md`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: 🔄 Reconciliation SaaS Automation - Complete

### `_archive_old_mono\RELIABILITY_SYSTEMS_COMPLETE.md`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: 🎉 Reliability Systems - Complete Implementation Summary

### `_archive_old_mono\REVENUE_ANALYTICS_COMPLETE.md`
- source: archive_docs
- loop_object: Absorb
- tag: archive_doc
- rationale: Archive system doc — Absorb patterns; Waste if monetization theater
- head: 📊 Unified Revenue & Analytics Dashboard - Complete

### `Desktop\A-to-Mind_12_Experiments.md`
- source: desktop
- loop_object: Absorb
- tag: desktop_thesis
- rationale: Architecture / experiments — Absorb into system design, not public copy
- head: A-to-Mind: 12 Executable AI Experiments

### `Desktop\A-to-Mind_Site_Architecture.md`
- source: desktop
- loop_object: Absorb
- tag: desktop_thesis
- rationale: Architecture / experiments — Absorb into system design, not public copy
- head: A-to-Mind Site Architecture

### `Desktop\A-to-Mind_Site_Architecture_Experimental.md`
- source: desktop
- loop_object: Absorb
- tag: desktop_thesis
- rationale: Architecture / experiments — Absorb into system design, not public copy
- head: A-to-Mind Site Architecture (Experimental Lab Model)

### `Desktop\A-to-Mind_Venture_Portfolio.md`
- source: desktop
- loop_object: Waste
- tag: desktop_thesis
- rationale: Desktop thesis — Waste if claims/monetization pitch; else Absorb for architecture memory
- head: A-to-Mind Initial Venture Portfolio

### `Desktop\AI_Monetization_Models_Database.md`
- source: desktop
- loop_object: Waste
- tag: desktop_thesis
- rationale: Desktop thesis — Waste if claims/monetization pitch; else Absorb for architecture memory
- head: COMPREHENSIVE DATABASE OF 100 LEGITIMATE AI MONETIZATION MODELS

### `Desktop\AI_Monetization_Models_Ranking.md`
- source: desktop
- loop_object: Waste
- tag: desktop_thesis
- rationale: Desktop thesis — Waste if claims/monetization pitch; else Absorb for architecture memory
- head: AI Monetization Models Ranking & Analysis

### `hold\AGENTS.md`
- source: hold
- loop_object: Absorb
- tag: contract_doc
- rationale: Hold contract / agents rules — Absorb into Loop doctrine
- head: Agent contract

### `hold\README.md`
- source: hold
- loop_object: Absorb
- tag: contract_doc
- rationale: Hold contract / agents rules — Absorb into Loop doctrine
- head: hold

## Layer: Review

### `_archive_old_mono`
- source: archive
- loop_object: Waste
- tag: old_body
- rationale: Full old Aether body — ore only. Do not revive as tree. Mine apps/packages/docs.
- package: aether — 
- head: Aether - Autonomous Agent Teams

### `_archive_old_mono\packages\adversarial`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/adversarial — 

### `_archive_old_mono\packages\alerts`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/alerts — 
- head: @aether/alerts

### `_archive_old_mono\packages\ambient-core`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/ambient-core — 

### `_archive_old_mono\packages\auth`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/auth — 
- head: @aether/auth

### `_archive_old_mono\packages\automation`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/automation — 

### `_archive_old_mono\packages\browser-automation`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review

### `_archive_old_mono\packages\chaos`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/chaos — 
- head: @aether/chaos

### `_archive_old_mono\packages\ci-cd`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/ci-cd — 
- head: @aether/ci-cd

### `_archive_old_mono\packages\circuit-breaker`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review

### `_archive_old_mono\packages\cli`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/cli — Aether CLI - Command-line interface for project scaffolding, package management, deployment, and development
- head: @aether/cli

### `_archive_old_mono\packages\cloud-providers`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/cloud-providers — 

### `_archive_old_mono\packages\cms`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/cms — 

### `_archive_old_mono\packages\codegen`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/codegen — Aether Code Generation - Generate components, API clients, schemas, types, and boilerplate

### `_archive_old_mono\packages\compactor`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/compactor — 

### `_archive_old_mono\packages\components`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/components — 
- head: @aether/components

### `_archive_old_mono\packages\config`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review

### `_archive_old_mono\packages\context-truncate`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/context-truncate — 

### `_archive_old_mono\packages\contracts`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/contracts — 
- head: @aether/logger

### `_archive_old_mono\packages\convene`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/convene — 

### `_archive_old_mono\packages\council`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/council — 

### `_archive_old_mono\packages\credential-injector`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/credential-injector — 

### `_archive_old_mono\packages\credential-recovery`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/credential-recovery — 

### `_archive_old_mono\packages\curator`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/curator — 
- head: @aether/curator

### `_archive_old_mono\packages\curator-audit`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/curator-audit — 

### `_archive_old_mono\packages\daemon`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @loxa/daemon — 

### `_archive_old_mono\packages\dashboards`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/dashboards — 

### `_archive_old_mono\packages\database`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/database — Database abstraction layer with support for PostgreSQL, MySQL, SQLite, and MongoDB
- head: @aether/database

### `_archive_old_mono\packages\docs`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/docs — Documentation generation and management tools for the Aether monorepo

### `_archive_old_mono\packages\dream`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/dream — 

### `_archive_old_mono\packages\env`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/env — 
- head: @aether/env

### `_archive_old_mono\packages\errors`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/errors — 

### `_archive_old_mono\packages\etl`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/etl — 
- head: @aether/etl

### `_archive_old_mono\packages\file-system`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review

### `_archive_old_mono\packages\foresight`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/foresight — 

### `_archive_old_mono\packages\gemini-browser`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/gemini-browser — 
- head: @aether/gemini-browser - Smart Gemini Browser Control

### `_archive_old_mono\packages\github-automation`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/github-automation — 

### `_archive_old_mono\packages\goals`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/goals — 

### `_archive_old_mono\packages\governance`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/governance — 
- head: @aether/governance

### `_archive_old_mono\packages\graphify`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/graphify — 

### `_archive_old_mono\packages\http-client`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/http-client — 

### `_archive_old_mono\packages\human-queue`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/human-queue — 

### `_archive_old_mono\packages\idempotency`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review

### `_archive_old_mono\packages\infrastructure`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/infrastructure — 
- head: @aether/infrastructure

### `_archive_old_mono\packages\kv-writers`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/kv-writers — 

### `_archive_old_mono\packages\lessons`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/lessons — 

### `_archive_old_mono\packages\llm-router`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/llm-router — LLM routing and load balancing for multiple AI providers (OpenAI, Anthropic, Google)
- head: @aether/llm-router

### `_archive_old_mono\packages\logger`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/logger — 
- head: @aether/logger

### `_archive_old_mono\packages\mcp-tools`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/mcp-tools — 
- head: @aether/mcp-tools

### `_archive_old_mono\packages\media`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/media — 

### `_archive_old_mono\packages\metrics`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/metrics — 

### `_archive_old_mono\packages\ml-core`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/ml-core — 

### `_archive_old_mono\packages\mobile-core`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/mobile-core — 

### `_archive_old_mono\packages\network-health`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/network-health — 

### `_archive_old_mono\packages\notifier`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/notifier — 

### `_archive_old_mono\packages\observability`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/observability — 

### `_archive_old_mono\packages\panic`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/panic — 

### `_archive_old_mono\packages\payments`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/payments — 

### `_archive_old_mono\packages\profile`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/profile — 

### `_archive_old_mono\packages\prompt-optimizer`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/prompt-optimizer — Prompt engineering optimization library with A/B testing, metrics tracking, and template system
- head: @aether/prompt-optimizer

### `_archive_old_mono\packages\pwa`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/pwa — 

### `_archive_old_mono\packages\rag-engine`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/rag-engine — Retrieval Augmented Generation engine with vector database abstraction, document chunking, and citation tracking
- head: @aether/rag-engine

### `_archive_old_mono\packages\rate-limiter`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/rate-limiter — 

### `_archive_old_mono\packages\replay`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/replay — 

### `_archive_old_mono\packages\reports`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/reports — 

### `_archive_old_mono\packages\responsive`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/responsive — 

### `_archive_old_mono\packages\retry`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review

### `_archive_old_mono\packages\sandbox`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/sandbox — 

### `_archive_old_mono\packages\sanitization`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/sanitization — 

### `_archive_old_mono\packages\scheduler`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/scheduler — 

### `_archive_old_mono\packages\scheduling`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/scheduling — 

### `_archive_old_mono\packages\secrets`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/secrets — 

### `_archive_old_mono\packages\storage`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/storage — File storage abstraction with support for S3, local filesystem, and Cloudflare R2

### `_archive_old_mono\packages\storyteller`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/storyteller — 

### `_archive_old_mono\packages\streaming`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/streaming — 
- head: @aether/streaming

### `_archive_old_mono\packages\substrates`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/substrates — Game substrate patterns for Aether

### `_archive_old_mono\packages\telemetry`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/telemetry — 

### `_archive_old_mono\packages\throttle`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/throttle — 

### `_archive_old_mono\packages\timecapsule`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/timecapsule — 

### `_archive_old_mono\packages\tombstone`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/tombstone — 

### `_archive_old_mono\packages\triage`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/triage — 

### `_archive_old_mono\packages\ui-core`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/ui-core — 

### `_archive_old_mono\packages\unbought`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/unbought — 

### `_archive_old_mono\packages\validation`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/validation — 

### `_archive_old_mono\packages\vitalsigns`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/vitalsigns — 

### `_archive_old_mono\packages\web3-core`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/web3-core — 

### `_archive_old_mono\packages\websocket-server`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/websocket-server — 

### `_archive_old_mono\packages\workflow`
- source: archive_packages
- loop_object: Review
- tag: unmatched
- rationale: Shared package candidate for Review
- package: @aether/workflow — 

### `Desktop\%USERPROFILE%`
- source: desktop
- loop_object: Capability
- tag: unmatched
- rationale: Desktop project folder -> Review
