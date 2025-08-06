# MessageMind Setup Guide

## 🔧 **Fix AI Issues - API Key Configuration**

### **Problem:** "AI summary unavailable - no API key configured"

### **Solution:** Add your API keys to the environment

#### **1. Create `.env.local` file in your project root:**

```bash
# Create the environment file
touch .env.local
```

#### **2. Add your API keys to `.env.local`:**

```env
# AI API Keys (GPT takes priority, Hugging Face as fallback)
# Get your OpenAI API key from: https://platform.openai.com/api-keys
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here

# Get your Hugging Face API key from: https://huggingface.co/settings/tokens
NEXT_PUBLIC_HF_API_KEY=your_huggingface_api_key_here

# Matrix Configuration
NEXT_PUBLIC_MATRIX_HOMESERVER=https://your-homeserver.com
NEXT_PUBLIC_MATRIX_CLIENT_ID=your_client_id

# AI Model Configuration
NEXT_PUBLIC_GPT_MODEL=gpt-3.5-turbo
NEXT_PUBLIC_HF_MODEL=microsoft/DialoGPT-medium
NEXT_PUBLIC_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

#### **3. Get API Keys:**

**OpenAI API Key (Recommended for reliability):**
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy the key and replace `your_openai_api_key_here`

**Hugging Face API Key (Free alternative):**
1. Go to https://huggingface.co/settings/tokens
2. Create a new token
3. Copy the token and replace `your_huggingface_api_key_here`

#### **4. Restart your development server:**

```bash
# Stop the current server (Ctrl+C)
# Then restart
npm run dev
# or if using Docker
docker-compose down && docker-compose up
```

## 🔍 **Fix Semantic Search Issues**

### **Problem:** "No messages found" in semantic search

### **Solution:** The search should work after adding API keys

#### **Steps to verify:**

1. **Add API keys** (see above)
2. **Click "Analyze Messages"** in the AI Insights panel
3. **Wait for indexing** - you should see "Indexing messages for semantic search..."
4. **Try searching** - the search should now find relevant messages

#### **Debug steps if still not working:**

1. **Check browser console** for any errors
2. **Verify messages are being indexed** - look for console logs like:
   ```
   📦 Added message to vector storage. Total: X
   ```
3. **Check if embeddings are being generated** - look for:
   ```
   🔍 Generating embedding for text: ...
   ```

## 🧪 **Test the AI Features**

### **1. Test Summarization:**
- Click "Analyze Messages"
- Check if summaries are generated (should show actual summaries instead of "no API key configured")

### **2. Test Semantic Search:**
- Go to "Semantic Search" tab
- Try searching for: "help", "tap", "work", "meeting"
- Should find relevant messages

### **3. Test Intent Parsing:**
- Use the AI Test Panel (if available)
- Test with messages like: "Can you help me check my tap?"

## 🚀 **Expected Results After Setup**

### **✅ AI Summaries:**
- Should show actual conversation summaries
- Should include sentiment analysis (😊, 😐, 😔)
- Should show priority levels (high, medium, low)

### **✅ Semantic Search:**
- Should find messages when searching
- Should show similarity scores
- Should display message content and metadata

### **✅ Knowledge Base:**
- Should generate structured insights
- Should extract topics and participants
- Should show conversation patterns

## 🔧 **Troubleshooting**

### **If API keys don't work:**

1. **Check environment file location** - should be in project root
2. **Restart the server** - environment changes require restart
3. **Check API key format** - should be a long string without spaces
4. **Verify API key is valid** - test in browser console

### **If search still doesn't work:**

1. **Check browser console** for errors
2. **Verify messages are being processed** - look for indexing logs
3. **Try different search terms** - some terms might not match
4. **Check message content** - ensure messages have meaningful content

### **If Docker is used:**

```bash
# Rebuild with new environment
docker-compose down
docker-compose build --no-cache
docker-compose up
```

## 📞 **Need Help?**

If you're still having issues:

1. **Check the browser console** for error messages
2. **Verify your API keys** are working
3. **Try with just one API key** (OpenAI or Hugging Face)
4. **Check the network tab** for API call failures

