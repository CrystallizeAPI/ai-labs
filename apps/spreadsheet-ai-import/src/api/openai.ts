const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

export interface EnrichmentResult {
  shortDescription: string;
  seoTitle: string;
  seoDescription: string;
}

export interface EnrichmentRequest {
  sku: string;
  productName: string;
  description: string;
  brand: string;
  color?: string;
  material?: string;
  currentShortDescription?: string;
  currentSeoTitle?: string;
  currentSeoDescription?: string;
  customContext?: string;
}

export async function enrichProductWithAI(product: EnrichmentRequest): Promise<EnrichmentResult> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured. Add VITE_OPENAI_API_KEY to your .env file.');
  }

  const prompt = `You are a product content specialist for a musical instrument store. Generate marketing content for this product.
${product.customContext ? `\nAdditional Context from User:\n${product.customContext}\n` : ''}
Product Information:
- Name: ${product.productName}
- Brand: ${product.brand}
- SKU: ${product.sku}
${product.color ? `- Color: ${product.color}` : ''}
${product.material ? `- Material: ${product.material}` : ''}

Full Description:
${product.description}

${product.currentShortDescription ? `Current Short Description (improve if needed): ${product.currentShortDescription}` : ''}
${product.currentSeoTitle ? `Current SEO Title (improve if needed): ${product.currentSeoTitle}` : ''}
${product.currentSeoDescription ? `Current SEO Description (improve if needed): ${product.currentSeoDescription}` : ''}

Generate the following content in JSON format:
1. shortDescription: A compelling 1-2 sentence marketing teaser (max 200 characters) that highlights the key selling point
2. seoTitle: An SEO-optimized title (max 60 characters) including the brand and product type
3. seoDescription: An SEO meta description (max 155 characters) that encourages clicks

Return ONLY valid JSON with these three fields, no markdown or explanation.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a product content specialist. Always respond with valid JSON only, no markdown formatting.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} - ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No content returned from OpenAI');
  }

  try {
    // Try to parse JSON, handling potential markdown code blocks
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }
    
    const result = JSON.parse(jsonContent);
    
    return {
      shortDescription: result.shortDescription || '',
      seoTitle: result.seoTitle || '',
      seoDescription: result.seoDescription || '',
    };
  } catch (parseError) {
    console.error('Failed to parse OpenAI response:', content);
    throw new Error('Failed to parse AI response as JSON');
  }
}

export async function enrichProductsBatch(
  products: EnrichmentRequest[],
  customContext: string,
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, EnrichmentResult>> {
  const results = new Map<string, EnrichmentResult>();
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    try {
      const result = await enrichProductWithAI({ ...product, customContext });
      results.set(product.sku, result);
    } catch (error) {
      console.error(`Failed to enrich product ${product.sku}:`, error);
      // Continue with other products even if one fails
    }
    
    if (onProgress) {
      onProgress(i + 1, products.length);
    }
    
    // Small delay to avoid rate limiting
    if (i < products.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return results;
}

export function isOpenAIConfigured(): boolean {
  return !!OPENAI_API_KEY;
}
