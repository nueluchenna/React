import Dexie, { type Table } from 'dexie';
import { createEmptyCard, fsrs, Rating, State } from 'ts-fsrs';
import { VocabFlashcard, ReviewGrade } from '../types/flashcard';
import { ClozePayload } from '../types/worker';

export class VocabDatabase extends Dexie {
  flashcards!: Table<VocabFlashcard, number>;

  constructor() {
    super('OfflineVocabDatabase');
    this.version(1).stores({
      // Index id, due date, FSRS state, and targetWord for fast local queries
      flashcards: '++id, due, state, targetWord, createdAt'
    });
  }
}

export const db = new VocabDatabase();
const scheduler = fsrs();

/**
 * Creates a brand-new FSRS flashcard from the AI worker's Cloze output
 * and stores it in IndexedDB.
 */
export async function saveNewFlashcard(payload: ClozePayload): Promise<number> {
  const now = new Date();
  const baseCard = createEmptyCard(now);

  const newCard: VocabFlashcard = {
    ...baseCard,
    targetWord: payload.targetWord,
    translatedWord: payload.translatedWord,
    originalSentence: payload.originalSentence,
    translatedSentence: payload.translatedSentence,
    frontCloze: payload.frontCloze,
    backAnswer: payload.backAnswer,
    createdAt: now
  };

  return await db.flashcards.add(newCard);
}

/**
 * Calculates the next FSRS review interval based on the user's rating
 * (Again, Hard, Good, Easy) and updates the card in IndexedDB.
 */
export async function gradeFlashcard(
  card: VocabFlashcard,
  grade: ReviewGrade
): Promise<VocabFlashcard> {
  if (!card.id) {
    throw new Error('Cannot grade a flashcard without a valid database ID.');
  }

  const now = new Date();
  const schedulingCards = scheduler.repeat(card, now);
  const updatedFSRSCard = schedulingCards[grade].card;

  const updatedRecord: VocabFlashcard = {
    ...card,
    ...updatedFSRSCard
  };

  await db.flashcards.put(updatedRecord);
  return updatedRecord;
}

/**
 * Returns preview intervals (e.g., "10m", "4d") for the 4 grading buttons
 * on the back of the currently active flashcard.
 */
export function getNextIntervalPreviews(card: VocabFlashcard): Record<ReviewGrade, string> {
  const now = new Date();
  const preview = scheduler.repeat(card, now);

  const formatDiff = (due: Date): string => {
    const diffMinutes = Math.max(1, Math.round((due.getTime() - now.getTime()) / 60000));
    if (diffMinutes < 60) return `${diffMinutes}m`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d`;
  };

  return {
    [Rating.Again]: formatDiff(preview[Rating.Again].card.due),
    [Rating.Hard]: formatDiff(preview[Rating.Hard].card.due),
    [Rating.Good]: formatDiff(preview[Rating.Good].card.due),
    [Rating.Easy]: formatDiff(preview[Rating.Easy].card.due)
  };
}

/**
 * Helper to categorize due counts for the Review Dashboard
 */
export function categorizeCards(cards: VocabFlashcard[]) {
  const now = new Date();
  const dueCards = cards.filter((c) => new Date(c.due) <= now);

  return {
    dueCards,
    newCount: dueCards.filter((c) => c.state === State.New).length,
    learningCount: dueCards.filter(
      (c) => c.state === State.Learning || c.state === State.Relearning
    ).length,
    reviewCount: dueCards.filter((c) => c.state === State.Review).length,
    totalSaved: cards.length
  };
}