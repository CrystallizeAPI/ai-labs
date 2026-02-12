# Crystallize Skills Library

You are an expert in Crystallize PIM (Product Information Management) system. Use this knowledge when helping with Crystallize-related tasks.

## Crystallize Overview

Crystallize is a headless PIM/commerce platform with:
- **GraphQL APIs** for all operations
- **Shapes** define content structure (like schemas)
- **Items** are instances of shapes (products, documents, folders)
- **Components** are building blocks within shapes (text, images, relations, etc.)

## API Endpoints

| API | URL Pattern | Purpose |
|-----|-------------|---------|
| Catalogue API | `https://api.crystallize.com/{tenant}/catalogue` | Read-only product/content queries |
| Core API | `https://api.crystallize.com/{tenant}` | Full CRUD operations |
| Search API | `https://api.crystallize.com/{tenant}/search` | Elasticsearch-powered search |
| Orders API | `https://api.crystallize.com/{tenant}/orders` | Order management |

## Authentication

All APIs require authentication headers:
```
X-Crystallize-Access-Token-Id: <token-id>
X-Crystallize-Access-Token-Secret: <token-secret>
```

## Key Concepts

### Shapes
Shapes define the structure of content. Types:
- `product` - For sellable items with variants
- `document` - For content pages, articles
- `folder` - For organizing content hierarchically

### Components
Building blocks within shapes:
- `singleLine` - Single line text
- `richText` - Rich text with formatting (uses JSON structure)
- `images` - Image array
- `itemRelations` - Links to other items
- `componentChoice` - Choose between component options
- `piece` - Group of components
- `selection` - Dropdown/multi-select from predefined options

### Products & Variants
- Products have one or more variants
- Each variant has: SKU, name, price, stock, images
- Price uses `priceVariants` with identifiers (e.g., "default")

## Common GraphQL Patterns

### Fetching Items by Path
```graphql
query GetItem($path: String!, $language: String!) {
  catalogue(path: $path, language: $language) {
    id
    name
    path
    ... on Product {
      variants {
        sku
        name
        priceVariants {
          identifier
          price
        }
      }
    }
  }
}
```

### Fetching Children (Folder Contents)
```graphql
query GetChildren($path: String!, $language: String!) {
  catalogue(path: $path, language: $language) {
    children {
      id
      name
      path
      type
    }
  }
}
```

### Search Products
```graphql
query SearchProducts($term: String!) {
  search(term: $term) {
    edges {
      node {
        id
        name
        path
        type
      }
    }
  }
}
```

## Mass Operations

For bulk imports/updates, use Mass Operations API:
1. Upload JSON file to S3 (via presigned URL)
2. Create bulk task
3. Start task
4. Poll for completion

### Mass Operations JSON Format
```json
{
  "version": "0.0.1",
  "operations": [
    {
      "_ref": "refName",
      "intent": "product/upsert",
      "language": "en",
      "shapeIdentifier": "product-shape",
      "name": "Product Name",
      "resourceIdentifier": "sku-123"
    }
  ]
}
```

### Common Intents
- `product/upsert` - Create or update product
- `document/upsert` - Create or update document
- `folder/upsert` - Create or update folder
- `item/updateComponent/item` - Update specific component
- `item/delete` - Delete an item

### Critical: Union Types in Mutations
All Core API mutations return union types. Always include fragments:

```graphql
mutation CreateTask($input: CreateMassOperationBulkTaskInput!) {
  createMassOperationBulkTask(input: $input) {
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

### Upsert Return Value Inconsistency
When using upsert intents, the return structure differs:
- **Create**: Returns `{ id: "abc123" }`
- **Update**: Returns `{ id: { id: "abc123" } }`

Use Handlebars conditional for cross-references:
```handlebars
{{#if refName.id.id}}{{ refName.id.id }}{{else}}{{ refName.id }}{{/if}}
```

## RichText JSON Format

RichText components use a specific JSON structure:
```json
{
  "json": [
    {
      "kind": "block",
      "type": "paragraph",
      "children": [
        {
          "kind": "inline",
          "type": "span",
          "textContent": "Your text here"
        }
      ]
    }
  ]
}
```

## Best Practices

1. **Use resourceIdentifier** for idempotent operations (SKU for products)
2. **Separate component updates** - Don't set components on upsert (replaces all)
3. **Use references** (`_ref`) for cross-operation dependencies
4. **Batch operations** for large imports
5. **Handle CORS** - Proxy S3 uploads in development

## Environment Variables

Typical Crystallize project setup:
```env
CRYSTALLIZE_TENANT_IDENTIFIER=your-tenant
CRYSTALLIZE_ACCESS_TOKEN_ID=your-token-id
CRYSTALLIZE_ACCESS_TOKEN_SECRET=your-token-secret
```

For Vite projects, prefix with `VITE_`:
```env
VITE_CRYSTALLIZE_TENANT_IDENTIFIER=your-tenant
```
