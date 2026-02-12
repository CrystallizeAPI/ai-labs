# AI Labs

A sandbox monorepo showcasing functional AI workflows, from data enhancement to content generation.

## Overview

This repository contains a collection of experimental applications that demonstrate practical AI integrations for e-commerce and content management workflows. Each app is designed to solve real-world problems while exploring the capabilities of modern AI tools.

## Apps

| App | Description |
|-----|-------------|
| [spreadsheet-ai-import](./apps/spreadsheet-ai-import) | Import products from Excel spreadsheets into Crystallize PIM with AI-powered content enrichment |

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

## Tech Stack

- **Build Tool**: Vite
- **Framework**: React + TypeScript
- **Styling**: Tailwind CSS
- **AI**: OpenAI GPT
- **Package Manager**: pnpm workspaces

## Contributing

Feel free to explore, experiment, and contribute! Each app has its own README with specific documentation.

## License

MIT © [Crystallize](https://crystallize.com)
