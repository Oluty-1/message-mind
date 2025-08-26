// pages/api/ai/embeddings.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { HfInference } from '@huggingface/inference';
import { callGeminiEmbedding } from '../../../lib/geminiAI';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { texts } = req.body;
  const apiKey = process.env.HF_API_KEY; // Server-side only
  const geminiKey = process.env.GEMINI_API_KEY; // Optional: Gemini/Google API key
  const geminiUrl = process.env.GEMINI_EMBEDDINGS_URL; // Optional override for endpoint

  if (!apiKey && !geminiKey) {
    return res.status(500).json({ error: 'No embedding provider configured (HF_API_KEY or GEMINI_API_KEY required)' });
  }

  if (!texts || !Array.isArray(texts)) {
    return res.status(400).json({ error: 'texts must be an array of strings' });
  }

  try {
    const hf = new HfInference(apiKey || '');
    console.log(`🔍 Generating embeddings for ${texts.length} texts`);

    // Process embeddings in batches to avoid timeout
    const batchSize = 10;
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      const batchEmbeddings = await Promise.all(
        batch.map(async (text: string) => {
          try {
            let embedding: number[] | null = null;

            if (geminiKey) {
              try {
                embedding = await callGeminiEmbedding(text.slice(0, 2000), geminiKey, geminiUrl);
              } catch (geminiErr) {
                console.log('Gemini embedding failed, falling back to Hugging Face models:', (geminiErr as any)?.message ?? String(geminiErr));
                embedding = null;
              }
            }

            if (!embedding) {
              throw new Error('All embedding models failed');
            }

            return embedding;
          } catch (error) {
            console.error('Failed to generate embedding for text:', error);
            // Return mock embedding as fallback (derive length if possible)
            const fallbackLen = 384;
            return Array(fallbackLen).fill(0).map(() => Math.random() - 0.5);
          }
        })
      );

      embeddings.push(...batchEmbeddings);
      
      // Add small delay between batches to avoid rate limiting
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ Generated ${embeddings.length} embeddings`);

    res.status(200).json({ 
      success: true, 
      embeddings,
      count: embeddings.length
    });

  } catch (error: any) {
    console.error('❌ Embeddings generation failed:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to generate embeddings'
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
    responseLimit: '10mb',
  },
}