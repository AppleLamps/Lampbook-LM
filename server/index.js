import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// URL fetching endpoint with Readability
app.post('/api/fetch-url', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    let validUrl;
    try {
      validUrl = new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Fetch the URL from server (no CORS restrictions)
    const response = await fetch(validUrl.href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to fetch URL: ${response.statusText}`
      });
    }

    const html = await response.text();

    // Parse with JSDOM
    const dom = new JSDOM(html, { url: validUrl.href });
    const document = dom.window.document;

    // Use Readability to extract main content
    const reader = new Readability(document);
    const article = reader.parse();

    if (!article) {
      // Fallback to basic text extraction if Readability fails
      const title = document.title || validUrl.hostname;
      const bodyText = document.body?.textContent || '';
      const content = bodyText.replace(/\s\s+/g, ' ').trim();

      return res.json({
        name: title,
        content: content,
        source: 'fallback'
      });
    }

    // Return cleaned article
    res.json({
      name: article.title || validUrl.hostname,
      content: article.textContent.replace(/\s\s+/g, ' ').trim(),
      excerpt: article.excerpt,
      byline: article.byline,
      source: 'readability'
    });

  } catch (error) {
    console.error('Error fetching URL:', error);
    res.status(500).json({
      error: 'Failed to fetch and parse URL',
      details: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`LampbookLM server running on http://localhost:${PORT}`);
  console.log(`Gemini API Key configured: ${process.env.GEMINI_API_KEY ? 'Yes' : 'No'}`);
});
