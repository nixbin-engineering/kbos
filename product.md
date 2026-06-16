Product Specification & Build Prompt
Project: KBOS (Knowledge Base Operating System)

Build a production-grade, self-hosted, local-first knowledge operating system whose primary design goal is longevity, portability, security, and zero vendor lock-in.

Vision

KBOS is not a wiki.

KBOS is a local-first knowledge operating system that uses plain Markdown files as the sole source of truth.

The application acts as an intelligent layer over a filesystem of notes, documents, attachments, templates, relationships, search indexes, and AI-assisted knowledge discovery.

If the application disappears tomorrow, users must still be able to access every note, template, attachment, encrypted document, and backup using documented open formats and the provided CLI.

Core Design Principles
Source of Truth

Markdown files stored on disk are the only authoritative content storage.

The system must never store authoritative note content in:

SQL databases
Vector databases
Search indexes
Proprietary formats

All indexes, caches, vectors, metadata stores, and graph structures must be rebuildable from the filesystem.

Local First

The application must:

Function fully offline
Require no cloud services
Support local-only deployments
Support local LLMs

Cloud integrations must be optional.

Human Readable Storage

User data should remain understandable and accessible outside the application.

Primary content:

docs/
templates/
assets/
config/

No proprietary file formats.

Delete-and-Rebuild Rule

The following directory must be entirely disposable:

.kb/

Users must be able to execute:

rm -rf .kb
kb rebuild

and recover all indexes and metadata from the filesystem.

Repository Structure
vault/

├── docs/
│   ├── home.md
│   ├── projects/
│   ├── research/
│   ├── journal/
│   └── archive/
│
├── templates/
│   ├── daily/
│   ├── weekly/
│   ├── project/
│   └── meeting/
│
├── assets/
│   ├── images/
│   ├── pdfs/
│   ├── videos/
│   └── audio/
│
├── config/
│   └── kb.yaml
│
└── .kb/
    ├── search/
    ├── vectors/
    ├── graph/
    ├── cache/
    └── backups/

Everything inside .kb/ is generated and disposable.

Technology Requirements
Backend

Preferred:

Go

Reasons:

Single binary deployment
Excellent filesystem handling
Easy Docker deployment
Low memory usage
Strong concurrency
Excellent CLI support
Frontend
React
Next.js
TypeScript
Tailwind
shadcn/ui
Search

Preferred:

Bleve

Requirements:

Full text search
Fuzzy search
Tag search
Metadata search
Folder search

No external search server required.

AI

Support provider abstraction.

Compatible with:

OpenAI-compatible APIs
Ollama
LM Studio
OpenRouter
Azure OpenAI
Anthropic-compatible providers

No hard dependency on any provider.

Content System
Markdown

Support:

CommonMark
GitHub Flavored Markdown
YAML Frontmatter

Example:

---
title: Docker Notes
tags:
  - docker
  - containers

aliases:
  - Docker Cheat Sheet

status: active

created: 2026-06-04
updated: 2026-06-04
---
Folder Hierarchy

Filesystem hierarchy equals UI hierarchy.

Folder Index Pages

Support:

linux/
├── index.md
├── docker.md
└── systemd.md

Index pages act as folder landing pages.

Wiki Links

Support Obsidian-style links.

[[docker]]

[[linux/systemd]]

[[project-a]]
Backlinks

Automatic backlink generation.

Display:

Referenced By

for every document.

Transclusion

Support:

![[docker]]

Document embed.

Support:

