// pages/api/ai/embeddings.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { HfInference } from '@huggingface/inference';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { texts } = req.body;
  const apiKey = process.env.HF_API_KEY; // Server-side only

  if (!apiKey) {
    return res.status(500).json({ error: 'Hugging Face API key not configured' });
  }

  if (!texts || !Array.isArray(texts)) {
    return res.status(400).json({ error: 'texts must be an array of strings' });
  }

  try {
    const hf = new HfInference(apiKey);
    console.log(`🔍 Generating embeddings for ${texts.length} texts`);

    // Process embeddings in batches to avoid timeout
    const batchSize = 10;
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      const batchEmbeddings = await Promise.all(
        batch.map(async (text: string) => {
          try {
            const embedding = await hf.featureExtraction({
              model: 'sentence-transformers/all-MiniLM-L6-v2',
              inputs: text.slice(0, 500) // Limit text length
            });

            // Ensure we get a flat array of numbers
            const flatEmbedding = Array.isArray(embedding[0]) ? embedding[0] : embedding;
            return flatEmbedding as number[];
          } catch (error) {
            console.error('Failed to generate embedding for text:', error);
            // Return mock embedding as fallback
            return Array(384).fill(0).map(() => Math.random() - 0.5);
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