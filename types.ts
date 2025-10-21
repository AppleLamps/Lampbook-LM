export interface Source {
  id: string;
  name: string;
  type: 'txt' | 'pdf' | 'url';
  content: string;
  generating: boolean;
  excluded: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  activeSourcesContext?: Source[];
}

export type SynthesisFormat = 'summary' | 'flashcards' | 'outline';