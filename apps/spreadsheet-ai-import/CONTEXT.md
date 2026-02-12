# AI Context Document

> This document captures the architecture, decisions, and lessons learned during development of this project. Share this with any AI assistant to provide full context.

---

## Project Overview

**Purpose**: A web-based tool to convert Excel (XLS/XLSX) files into Crystallize Mass Operations JSON format and execute them directly against the Crystallize API, with optional AI-powered content enrichment.

**Target Use Case**: Importing products into a Crystallize PIM tenant.

**Tech Stack**:
- React + TypeScript + Vite
- TailwindCSS for styling
- XLSX library for Excel parsing
- @glideapps/glide-data-grid for validation grid
- Crystallize Mass Operations API
- OpenAI API for AI content enrichment

---

## Architecture

### File Structure

```
examples/
└── Instruments import.xlsx  # Sample spreadsheet for import
src/
├── api/
│   ├── crystallize.ts      # All Crystallize API interactions
│   └── openai.ts           # OpenAI API for AI enrichment
├── components/
│   ├── FileDropZone.tsx    # Drag & drop file upload
│   ├── ValidationGrid.tsx  # Displays validated rows with errors & image preview
│   ├── OperationsPreview.tsx # Shows generated operations JSON
│   ├── AIEnrichment.tsx    # AI content enrichment UI
│   └── index.ts            # Component exports
├── utils/
│   ├── xlsParser.ts        # XLS → parsed rows
│   ├── validation.ts       # Validates rows against reference data
│   └── operationsGenerator.ts  # Generates mass operations JSON
├── types/
│   └── index.ts            # TypeScript interfaces
├── App.tsx                 # Main UI with 5-step workflow
└── main.tsx
```

### Data Flow

```
Excel File → Parse → Validate → AI Enrich → Generate Operations → Run in Crystallize
     ↓           ↓          ↓         ↓              ↓                  ↓
  Upload    xlsParser  validation  openai.ts  operationsGenerator   crystallize.ts
```

### UI Workflow (5 Steps)

1. **Upload** - User uploads XLS file
2. **Validate** - Rows validated against Crystallize reference data (folders, brands)
3. **Enrich** - Optional AI enrichment for Short Description, SEO Title, SEO Description
4. **Generate** - Creates mass operations JSON
5. **Run** - Executes operations in Crystallize (upload → create task → start → poll status)

---

## Crystallize Mass Operations API

### Key Discovery: Union Types Required

All Crystallize Core API mutations return **union types**. The documentation examples are simplified and don't work as-is.

**Wrong (from docs)**:
```graphql
mutation {
  createMassOperationBulkTask(input: {...}) {
    id
    status
  }
}
```

**Correct (what actually works)**:
```graphql
mutation {
  createMassOperationBulkTask(input: {...}) {
    ... on BulkTaskMassOperation {
      id
      status
    }
    ... on BasicError {
      error
      errorName
    }
  }
}
```

### API Endpoints

| Endpoint | URL | Auth |
|----------|-----|------|
| Core API | `https://api.crystallize.com/@{tenant}` | `X-Crystallize-Access-Token-Id`, `X-Crystallize-Access-Token-Secret` |
| S3 Upload | Presigned URL from `generatePresignedUploadRequest` | None (presigned) |

### 4-Step API Flow

1. **Get presigned URL**: `generatePresignedUploadRequest` mutation
2. **Upload to S3**: POST multipart/form-data to presigned URL
3. **Create bulk task**: `createMassOperationBulkTask` mutation with `autoStart: false`
4. **Start task**: `startMassOperationBulkTask` mutation
5. **Poll status**: `bulkTask` query until `complete` or `error`

### Key Fields

- `fields` from presigned request is `Array<{name, value}>`, not a simple object
- `key` must be extracted from fields: `fields.find(f => f.name === 'key').value`
- `info` field on bulkTask contains error details: `{ error, errorName, stack }`

### CORS Issue

S3 uploads from browser get blocked by CORS. Solution: Vite proxy in `vite.config.ts`:

```typescript
proxy: {
  '/api/s3-upload': {
    target: 'https://crystallize-mass-operations-production.s3.eu-central-1.amazonaws.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/s3-upload/, ''),
  },
}
```

### ngrok Support

For remote testing via ngrok, the Vite server is configured with allowed hosts:

```typescript
server: {
  allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev'],
}
```

The leading dot makes it a wildcard matching any subdomain.

---

## Critical Issue: Upsert Return Structure Inconsistency

When using `product/upsert` (or any `/upsert` intent), the return structure differs based on whether the backend performed a create or update:

| Action | Returns |
|--------|---------|
| Create | `{ id: "abc123" }` |
| Update | `{ id: { id: "abc123" } }` |

### Workaround

Use Handlebars conditional in cross-operation references:

```handlebars
{{#if refName.id.id}}{{ refName.id.id }}{{else}}{{ refName.id }}{{/if}}
```

This is implemented in `operationsGenerator.ts` for all `item/updateComponent/item` operations.

---

## Operations Generation Strategy

### Why Separate Component Updates?

Setting `components` array on `product/upsert` **replaces ALL components**, removing any not specified. 

**Solution**: 
1. `product/upsert` creates/updates the product WITHOUT components
2. Separate `item/updateComponent/item` operations for each component

### Generated Operations Per Instrument

