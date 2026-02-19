
import { GoogleGenAI, Type } from "@google/genai";
import { EbookStyle } from "../types";

const getSystemInstruction = (style: EbookStyle) => {
  let baseInstruction = "Anda adalah seorang penulis ahli dan mentor yang handal dalam memecahkan masalah. Tugas Anda adalah membuat konten ebook yang sangat praktis, actionable, dan mudah dipahami. Fokus pada langkah-langkah konkret, contoh nyata, dan tips yang bisa langsung diterapkan. Gunakan bahasa Indonesia yang jelas dan memotivasi. JANGAN gunakan format Markdown Heading (#) atau garis pemisah. Gunakan paragraf pendek.";
  
  switch(style) {
    case EbookStyle.SANTAI: baseInstruction += " Gunakan gaya santai, akrab, menyapa pembaca dengan 'kamu'."; break;
    case EbookStyle.PROFESIONAL: baseInstruction += " Gunakan gaya profesional, terstruktur, menyapa pembaca dengan 'Anda'."; break;
    case EbookStyle.SERIUS: baseInstruction += " Gunakan gaya serius, mendalam, dan formal."; break;
    case EbookStyle.INSPIRATIF: baseInstruction += " Gunakan gaya inspiratif, penuh semangat, dan menggugah."; break;
    case EbookStyle.AKADEMIS: baseInstruction += " Gunakan gaya akademis, formal, and analitis."; break;
  }
  return baseInstruction;
};

export class GeminiService {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Helper function to implement exponential backoff retry logic.
   */
  private async callWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      const isTransientError = 
        error?.message?.includes('503') || 
        error?.message?.includes('429') || 
        error?.message?.includes('high demand') ||
        error?.message?.includes('UNAVAILABLE');

      if (retries > 0 && isTransientError) {
        console.warn(`Gemini API busy or high demand. Retrying in ${delay}ms... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.callWithRetry(fn, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  async generateTitle(problem: string, style: EbookStyle): Promise<string> {
    return this.callWithRetry(async () => {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Buatkan satu judul menarik untuk ebook tentang masalah: "${problem}". Jawab HANYA dengan teks judulnya saja tanpa tanda kutip.`,
        config: { systemInstruction: getSystemInstruction(style) }
      });
      return response.text?.replace(/\*|"/g, '').trim() || "Ebook Tanpa Judul";
    });
  }

  async generateIntroduction(problem: string, style: EbookStyle): Promise<string> {
    return this.callWithRetry(async () => {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Buatkan sebuah teks Pendahuluan (minimal 3 paragraf) untuk ebook yang membahas: "${problem}".`,
        config: { systemInstruction: getSystemInstruction(style) }
      });
      return response.text || "";
    });
  }

  async generateChapterTitles(problem: string, count: number, style: EbookStyle): Promise<string[]> {
    return this.callWithRetry(async () => {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Buatkan daftar ${count} judul bab untuk ebook masalah: "${problem}".`,
        config: {
          systemInstruction: getSystemInstruction(style),
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });
      try {
        return JSON.parse(response.text || "[]");
      } catch {
        return [];
      }
    });
  }

  async generateNextChapterTitle(problem: string, existingTitles: string[], style: EbookStyle): Promise<string> {
    return this.callWithRetry(async () => {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Topik Ebook: "${problem}".
        Daftar Bab yang sudah ada: ${JSON.stringify(existingTitles)}.
        
        Tugas: Buatkan SATU judul bab selanjutnya yang logis untuk melanjutkan pembahasan, relevan dengan topik, dan PASTI BERBEDA dari judul yang sudah ada.
        Jawab HANYA teks judulnya saja tanpa penomoran atau tanda kutip.`,
        config: { systemInstruction: getSystemInstruction(style) }
      });
      return response.text?.replace(/\*|"/g, '').replace(/^Bab \d+[:.]\s*/i, '').trim() || "Bab Tambahan";
    });
  }

  async generateChapterContent(problem: string, chapterTitle: string, style: EbookStyle): Promise<string> {
    return this.callWithRetry(async () => {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Tuliskan isi lengkap bab "${chapterTitle}" untuk ebook masalah "${problem}". Berikan konten yang edukatif dan praktis.`,
        config: { systemInstruction: getSystemInstruction(style) }
      });
      return response.text || "";
    });
  }

  async extendContent(problem: string, existingContent: string, title: string, style: EbookStyle): Promise<string> {
    return this.callWithRetry(async () => {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Lanjutkan dan perpanjang konten bab "${title}" berikut ini agar lebih detail: "${existingContent}". Fokus pada konteks masalah: "${problem}".`,
        config: { systemInstruction: getSystemInstruction(style) }
      });
      return response.text || "";
    });
  }

  async generateSummary(problem: string, style: EbookStyle): Promise<string> {
    return this.callWithRetry(async () => {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Buatkan ringkasan poin-poin kunci yang bisa diambil dari ebook tentang: "${problem}".`,
        config: { systemInstruction: getSystemInstruction(style) }
      });
      return response.text || "";
    });
  }

  async generateConclusion(problem: string, style: EbookStyle): Promise<string> {
    return this.callWithRetry(async () => {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Buatkan sebuah kata penutup yang kuat dan memotivasi untuk ebook tentang: "${problem}".`,
        config: { systemInstruction: getSystemInstruction(style) }
      });
      return response.text || "";
    });
  }
}
