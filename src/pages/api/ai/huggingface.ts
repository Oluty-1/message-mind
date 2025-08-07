// pages/api/ai/huggingface.ts
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { model, inputs, task, parameters = {} } = req.body;
  const apiKey = process.env.HF_API_KEY; // Server-side only, no NEXT_PUBLIC_

  if (!apiKey) {
    return res.status(500).json({ error: 'Hugging Face API key not configured' });
  }

  if (!model || !inputs || !task) {
    return res.status(400).json({ error: 'Missing required fields: model, inputs, task' });
  }

  try {
    const apiUrl = `https://api-inference.huggingface.co/models/${model}`;
    
    console.log(`🤖 Calling HF API: ${task} with model: ${model}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs,
        parameters,
        options: {
          wait_for_model: true,
          use_cache: false
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HF API Error (${response.status}):`, errorText);
      
      // Handle specific errors more gracefully
      if (response.status === 503) {
        return res.status(503).json({ 
          error: 'Model is loading, please try again in a few moments',
          retryAfter: 30 
        });
      }
      
      if (response.status === 404) {
        return res.status(404).json({ 
          error: `Model ${model} not found or unavailable`,
          model
        });
      }
      
      if (response.status === 504) {
        return res.status(504).json({ 
          error: `Model ${model} timed out - please try again`,
          model
        });
      }
      
      throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 200)}`);
    }

    const result = await response.json();
    console.log(`✅ HF API Success for ${model}`);

    res.status(200).json({ 
      success: true, 
      result,
      task,
      model 
    });

  } catch (error: any) {
    console.error('❌ HF API proxy error:', error.message);
    res.status(500).json({ 
      error: error.message || 'Failed to call Hugging Face API',
      task,
      model 
    });
  }
}

// Export config to handle larger payloads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}