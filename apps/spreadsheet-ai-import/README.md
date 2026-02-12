# Spreadsheet Import for Crystallize

A web application for importing products into Crystallize PIM from Excel spreadsheets, with optional AI-powered content enrichment.

📺 **Watch the livestream**: [Using this app on YouTube](https://www.youtube.com/watch?v=GZndu-QF02s)

## Overview

This tool allows you to:
1. Upload an Excel spreadsheet with product data
2. Validate the data against your Crystallize tenant (brands, folders, SKUs)
3. Preview validation results in an interactive data grid
4. **AI Enrichment** - Generate Short Description, SEO Title, and SEO Description using ChatGPT
5. Generate a Crystallize mass operations JSON file for import
6. Run the import directly against the Crystallize API

## Features

- **Drag & Drop Upload**: Easy file upload with drag-and-drop support
- **Real-time Validation**: Validates data against Crystallize API
- **Interactive Data Grid**: View and filter validation results using Glide Data Grid
- **Image Preview**: See product images directly in the grid
- **Row Selection**: Select specific rows to generate partial imports
- **AI Enrichment**: Generate or improve Short Description, SEO Title, SEO Description with custom prompts
- **Direct Import**: Run mass operations directly in Crystallize without downloading
- **Resizable Columns**: Adjust column widths for better visibility
- **Tooltips**: Hover over cells to see validation error details
- **Filter Options**: Filter by All/Valid/Invalid rows

## Excel File Format

The spreadsheet must contain the following columns:

| Column | Required | Description |
|--------|----------|-------------|
| `Sku` | ✓ | Product variant SKU (unique identifier) |
| `Product Name` | ✓ | Product name |
| `Price` | ✓ | Product price |
| `Description` | ✓ | Full product description (richText) |
| `Brand` | ✓ | Brand name (must exist in Crystallize at `/brands`) |
| `Location top lvl` | ✓ | Folder path level 1 |
| `Location lvl2` | ✓ | Folder path level 2 |
| `Location lvl3` | ✓ | Folder path level 3 |
| `Image` | | Product image URL |
| `Short Description` | | Short marketing teaser (can be AI-generated) |
| `SEO Title` | | SEO title (can be AI-generated) |
| `SEO Description` | | SEO meta description (can be AI-generated) |
| `Color` | | Product color |
| `Material` | | Material info |
| `Related Items` | | Comma-separated SKUs for related products |
## Example Files

An example spreadsheet is included in the `examples/` folder:

- `Instruments import.xlsx` - Sample product import for musical instruments
## Validation

The tool performs the following validations:

### Required Fields
SKU, Product Name, Price, Description, Brand, and all three location levels must be non-empty.

### Brand Validation
Checks if the brand name exists in Crystallize at `/brands`.

### Folder Validation
Validates the 3-level folder path exists in Crystallize.

### Related Items SKU Validation
Two-phase validation:
1. **File Check**: First checks if SKUs exist within the same spreadsheet
2. **Crystallize Check**: For SKUs not in the file, queries Crystallize in batches to verify they exist

## AI Enrichment

The tool includes an optional AI enrichment step powered by OpenAI's GPT-4o-mini:

- **Short Description**: Generates a compelling 1-2 sentence marketing teaser (max 200 chars)
- **SEO Title**: Creates an SEO-optimized title (max 60 chars) with brand and product type
- **SEO Description**: Writes a meta description (max 155 chars) that encourages clicks

### Custom Context
You can provide additional context to guide the AI, such as:
- "Target audience is professional users"
- "Use a playful, casual tone"
- "Focus on quality and durability"

## Generated Operations Format

The tool generates a Crystallize mass operations JSON file:

```json
{
  "version": "0.0.1",
  "operations": [
    {
      "_ref": "pSKU123",
      "intent": "product/upsert",
      "resourceIdentifier": "<sku>",
      "language": "en",
      "shapeIdentifier": "<shape>",
      "name": "<productName>",
      "tree": {
        "parentId": "<folder-id>"
      },
      "vatTypeId": "{{ defaults.vatTypeIds.[0] }}",
      "variants": [
        {
          "name": "<productName>",
          "sku": "<sku>",
          "isDefault": true,
          "priceVariants": [{ "identifier": "default", "price": 999 }],
          "images": [{ "key": "{{ upload \"<imageUrl>\" }}" }]
        }
      ],
      "externalReference": "<sku>"
    },
    {
      "intent": "item/updateComponent/item",
      "itemId": "{{#if pSKU123.id.id}}{{ pSKU123.id.id }}{{else}}{{ pSKU123.id }}{{/if}}",
      "language": "en",
      "component": {
        "componentId": "short-description",
        "richText": { "json": [...] }
      }
    },
    {
      "intent": "item/updateComponent/item",
      "component": {
        "componentId": "seo",
        "piece": {
          "identifier": "seo",
          "components": [
            { "componentId": "title", "singleLine": { "text": "<seoTitle>" } },
            { "componentId": "description", "richText": { "json": [...] } }
          ]
        }
      }
    },
    {
      "intent": "item/updateComponent/item",
      "component": {
        "componentId": "specs",
        "componentChoice": {
          "componentId": "guitar",
          "piece": {
            "identifier": "guitar",
            "components": [
              { "componentId": "color", "singleLine": { "text": "<color>" } },
              { "componentId": "body-material", "selection": { "keys": ["Alder"] } },
              { "componentId": "fretboard-material", "selection": { "keys": ["Rosewood"] } }
            ]
          }
        }
      }
    },
    {
      "intent": "item/updateComponent/item",
      "component": {
        "componentId": "brand",
        "itemRelations": { "itemIds": ["<brand-id>"] }
      }
    }
  ]
}
```

## Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Configuration

Create a `.env` file with your Crystallize credentials:

```env
VITE_CRYSTALLIZE_TENANT_IDENTIFIER=livestream-content-modeling
VITE_CRYSTALLIZE_ACCESS_TOKEN_ID=your-access-token-id
VITE_CRYSTALLIZE_ACCESS_TOKEN_SECRET=your-access-token-secret
```

For AI enrichment, add your OpenAI API key:

```env
VITE_OPENAI_API_KEY=your-openai-api-key
```

### Development

```bash
npm run dev
```

The app will open automatically in your default browser.

### ngrok Support

The dev server is configured to accept connections from ngrok tunnels (`.ngrok-free.app` and `.ngrok-free.dev` domains) for remote testing.

### Build

```bash
npm run build
```

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Glide Data Grid** - Spreadsheet component
- **xlsx** - Excel file parsing
- **Tailwind CSS** - Styling
- **OpenAI API** - AI content enrichment

## API Integration

The tool connects to the Crystallize Catalogue API to fetch:
- Brands from `/brands`
- Folders (3 levels deep)
- Product variants by SKU (for related items validation)

It also connects to the Crystallize Mass Operations API to run imports directly.

---

*Last updated: February 2026*
