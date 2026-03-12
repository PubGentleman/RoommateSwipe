import AsyncStorage from '@react-native-async-storage/async-storage';

const SWIPE_COUNT_KEY = 'refinementSwipeCount';
const SESSION_START_KEY = 'refinementSessionStart';
const LAST_QUESTION_KEY = 'lastRefinementQuestionTime';
const QUESTIONS_ASKED_KEY = 'refinementQuestionsAsked';

const MIN_SWIPES_BEFORE_FIRST_QUESTION = 20;
const MIN_SESSION_MINUTES = 15;
const SWIPES_BETWEEN_QUESTIONS = 30;
const HOURS_BETWEEN_QUESTIONS = 3;
const LOW_MATCH_RATE_THRESHOLD = 0.15;

export const trackSwipe = async (): Promise<void> => {
  const current = parseInt(await AsyncStorage.getItem(SWIPE_COUNT_KEY) ?? '0');
  await AsyncStorage.setItem(SWIPE_COUNT_KEY, (current + 1).toString());
};

export const startSession = async (): Promise<void> => {
  const existing = await AsyncStorage.getItem(SESSION_START_KEY);
  if (!existing) {
    await AsyncStorage.setItem(SESSION_START_KEY, Date.now().toString());
  }
};

export const getSessionMinutes = async (): Promise<number> => {
  const start = await AsyncStorage.getItem(SESSION_START_KEY);
  if (!start) return 0;
  return (Date.now() - parseInt(start)) / (1000 * 60);
};

export const getTotalSwipes = async (): Promise<number> => {
  return parseInt(await AsyncStorage.getItem(SWIPE_COUNT_KEY) ?? '0');
};

export const getQuestionsAsked = async (): Promise<string[]> => {
  const raw = await AsyncStorage.getItem(QUESTIONS_ASKED_KEY);
  return raw ? JSON.parse(raw) : [];
};

export const markQuestionAsked = async (questionId: string): Promise<void> => {
  const asked = await getQuestionsAsked();
  asked.push(questionId);
  await AsyncStorage.setItem(QUESTIONS_ASKED_KEY, JSON.stringify(asked));
  await AsyncStorage.setItem(LAST_QUESTION_KEY, Date.now().toString());
};

export const hoursSinceLastQuestion = async (): Promise<number> => {
  const last = await AsyncStorage.getItem(LAST_QUESTION_KEY);
  if (!last) return Infinity;
  return (Date.now() - parseInt(last)) / (1000 * 60 * 60);
};

export const resetRefinementCooldown = async (): Promise<void> => {
  await AsyncStorage.setItem(LAST_QUESTION_KEY, Date.now().toString());
};

export const shouldShowRefinementQuestion = async (
  rightSwipes: number,
  totalSwipes: number,
  personalityAnswers: Record<string, string>,
  allQuestionsAnswered: boolean
): Promise<boolean> => {
  if (allQuestionsAnswered) return false;

  const swipeCount = await getTotalSwipes();
  const sessionMins = await getSessionMinutes();
  const hoursSinceLast = await hoursSinceLastQuestion();
  const questionsAsked = await getQuestionsAsked();
  const matchRate = totalSwipes > 0 ? rightSwipes / totalSwipes : 1;

  if (questionsAsked.length === 0) {
    return (
      swipeCount >= MIN_SWIPES_BEFORE_FIRST_QUESTION &&
      sessionMins >= MIN_SESSION_MINUTES &&
      matchRate <= LOW_MATCH_RATE_THRESHOLD
    );
  }

  const swipesSinceLast = swipeCount % SWIPES_BETWEEN_QUESTIONS;
  return (
    swipesSinceLast === 0 &&
    hoursSinceLast >= HOURS_BETWEEN_QUESTIONS
  );
};
