# AI Labs

A sandbox monorepo showcasing functional AI workflows, from data enhancement to content generation.

## Overview

This repository contains a collection of experimental applications that demonstrate practical AI integrations for e-commerce and content management workflows. Each app is designed to solve real-world problems while exploring the capabilities of modern AI tools.

## Apps

| App | Description |
|-----|-------------|
| [spreadsheet-ai-import](./apps/spreadsheet-ai-import) | Import products from Excel spreadsheets into Crystallize PIM with AI-powered content enrichment |
| [ai-sidebar](./apps/ai-sidebar) | Crystallize side-by-side custom view that lets editors update item content (including nested pieces and chunks) through natural-language prompts, powered by Anthropic Claude |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/CrystallizeAPI/ai-lab.git
cd ai-lab

# Install dependencies
pnpm install
```

### Running an App

```bash
# Navigate to the app directory
cd apps/spreadsheet-ai-import

# Start the development server
pnpm dev
```

Each app is self-contained — see its own README for setup details (env vars, API keys, etc.). For example, `apps/ai-sidebar` is a Next.js app registered as a Crystallize custom view and requires Crystallize + Anthropic credentials; see [apps/ai-sidebar/README.md](./apps/ai-sidebar/README.md).

## Tech Stack

Varies per app. Current stacks in use:

- **spreadsheet-ai-import**: Vite + React + TypeScript, Tailwind CSS, OpenAI GPT
- **ai-sidebar**: Next.js 16 (App Router) + React 19 + TypeScript, Tailwind CSS 4, `@crystallize/js-api-client`, `@crystallize/app-signal`, Anthropic Claude
- **Package manager**: pnpm workspaces

## Contributing

Feel free to explore, experiment, and contribute! Each app has its own README with specific documentation.

## License

MIT © [Crystallize](https://crystallize.com)
