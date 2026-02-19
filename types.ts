
export enum EbookStyle {
  PROFESIONAL = 'profesional',
  SANTAI = 'santai',
  SERIUS = 'serius',
  INSPIRATIF = 'inspiratif',
  AKADEMIS = 'akademis'
}

export interface FormattingConfig {
  align: 'left' | 'center' | 'right' | 'justify';
  font: 'sans' | 'serif' | 'mono';
  spacing: string;
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  loading: boolean;
  formatting?: FormattingConfig;
}

export interface EbookState {
  problem: string;
  style: EbookStyle;
  chapterCount: number;
  authorBio: string;
  title: string;
  introduction: string;
  introductionFormatting: FormattingConfig;
  chapters: Chapter[];
  summary: string;
  summaryFormatting: FormattingConfig;
  conclusion: string;
  conclusionFormatting: FormattingConfig;
  authorSectionFormatting: FormattingConfig;
}

export const DEFAULT_FORMATTING: FormattingConfig = {
  align: 'left',
  font: 'sans',
  spacing: '1.7'
};
