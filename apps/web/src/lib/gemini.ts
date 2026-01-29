import { GoogleGenAI } from '@google/genai';

// Gemini AI client singleton
let geminiClient: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  if (geminiClient) {
    return geminiClient;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable');
  }

  geminiClient = new GoogleGenAI({ apiKey });
  return geminiClient;
}

// Model configuration from environment
export function getModelConfig() {
  return {
    classify: process.env.GEMINI_MODEL_CLASSIFY || 'gemini-2.5-flash',
    rag: process.env.GEMINI_MODEL_RAG || 'gemini-2.5-flash',
    pack: process.env.GEMINI_MODEL_PACK || 'gemini-2.5-flash',
    inkCaption: process.env.GEMINI_MODEL_INK_CAPTION || 'gemini-2.5-flash',
    embedding: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
  };
}

// Embedding dimensions (must match database schema)
const EMBEDDING_DIMENSIONS = 768;

// Generate embedding for text (768 dimensions for database compatibility)
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getGemini();
  
  const result = await client.models.embedContent({
    model: getModelConfig().embedding,
    contents: text,
    config: {
      outputDimensionality: EMBEDDING_DIMENSIONS,
    },
  });

  return result.embeddings?.[0]?.values || [];
}

// Classify note content
export interface ClassifyResult {
  proposed_category_name: string;
  confidence: number;
  new_category_reason: string | null;
  language_mix: Record<string, number>;
}

export async function classifyNote(
  noteText: string,
  existingCategories: string[],
  recentCategories: string[]
): Promise<ClassifyResult> {
  const client = getGemini();

  const systemPrompt = `You are a note classification assistant. Your job is to categorize notes into appropriate categories.

Output ONLY a valid JSON object with no additional text. The JSON must have this exact structure:
{
  "proposed_category_name": "category name (existing or new)",
  "confidence": 0.0 to 1.0,
  "new_category_reason": "reason if new category, null otherwise",
  "language_mix": {"ja": 0.0 to 1.0, "en": 0.0 to 1.0}
}

Rules:
- If an existing category fits well (confidence >= 0.7), use it
- If no existing category fits, propose a new one with a reason
- Analyze the language mix (Japanese vs English vs other)
- Keep category names concise (1-3 words)
- Output ONLY the JSON, no markdown code blocks`;

  const userPrompt = `Note content:
"""
${noteText}
"""

Existing categories: ${existingCategories.length > 0 ? existingCategories.join(', ') : 'None'}
Recently used categories: ${recentCategories.length > 0 ? recentCategories.join(', ') : 'None'}`;

  const result = await client.models.generateContent({
    model: getModelConfig().classify,
    contents: `${systemPrompt}\n\n${userPrompt}`,
    config: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });

  const content = result.text;

  if (!content) {
    throw new Error('No response from classification model');
  }

  try {
    const parsed = JSON.parse(content);
    return {
      proposed_category_name: parsed.proposed_category_name || 'Uncategorized',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      new_category_reason: parsed.new_category_reason || null,
      language_mix: parsed.language_mix || { en: 1.0 },
    };
  } catch {
    throw new Error('Failed to parse classification response');
  }
}

// Generate RAG answer
export interface RagSource {
  note_id: string;
  title: string | null;
  snippet: string;
  score: number;
  created_at: string;
}

export async function generateRagAnswer(query: string, sources: RagSource[]): Promise<string> {
  const client = getGemini();

  const systemPrompt = `You are a helpful assistant that answers questions based on the user's personal notes.

Rules:
- Answer based ONLY on the provided sources
- If the sources don't contain enough information, say so clearly
- Reference specific notes when relevant
- Be concise but thorough
- If the question is in Japanese, answer in Japanese
- If the question is in English, answer in English`;

  const sourcesText = sources
    .map(
      (s, i) =>
        `[Source ${i + 1}] (${s.created_at.split('T')[0]})
${s.title ? `Title: ${s.title}\n` : ''}Content: ${s.snippet}`
    )
    .join('\n\n');

  const userPrompt = `Question: ${query}

Based on these notes from my knowledge base:
${sourcesText}

Please answer my question.`;

  const result = await client.models.generateContent({
    model: getModelConfig().rag,
    contents: `${systemPrompt}\n\n${userPrompt}`,
    config: {
      temperature: 0.7,
      maxOutputTokens: 1000,
    },
  });

  return result.text || 'I could not generate an answer.';
}

// Generate Weekly Knowledge Pack
export async function generateKnowledgePack(
  notes: Array<{ title: string | null; content_text: string | null; ink_caption: string | null; created_at: string }>,
  rangeStart: string,
  rangeEnd: string
): Promise<string> {
  const client = getGemini();

  const systemPrompt = `You are a knowledge synthesis assistant. Create a weekly knowledge pack summary from the user's notes.

Output a well-structured Markdown document with these sections:
1. **Top Themes** (3-7 main themes from the week)
2. **Highlights** (key insights and important notes)
3. **Decisions & Learnings** (any decisions made or lessons learned)
4. **Open Loops** (incomplete thoughts or topics to explore)
5. **Glossary** (any new terms or vocabulary, especially for multilingual content)
6. **Next Week Suggestions** (based on patterns and open loops)

Rules:
- Be concise but comprehensive
- Preserve the original language when quoting
- Group related notes together
- Identify patterns across notes
- Don't invent information not in the notes`;

  const notesText = notes
    .map(
      (n, i) =>
        `[Note ${i + 1}] (${n.created_at.split('T')[0]})
${n.title ? `Title: ${n.title}\n` : ''}${n.content_text || ''}${n.ink_caption ? `\n[Handwritten: ${n.ink_caption}]` : ''}`
    )
    .join('\n\n---\n\n');

  const userPrompt = `Create a Weekly Knowledge Pack for ${rangeStart} to ${rangeEnd}.

Notes from this period:
${notesText || 'No notes recorded this week.'}`;

  const result = await client.models.generateContent({
    model: getModelConfig().pack,
    contents: `${systemPrompt}\n\n${userPrompt}`,
    config: {
      temperature: 0.7,
      maxOutputTokens: 2000,
    },
  });

  return result.text || '# Weekly Knowledge Pack\n\nNo content generated.';
}

// Generate ink caption from base64 image
export async function generateInkCaption(imageBase64: string): Promise<string> {
  const client = getGemini();

  const prompt = 'You are a handwriting description assistant. Describe the content of handwritten notes in one concise sentence. Output in the same language as the handwriting when possible.\n\nPlease describe this handwritten content in one sentence:';

  const result = await client.models.generateContent({
    model: getModelConfig().inkCaption,
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'image/png',
              data: imageBase64,
            },
          },
        ],
      },
    ],
    config: {
      maxOutputTokens: 200,
    },
  });

  return result.text || 'Handwritten note';
}
