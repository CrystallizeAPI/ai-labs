import {
  ValidatedRow,
  MassOperationsFile,
  CrystallizeReferenceData,
  CrystallizeFolder,
} from '../types';

function findFolderId(
  folders: CrystallizeFolder[],
  lvl1: string,
  lvl2: string,
  lvl3: string
): string | null {
  // Find the level 1 folder
  const lvl1Folder = folders.find(
    (f) => f.name?.toLowerCase() === lvl1.toLowerCase()
  );
  if (!lvl1Folder) return null;

  // Find the level 2 folder within level 1
  const lvl2Folder = lvl1Folder.children?.find(
    (f) => f.name?.toLowerCase() === lvl2.toLowerCase()
  );
  if (!lvl2Folder) return null;

  // Find the level 3 folder within level 2
  const lvl3Folder = lvl2Folder.children?.find(
    (f) => f.name?.toLowerCase() === lvl3.toLowerCase()
  );
  
  return lvl3Folder?.id || null;
}

function findBrandId(
  brandName: string,
  brands: CrystallizeReferenceData['brands']
): string | null {
  const brand = brands.find(
    (b) => b.name.toLowerCase() === brandName.toLowerCase()
  );
  return brand?.id || null;
}

export function generateMassOperations(
  rows: ValidatedRow[],
  referenceData: CrystallizeReferenceData,
  skipInvalid: boolean = false
): MassOperationsFile {
  const operations: MassOperationsFile['operations'] = [];

  const validRows = skipInvalid ? rows.filter((r) => r.isValid) : rows;

  for (const row of validRows) {
    const { data } = row;

    // Get brand ID
    const brandId = findBrandId(data.brand, referenceData.brands);

    // Get folder ID from the 3-level location
    const folderId = findFolderId(
      referenceData.folders,
      data.locationTopLvl,
      data.locationLvl2,
      data.locationLvl3
    );

    // Generate a reference name from SKU (remove special characters for valid ref)
    // Note: Avoid underscores as they cause issues with Handlebars
    const refName = `p${data.sku.replace(/[^a-zA-Z0-9]/g, '')}`;
    
    // Helper for conditional itemId reference (handles upsert create/update inconsistency)
    const itemIdRef = `{{#if ${refName}.id.id}}{{ ${refName}.id.id }}{{else}}{{ ${refName}.id }}{{/if}}`;

    // Parse price as a number
    const price = parseFloat(data.price) || 0;

    // Build variant with optional image
    const variant: Record<string, unknown> = {
      name: data.productName,
      sku: data.sku,
      isDefault: true,
      priceVariants: [
        {
          identifier: 'default',
          price: price,
        },
      ],
    };

    // Add image if provided - uses Crystallize's upload helper
    if (data.image && data.image.trim() !== '') {
      // Extract filename from URL for the key
      const imageUrl = data.image.trim();
      const urlParts = imageUrl.split('/');
      const filename = urlParts[urlParts.length - 1] || `${data.sku}.png`;
      
      variant.images = [
        {
          key: `{{ upload "${imageUrl}" }}`,
        },
      ];
    }

    // Generate the product/upsert operation for Instrument shape
    // Components are updated separately to avoid removing existing components
    const productOperation = {
      _ref: refName,
      intent: 'product/upsert',
      resourceIdentifier: data.sku,
      language: 'en',
      shapeIdentifier: 'instrument',
      name: data.productName,
      tree: {
        parentId: folderId,
      },
      vatTypeId: '{{ defaults.vatTypeIds.[0] }}',
      variants: [variant],
      externalReference: data.sku,
    };

    operations.push(productOperation);

    // Component update operations - each component is updated separately
    // This preserves any existing components not being updated

    // Short description component (richText) - only if provided
    if (data.shortDescription && data.shortDescription.trim() !== '') {
      operations.push({
        intent: 'item/updateComponent/item',
        itemId: itemIdRef,
        language: 'en',
        component: {
          componentId: 'short-description',
          richText: {
            json: [
              {
                kind: 'block',
                type: 'paragraph',
                textContent: data.shortDescription,
              },
            ],
          },
        },
      });
    }

    // Description component (richText)
    operations.push({
      intent: 'item/updateComponent/item',
      itemId: itemIdRef,
      language: 'en',
      component: {
        componentId: 'description',
        richText: {
          json: [
            {
              kind: 'block',
              type: 'paragraph',
              textContent: data.description,
            },
          ],
        },
      },
    });

    // SEO component (piece) - only if SEO fields are provided
    if ((data.seoTitle && data.seoTitle.trim() !== '') || 
        (data.seoDescription && data.seoDescription.trim() !== '')) {
      const seoComponents: Array<Record<string, unknown>> = [];
      
      // SEO Title is a singleLine
      if (data.seoTitle && data.seoTitle.trim() !== '') {
        seoComponents.push({
          componentId: 'title',
          singleLine: {
            text: data.seoTitle,
          },
        });
      }
      
      // SEO Description is richText (per shape model)
      if (data.seoDescription && data.seoDescription.trim() !== '') {
        seoComponents.push({
          componentId: 'description',
          richText: {
            json: [
              {
                kind: 'block',
                type: 'paragraph',
                textContent: data.seoDescription,
              },
            ],
          },
        });
      }

      if (seoComponents.length > 0) {
        operations.push({
          intent: 'item/updateComponent/item',
          itemId: itemIdRef,
          language: 'en',
          component: {
            componentId: 'seo',
            piece: {
              identifier: 'seo',
              components: seoComponents,
            },
          },
        });
      }
    }

    // Specs component (componentChoice > guitar piece) - only if color or material provided
    // Valid selection options from shape model:
    const VALID_BODY_MATERIALS = ['Alder', 'Mahogany', 'Maple', 'Spruce'];
    const VALID_FRETBOARD_MATERIALS = ['Rosewood', 'Maple', 'Ebony'];
    
    if ((data.color && data.color.trim() !== '') || (data.material && data.material.trim() !== '')) {
      const guitarComponents: Array<Record<string, unknown>> = [];

      // Add color if provided (singleLine - no validation needed)
      if (data.color && data.color.trim() !== '') {
        guitarComponents.push({
          componentId: 'color',
          singleLine: {
            text: data.color,
          },
        });
      }

      // Parse material field for fretboard and body info
      // Format is typically: "Rosewood Fingerboard, Alder Body" or "Maple Fingerboard, Ash Body"
      if (data.material && data.material.trim() !== '') {
        const materialParts = data.material.split(',').map(p => p.trim());
        
        for (const part of materialParts) {
          const lowerPart = part.toLowerCase();
          
          // Check for fretboard material
          if (lowerPart.includes('fingerboard') || lowerPart.includes('fretboard')) {
            // Extract material name (first word usually)
            const fretboardMatch = part.match(/^(\w+(?:\s+\w+)?)\s+(?:Fingerboard|Fretboard)/i);
            if (fretboardMatch) {
              const fretboardMaterial = fretboardMatch[1];
              // Only add if it's a valid option in the shape
              const validFretboard = VALID_FRETBOARD_MATERIALS.find(
                m => m.toLowerCase() === fretboardMaterial.toLowerCase()
              );
              if (validFretboard) {
                guitarComponents.push({
                  componentId: 'fretboard-material',
                  selection: {
                    keys: [validFretboard],
                  },
                });
              }
            }
          }
          
          // Check for body material
          if (lowerPart.includes('body')) {
            const bodyMatch = part.match(/^(\w+(?:\s+\w+)?)\s+Body/i);
            if (bodyMatch) {
              const bodyMaterial = bodyMatch[1];
              // Only add if it's a valid option in the shape
              const validBody = VALID_BODY_MATERIALS.find(
                m => m.toLowerCase() === bodyMaterial.toLowerCase()
              );
              if (validBody) {
                guitarComponents.push({
                  componentId: 'body-material',
                  selection: {
                    keys: [validBody],
                  },
                });
              }
            }
          }
        }
      }

      if (guitarComponents.length > 0) {
        operations.push({
          intent: 'item/updateComponent/item',
          itemId: itemIdRef,
          language: 'en',
          component: {
            componentId: 'specs',
            componentChoice: {
              componentId: 'guitar',
              piece: {
                identifier: 'guitar',
                components: guitarComponents,
              },
            },
          },
        });
      }
    }

    // Brand component (only if brandId exists)
    if (brandId) {
      operations.push({
        intent: 'item/updateComponent/item',
        itemId: itemIdRef,
        language: 'en',
        component: {
          componentId: 'brand',
          itemRelations: {
            itemIds: [brandId],
          },
        },
      });
    }
  }

  // Second pass: add related items operations at the end
  // These need to come after product creation so the referenced SKUs exist
  for (const row of rows) {
    if (!row.isValid && skipInvalid) continue;
    
    const data = row.data;
    if (data.relatedItems && data.relatedItems.trim() !== '') {
      const skus = data.relatedItems.split(',').map((sku) => sku.trim());
      const refName = `p${data.sku.replace(/[^a-zA-Z0-9]/g, '')}`;
      
      // Use conditional syntax to handle upsert inconsistency:
      // - Create returns { id: "..." }
      // - Update returns { id: { id: "..." } }
      const itemIdRef = `{{#if ${refName}.id.id}}{{ ${refName}.id.id }}{{else}}{{ ${refName}.id }}{{/if}}`;
      
      // Note: The Instrument shape doesn't have a related-items component defined,
      // but we'll include this in case it's added later or needs to be customized
      const relatedItemsOperation = {
        intent: 'item/updateComponent/item',
        itemId: itemIdRef,
        language: 'en',
        component: {
          componentId: 'related-items',
          itemRelations: {
            itemIds: [],
            skus,
          },
        },
      };
      
      operations.push(relatedItemsOperation);
    }
  }

  return {
    version: '0.0.1',
    operations,
  };
}

export function downloadOperationsFile(operations: MassOperationsFile): void {
  const json = JSON.stringify(operations, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `crystallize-import-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
