
// This declares the pdfjsLib object from the script tag in index.html
declare const pdfjsLib: any;

export const parseDocument = async (file: File): Promise<string> => {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();

  switch (fileExtension) {
    case 'txt':
      return parseTxt(file);
    case 'pdf':
      return parsePdf(file);
    default:
      throw new Error(`Unsupported file type: ${fileExtension}`);
  }
};

const parseTxt = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve(event.target?.result as string);
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsText(file);
  });
};

const parsePdf = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
  let textContent = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const text = await page.getTextContent();
    textContent += text.items.map((item: any) => item.str).join(' ');
    textContent += '\n\n'; // Add space between pages
  }

  return textContent;
};

export const parseUrl = async (url: string): Promise<{content: string, name: string}> => {
    try {
        // Use backend server to fetch URL (avoids CORS restrictions)
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

        const response = await fetch(`${API_URL}/api/fetch-url`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `Failed to fetch URL: ${response.statusText}`);
        }

        const data = await response.json();

        return {
            content: data.content,
            name: data.name
        };
    } catch (error) {
        console.error("Error parsing URL:", error);
        if (error instanceof Error) {
            if (error.message.includes('fetch')) {
                throw new Error("Could not connect to the server. Make sure the backend is running.");
            }
            throw error;
        }
        throw new Error("Could not parse content from the URL.");
    }
};