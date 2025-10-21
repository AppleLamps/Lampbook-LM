
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
        // NOTE: This client-side fetch is subject to CORS restrictions.
        // A server-side proxy would be required for robust URL fetching.
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.statusText}`);
        }
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const name = doc.title || url;
        // A simple text extraction. For better results, a library like Readability.js would be ideal.
        const content = doc.body.textContent || '';
        
        // Remove excessive whitespace
        return { content: content.replace(/\s\s+/g, ' ').trim(), name };
    } catch (error) {
        console.error("Error parsing URL:", error);
        if (error instanceof Error && error.message.includes('Failed to fetch')) {
            throw new Error("Could not fetch the URL. This might be due to CORS policy. Try a different URL or upload a file instead.");
        }
        throw new Error("Could not parse content from the URL.");
    }
};