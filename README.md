<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# LampbookLM - AI-Powered Research Assistant

A powerful research assistant with RAG (Retrieval-Augmented Generation) capabilities, conversational memory, and streaming responses. Built with React, TypeScript, and Google's Gemini AI.

View the original app in AI Studio: https://ai.studio/apps/drive/1L9feqW929e_NuJ2vjJ0S6g9UAzKYPlgR

## 🚀 Latest Features

### 1. **Backend URL Fetching** 🌐
- ✅ Bypasses CORS restrictions with server-side fetching
- ✅ Uses Mozilla Readability for clean content extraction
- ✅ Filters out ads, navbars, and footers automatically

### 2. **Conversational Memory** 💭
- ✅ Full multi-turn conversation support
- ✅ Context-aware follow-up questions ("Why?", "Tell me more")
- ✅ Maintains chat history throughout the session

### 3. **RAG Implementation** 🔍
- ✅ Document chunking with smart boundary detection
- ✅ Vector embeddings using Gemini Embeddings API
- ✅ Semantic search for relevant content retrieval
- ✅ Scalable to hundreds of documents

### 4. **Enhanced UX** ✨
- ✅ **Toast Notifications**: Non-blocking notifications instead of alerts
- ✅ **Streaming Responses**: Real-time text generation with typing effect
- ✅ **Stop Generation Button**: Cancel ongoing AI responses
- ✅ **Smart Clear Options**: Separate "Clear Chat" and "Clear Workspace"

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **Google Gemini API key** - [Get one here](https://ai.google.dev/)

## 🛠️ Installation

### 1. Install Dependencies

```bash
# Frontend dependencies
npm install

# Backend dependencies
cd server
npm install
cd ..
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```env
GEMINI_API_KEY=your_api_key_here
VITE_API_URL=http://localhost:3001
```

Or use `.env.local` (both work).

## 🏃 Run Locally

### Option 1: Run Both Servers Together (Recommended)

```bash
npm run dev:all
```

This starts both backend and frontend in a single terminal! 🎉

### Option 2: Run Separately

**Terminal 1 - Backend Server:**
```bash
cd server
npm run dev
```
✅ Backend starts on `http://localhost:3001`

**Terminal 2 - Frontend:**
```bash
npm run dev
```
✅ Frontend starts on `http://localhost:3000`

---

Visit **`http://localhost:3000`** in your browser.

## 📚 How to Use

### Adding Sources
1. **Upload Files**: Click "Add Source Files" to upload .txt or .pdf files
2. **Add URLs**: Paste a URL and click "Add" to fetch web content
3. **View Sources**: Click on any source to preview its content

### Chatting
1. Type your question in the chat input
2. Press `Enter` to send (or `Shift+Enter` for new line)
3. Watch as the AI streams its response in real-time
4. Click **[1]** citations to jump to the source document

### Managing Your Workspace
- **Eye Icon**: Exclude/include sources from analysis
- **X Icon**: Delete a source
- **Clear Chat**: Remove conversation history (keeps sources)
- **Clear Workspace**: Remove everything (sources + chat)

### Synthesis Tools
- **Synthesize Summary**: Get a comprehensive overview
- **Create Outline**: See structured key points
- **Make Flashcards**: Generate Q&A study cards

## 🏗️ Architecture

```
LampbookLM/
├── server/                    # Express backend
│   ├── index.js              # URL fetching with Readability
│   └── package.json
├── services/                 # Frontend services
│   ├── geminiService.ts     # AI chat & streaming
│   ├── ragService.ts        # RAG pipeline
│   └── documentParser.ts    # File processing
├── hooks/
│   └── useLampbook.ts       # Main state management
├── components/              # React components
│   ├── ChatPanel.tsx        # Chat interface
│   ├── SourcePanel.tsx      # Source management
│   └── icons/
└── App.tsx                  # Main app component
```

## 🧠 How RAG Works

### 1. Document Ingestion
- Documents are chunked into 1000-character segments with 200-char overlap
- Each chunk is embedded using `text-embedding-004`
- Embeddings are stored in an in-memory vector database

### 2. Query Processing
- Your question is embedded into a vector
- Top 5 most similar chunks are retrieved using cosine similarity
- Only relevant excerpts are sent to Gemini (not entire documents!)

### 3. Response Generation
- Gemini generates streaming responses based on relevant chunks
- Citations are automatically added
- Conversation history is maintained for follow-ups

## 🔧 Technical Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Backend**: Express, Node.js
- **AI**: Google Gemini 2.5 Flash
- **Key Libraries**:
  - `@google/genai` - Gemini SDK
  - `@mozilla/readability` - Content extraction
  - `react-hot-toast` - Notifications
  - `jsdom` - HTML parsing

## 🚨 Troubleshooting

### Backend won't start
- Check that port 3001 is available
- Verify `GEMINI_API_KEY` is set in `.env`

### URL fetching fails
- Ensure backend is running
- Check URL is publicly accessible
- Some sites block automated scraping

### Slow responses
- First query generates embeddings (one-time cost per document)
- Large documents take longer to chunk
- Consider excluding unused sources

### Streaming not working
- Check browser console for errors
- Verify Gemini API key is valid
- Try refreshing the page

## 📦 Build for Production

```bash
# Frontend
npm run build

# Backend
cd server
npm start
```

## 🔮 Future Enhancements

- [ ] Persistent vector storage (IndexedDB or backend DB)
- [ ] Support for DOCX, HTML, Markdown
- [ ] Export chat history
- [ ] Custom chunk size configuration
- [ ] Multiple embedding models

## 📄 License

MIT

---

**Note**: This application requires a valid Google Gemini API key. API usage is subject to Google's pricing and rate limits.