1. `product/upsert` - Creates instrument with name, tree location, price, variants, image
2. `item/updateComponent/item` - short-description (richText) - if provided
3. `item/updateComponent/item` - description (richText)
4. `item/updateComponent/item` - seo (piece with title + description) - if SEO fields provided
5. `item/updateComponent/item` - specs (componentChoice > guitar piece) - if color/material provided
6. `item/updateComponent/item` - brand (itemRelations) - if exists
7. `item/updateComponent/item` - related-items (itemRelations) - if exists

---

## Shape & Component Structure

The tool generates operations for a configurable product shape with the following structure:

**Item-level Components**:
- `short-description` - richText
- `description` - richText (JSON format)
- `brand` - itemRelations (points to `/brands`)
- `seo` - piece with sub-components:
  - `title` (singleLine)
  - `description` (richText)

**Variant Components**:
- `priceVariants` with `identifier: "default"`
- `images` using upload helper: `{{ upload "url" }}`

---

## AI Enrichment

The tool includes optional AI-powered content enrichment using OpenAI's GPT-4o-mini:

**Enrichable Fields**:
- `shortDescription` - Compelling 1-2 sentence marketing teaser (max 200 chars)
- `seoTitle` - SEO-optimized title (max 60 chars)
- `seoDescription` - Meta description (max 155 chars)

**Custom Context**: Users can provide additional prompts to guide the AI, such as:
- "Target audience is professional users"
- "Use a playful, casual tone"

**Implementation** (`src/api/openai.ts`):
- `enrichProductWithAI()` - Single product enrichment
- `enrichProductsBatch()` - Batch processing with progress callback
- Uses product name, brand, description, color, material as context

---

## Material Parsing & Validation

The `material` field can be used for product specifications. Materials are validated against configured shape options.

---

## Excel Column Mapping

| Excel Column | Field Name | Usage |
|--------------|------------|-------|
| Sku | `sku` | Product identifier, variant SKU |
| Product Name | `productName` | Product/variant name |
| Price | `price` | Variant price (priceVariants with "default" identifier) |
| Image | `image` | Product image URL (uses upload helper) |
| Short Description | `shortDescription` | Short description component (can be AI-generated) |
| Description | `description` | Description component |
| Related Items | `relatedItems` | Comma-separated SKUs |
| Brand | `brand` | Brand item relation |
| Color | `color` | Product color |
| Material | `material` | Product material specifications |
| SEO Title | `seoTitle` | SEO piece title (can be AI-generated) |
| SEO Description | `seoDescription` | SEO piece description (can be AI-generated) |
| Location top lvl | `locationTopLvl` | Folder hierarchy level 1 |
| Location lvl2 | `locationLvl2` | Folder hierarchy level 2 |
| Location lvl3 | `locationLvl3` | Folder hierarchy level 3 |

---

## Reference Data Fetching

At startup, the app fetches from Crystallize:
- **Folders**: 3-level hierarchy for product placement
- **Brands**: Items under `/brands` for brand relations

This data is used for validation (checking if referenced folders/brands exist) and for resolving IDs.

---

## Environment Configuration

`.env` file:
```
VITE_CRYSTALLIZE_TENANT_IDENTIFIER=<tenant-identifier>
VITE_CRYSTALLIZE_ACCESS_TOKEN_ID=<token-id>
VITE_CRYSTALLIZE_ACCESS_TOKEN_SECRET=<token-secret>
VITE_OPENAI_API_KEY=<openai-api-key>
```

**Language**: `en` (English)

---

## Known Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| 400 Bad Request on mutations | Missing union fragments | Add `... on Type` fragments |
| Failed to fetch on S3 | CORS | Use Vite proxy |
| Task stuck in pending | autoStart not called | Call `startMassOperationBulkTask` |
| Component updates fail | Wrong itemId from upsert | Use conditional Handlebars |
| Components getting cleared | Setting components on upsert | Use separate updateComponent ops |
| Handlebars errors | Underscores in ref names | Remove special chars from refs |
| Price not showing | Wrong price format | Use `priceVariants` with `identifier: "default"` |
| Image upload fails | Using `src` instead of `key` | Use `key: {{ upload "url" }}` |

---

## Documentation Improvements

We created `docs/mass-operations-improvements.md` documenting issues with the official Crystallize documentation at https://crystallize.com/docs/developer/mass-operations including:
- Missing union type fragments
- Missing mutation/query examples
- Missing S3 upload code
- Upsert inconsistency workaround
- Complete working TypeScript example

---

## Useful Commands

```bash
# Development
npm run dev

# Run operations via CLI (alternative to UI)
~/crystallize mass-operation run <tenant> <file.json>

# Dump content model
~/crystallize mass-operation dump-content-model <tenant> <file>
```

---

## Future Improvements

- [ ] Add progress percentage during operation execution
- [ ] Add operation logs viewer (using `operationLogs` query)
- [ ] Add ability to re-run failed operations
- [ ] Production deployment (replace Vite proxy with server-side)
- [ ] Batch/chunk large imports
- [ ] Image validation (check URL accessibility)
- [ ] AI enrichment for other fields (e.g., description)

## Completed Features

- [x] Image upload support via `{{ upload "url" }}` helper
- [x] Image preview in validation grid
- [x] AI enrichment for Short Description, SEO Title, SEO Description
- [x] Custom context/prompt for AI enrichment
- [x] Price variants with "default" identifier
- [x] Direct import execution in Crystallize
- [x] Row selection for partial imports
- [x] Filter by validation status

---

*Last updated: February 2026*
