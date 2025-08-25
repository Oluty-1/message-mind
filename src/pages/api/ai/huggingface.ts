
import { NextRequest, NextResponse } from 'next/server';
import { HfInference } from '@huggingface/inference';

const hf = new HfInference(process.env.NEXT_PUBLIC_HF_API_KEY || process.env.HF_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { model, inputs, task, parameters = {} } = await request.json();

    if (!model || !inputs || !task) {
      return NextResponse.json(
        { error: 'Missing required parameters: model, inputs, task' },
        { status: 400 }
      );
    }

    console.log(`🤖 HF API: ${task} with model ${model}`);

    let result;

    switch (task) {
      case 'text-generation':
        try {
          result = await hf.textGeneration({
            model,
            inputs,
            parameters: {
              max_new_tokens: parameters.max_new_tokens || 50,
              temperature: parameters.temperature || 0.7,
              do_sample: parameters.do_sample !== false,
              return_full_text: false,
              ...parameters
            }
          });
          
          // Handle different response formats
          if (typeof result === 'string') {
            result = [{ generated_text: result }];
          } else if (result && !Array.isArray(result)) {
            result = [result];
          }
        } catch (error: any) {
          if (error.message?.includes('not found') || error.status === 404) {
            throw new Error(`Model ${model} not found or unavailable`);
          }
          throw error;
        }
        break;

      case 'text-classification':
        try {
          result = await hf.textClassification({
            model,
            inputs
          });
          
          if (!Array.isArray(result)) {
            result = [result];
          }
        } catch (error: any) {
          if (error.message?.includes('not found') || error.status === 404) {
            throw new Error(`Model ${model} not found or unavailable`);
          }
          throw error;
        }
        break;

      case 'summarization':
        try {
          result = await hf.summarization({
            model,
            inputs,
            parameters: {
              max_length: parameters.max_length || 100,
              min_length: parameters.min_length || 20,
              ...parameters
            }
          });
          
          if (!Array.isArray(result)) {
            result = [result];
          }
        } catch (error: any) {
          if (error.message?.includes('not found') || error.status === 404) {
            throw new Error(`Model ${model} not found or unavailable`);
          }
          throw error;
        }
        break;

      case 'feature-extraction':
        try {
          result = await hf.featureExtraction({
            model,
            inputs
          });
        } catch (error: any) {
          if (error.message?.includes('not found') || error.status === 404) {
            throw new Error(`Model ${model} not found or unavailable`);
          }
          throw error;
        }
        break;

      default:
        return NextResponse.json(
          { error: `Unsupported task: ${task}` },
          { status: 400 }
        );
    }

    console.log(`✅ HF API: ${task} completed successfully`);
    
    return NextResponse.json({ 
      result,
      model,
      task 
    });

  } catch (error: any) {
    console.error(`❌ HF API Error:`, error);
    
    // Handle specific error types
    if (error.message?.includes('not found') || error.message?.includes('unavailable')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    
    if (error.message?.includes('rate limit') || error.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }
    
    if (error.message?.includes('quota') || error.status === 402) {
      return NextResponse.json(
        { error: 'API quota exceeded. Please check your Hugging Face plan.' },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// For Pages Router (if you're using pages/api instead of app/api)
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { model, inputs, task, parameters = {} } = req.body;

    if (!model || !inputs || !task) {
      return res.status(400).json({ error: 'Missing required parameters: model, inputs, task' });
    }

    console.log(`🤖 HF API: ${task} with model ${model}`);

    let result;

    switch (task) {
      case 'text-generation':
        try {
          result = await hf.textGeneration({
            model,
            inputs,
            parameters: {
              max_new_tokens: parameters.max_new_tokens || 50,
              temperature: parameters.temperature || 0.7,
              do_sample: parameters.do_sample !== false,
              return_full_text: false,
              ...parameters
            }
          });
          
          if (typeof result === 'string') {
            result = [{ generated_text: result }];
          } else if (result && !Array.isArray(result)) {
            result = [result];
          }
        } catch (error: any) {
          if (error.message?.includes('not found') || error.status === 404) {
            throw new Error(`Model ${model} not found or unavailable`);
          }
          throw error;
        }
        break;

      case 'text-classification':
        try {
          result = await hf.textClassification({
            model,
            inputs
          });
          
          if (!Array.isArray(result)) {
            result = [result];
          }
        } catch (error: any) {
          if (error.message?.includes('not found') || error.status === 404) {
            throw new Error(`Model ${model} not found or unavailable`);
          }
          throw error;
        }
        break;

      case 'summarization':
        try {
          result = await hf.summarization({
            model,
            inputs,
            parameters: {
              max_length: parameters.max_length || 100,
              min_length: parameters.min_length || 20,
              ...parameters
            }
          });
          
          if (!Array.isArray(result)) {
            result = [result];
          }
        } catch (error: any) {
          if (error.message?.includes('not found') || error.status === 404) {
            throw new Error(`Model ${model} not found or unavailable`);
          }
          throw error;
        }
        break;

      case 'feature-extraction':
        try {
          result = await hf.featureExtraction({
            model,
            inputs
          });
        } catch (error: any) {
          if (error.message?.includes('not found') || error.status === 404) {
            throw new Error(`Model ${model} not found or unavailable`);
          }
          throw error;
        }
        break;

      default:
        return res.status(400).json({ error: `Unsupported task: ${task}` });
    }

    console.log(`✅ HF API: ${task} completed successfully`);
    
    return res.json({ 
      result,
      model,
      task 
    });

  } catch (error: any) {
    console.error(`❌ HF API Error:`, error);
    
    if (error.message?.includes('not found') || error.message?.includes('unavailable')) {
      return res.status(404).json({ error: error.message });
    }
    
    if (error.message?.includes('rate limit') || error.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }
    
    if (error.message?.includes('quota') || error.status === 402) {
      return res.status(402).json({ error: 'API quota exceeded. Please check your Hugging Face plan.' });
    }

    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}