/**
 * Gemini AI Service
 * 
 * Provides LLM integration via Google's Gemini API.
 * The API key is read from the VITE_GEMINI_API_KEY environment variable.
 * 
 * Usage:
 *   1. Set VITE_GEMINI_API_KEY in .env (or .env.local)
 *   2. Import and use the helper functions below
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Read API key from environment variable (configurable — swap for university key later)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;

let genAI: GoogleGenerativeAI | null = null;

/**
 * Get the Gemini GenerativeAI instance (lazily initialized).
 */
export function getGeminiClient(): GoogleGenerativeAI {
    if (!genAI) {
        if (!API_KEY || API_KEY === 'your_api_key_here') {
            throw new Error(
                'Gemini API key is not configured. Set VITE_GEMINI_API_KEY in your .env file.'
            );
        }
        genAI = new GoogleGenerativeAI(API_KEY);
    }
    return genAI;
}

/**
 * Get the default Gemini model (Flash for speed + free tier).
 */
export function getGeminiModel() {
    const client = getGeminiClient();
    return client.getGenerativeModel({ model: 'gemini-2.0-flash' });
}

/**
 * Check if the Gemini API key is configured.
 */
export function isGeminiConfigured(): boolean {
    return !!API_KEY && API_KEY !== 'your_api_key_here';
}

/**
 * Parse a transcript text and extract passed course codes.
 * 
 * @param transcriptText - raw text extracted from a PDF transcript
 * @param knownCourseCodes - list of valid course codes to match against
 * @returns array of matched course codes
 */
export async function parseTranscriptWithAI(
    transcriptText: string,
    knownCourseCodes: string[]
): Promise<{ courseCode: string; grade: number }[]> {
    const model = getGeminiModel();

    const prompt = `You are an academic transcript parser for Damietta University, Faculty of Computers and Information.

Given the following transcript text, extract all courses the student has passed. Match each course to the known course codes provided.

Known course codes: ${knownCourseCodes.join(', ')}

For each matched course, return the course code and the numeric grade (0-100).

Return ONLY a valid JSON array in this exact format (no markdown, no explanation):
[{"courseCode": "CS101", "grade": 85}, {"courseCode": "BS101", "grade": 72}]

If no courses are found, return an empty array: []

Transcript text:
${transcriptText}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text().trim();

    // Extract JSON from response (handle cases where model wraps in markdown)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    try {
        return JSON.parse(jsonMatch[0]);
    } catch {
        return [];
    }
}
