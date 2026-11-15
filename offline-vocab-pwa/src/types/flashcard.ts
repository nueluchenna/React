import { Card as FSRSCard, Rating } from 'ts-fsrs';

export type ReviewGrade =
  | Rating.Again
  | Rating.Hard
  | Rating.Good
  | Rating.Easy;

export interface VocabFlashcard extends FSRSCard {
  id?: number;
  targetWord: string;
  translatedWord: string;
  originalSentence: string;
  translatedSentence: string;
  frontCloze: string;
  backAnswer: string;
  createdAt: Date;
}

export interface SentenceBlock {
  sentenceId: string;
  rawText: string;
  words: string[];
}

export interface TranscriptSegment {
  chunkId: string;
  timestamp: number;
  sentences: SentenceBlock[];
}