![[docker#Networking]]

Section embed.

Support:

![[docker^block123]]

Block embed.

Tags

Support:

#docker
#linux

and

tags:
  - docker

Tag explorer required.

Table of Contents

Generate automatically from headings.

Templates

Dedicated template system.

Directory:

templates/

Support nested folders.

Variables

Built-in:

{{title}}
{{date}}
{{datetime}}
{{uuid}}
{{year}}
{{month}}
{{week}}
{{cursor}}

Support custom variables.

Template Types

Support:

Daily notes
Weekly notes
Monthly notes
Quarterly notes
Yearly notes
Meeting notes
Project notes
Visualization
Mermaid

Full Mermaid support.

Examples:

flowcharts
sequence diagrams
gantt charts
mind maps

Render client-side.

Knowledge Graph

Interactive graph showing:

notes
backlinks
tags
folders
Mind Maps

Document-level mind maps.

Relationship Graph

Show:

related notes
backlinks
tags
Search
Full Text

Support indexing all markdown content.

Fuzzy Search

Typo tolerance.

Advanced Search

Examples:

tag:docker
folder:linux
title:networking
status:active

Combined queries supported.

Semantic Search

Optional AI-powered semantic retrieval.

Indexes stored under:

.kb/vectors/

Must be rebuildable.

Attachments

Support:

Images
PDFs
Audio
Video
ZIP
Content Addressable Storage

Store attachments by hash.

Benefits:

Deduplication
Integrity verification
Backup optimization
OCR

Support OCR indexing for:

PDFs
Images

Searchable through standard search.

Tasks

Support markdown task syntax.

- [ ] Upgrade server
- [x] Renew domain

Task dashboard required.

Journaling

Built-in support:

Daily
Weekly
Monthly
Yearly

Automatic template creation.

Encryption
Requirements

Support:

Per-document encryption
Per-folder encryption
Algorithms

Use:

AES-256-GCM
Argon2id
File Format

Open documented format.

Example:

note.md.enc
Independent Decryption

Users must be able to decrypt files without the web UI.

CLI support required.

Memory Safety

When unlocking encrypted content:

Decrypt only in memory
Never persist plaintext to disk
Never store plaintext in indexes

Encrypted content becomes searchable only while unlocked.

Backup System

First-class feature.

Backup Types
Full Snapshot

Encrypted vault backup.

Incremental Snapshot

Changed files only.

Encryption

Independent backup encryption.

Use:

AES-256-GCM
Argon2id
Verification

Support:

kb backup verify
Retention Policies

Configurable.

Scheduling

Support:

Daily
Weekly
Monthly
Backup Destinations

Support:

Local disk
Dropbox
Google Drive
OneDrive
Amazon S3
Backblaze B2
Wasabi
MinIO
SFTP
WebDAV

All via pluggable providers.

Git Integration

Optional.

Features:

Auto commit
Diff viewer
History viewer
Restore revision

Git is never required.

AI Layer
RAG

Use markdown content as retrieval source.

Scope Modes
Current Document

Ask questions about current note.

Current Folder

Ask questions about folder contents.

Entire Vault

Ask questions across all documents.

Citation Requirements

Every answer must cite source documents.

AI Features

Support:

Summaries
Note generation
Link recommendations
Tag recommendations
Relationship discovery
Semantic search
Multi-Vault

Support multiple vaults.

Example:

Personal
Research
Work
Homelab

Separate:

settings
encryption
AI indexes
Authentication

Modes:

Public

No login.

Local User

Username/password.

Reverse Proxy

Compatible with:

Authentik
Authelia
Keycloak
Themes

Support:

Light
Dark
Auto
Nord
Dracula
Solarized
Importers

Support importing:

Obsidian
Logseq
Notion exports
Joplin
Dendron
Exporters

Support exporting:

Markdown
HTML
PDF
ZIP
Encrypted Archive
Static Website
Plugin System

Required.

Plugins may extend:

Search
AI
Rendering
Backup providers
Importers
Exporters
REST API

Provide documented REST API.

WebSocket API

Provide realtime update support.

CLI

CLI must function independently of the web UI.

Required commands:

kb init
kb rebuild

kb encrypt
kb decrypt

kb lock
kb unlock

kb rekey

kb search

kb graph

kb backup create
kb backup restore
kb backup verify

kb export

kb import

kb doctor
Observability

Provide:

structured logging
audit logging
backup logs
indexing logs
AI query logs (optional)
Quality Requirements
Production-ready
Dockerized
Docker Compose support
Cross-platform
Unit tests
Integration tests
End-to-end tests
Security reviewed
Well documented
Modular architecture
Scalable to 100,000+ markdown documents
Low memory footprint
Fast startup
Non-Negotiable Architectural Constraints
Markdown files are the sole source of truth.
No database may contain authoritative user content.
.kb/ is fully disposable and rebuildable.
All encryption formats must be documented and independently decryptable.
All backups must be independently restorable.
No vendor lock-in.
Cloud services are optional.
The application must remain useful without AI.
Every user asset must remain accessible without the application.
The system should be maintainable and usable for decades.
