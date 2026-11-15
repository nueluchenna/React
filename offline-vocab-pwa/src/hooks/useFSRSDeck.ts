import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  saveNewFlashcard,
  gradeFlashcard,
  categorizeCards
} from '../db/database';
import { VocabFlashcard, ReviewGrade } from '../types/flashcard';
import { ClozePayload } from '../types/worker';

export function useFSRSDeck() {
  const allCards = useLiveQuery(() => db.flashcards.orderBy('due').toArray(), []) || [];

  const stats = categorizeCards(allCards);

  const addCard = async (payload: ClozePayload) => {
    await saveNewFlashcard(payload);
  };

  const submitGrade = async (card: VocabFlashcard, grade: ReviewGrade) => {
    return await gradeFlashcard(card, grade);
  };

  const deleteCard = async (id?: number) => {
    if (!id) return;
    await db.flashcards.delete(id);
  };

  return {
    allCards,
    dueCards: stats.dueCards,
    newCount: stats.newCount,
    learningCount: stats.learningCount,
    reviewCount: stats.reviewCount,
    totalSaved: stats.totalSaved,
    addCard,
    submitGrade,
    deleteCard
  };
}