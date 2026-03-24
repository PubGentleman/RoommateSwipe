export interface RefinementQuestion {
  id: string;
  aiMessage: string;
  followUpMessage: string;
  options: { value: string; label: string; emoji: string }[];
  profileField: string;
}

export const REFINEMENT_QUESTIONS: RefinementQuestion[] = [
  {
    id: 'commuteTime',
    aiMessage: "Quick question that could improve your matches \u2014 how long of a commute can you handle from home each day?",
    followUpMessage: "Got it. I'll factor commute distance into your matches going forward.",
    options: [
      { value: 'under_20', label: 'Under 20 min', emoji: '🚶' },
      { value: 'under_40', label: 'Up to 40 min', emoji: '🚇' },
      { value: 'under_60', label: 'Up to 1 hour', emoji: '\u23F1\uFE0F' },
      { value: 'remote', label: 'I work remotely', emoji: '💻' },
    ],
    profileField: 'commuteTime',
  },
  {
    id: 'roommateRelationship',
    aiMessage: "What kind of relationship are you hoping for with your roommate? This makes a big difference in who I show you.",
    followUpMessage: "Noted. I'll match you with people who want the same kind of living dynamic.",
    options: [
      { value: 'friends', label: 'Actual friends', emoji: '🤝' },
      { value: 'friendly', label: 'Friendly but independent', emoji: '👋' },
      { value: 'respectful', label: 'Respectful, minimal interaction', emoji: '🏠' },
      { value: 'parallel', label: 'Ships passing', emoji: '🚶' },
    ],
    profileField: 'roommateRelationship',
  },
  {
    id: 'kitchenHabits',
    aiMessage: "One small thing that causes more roommate conflict than almost anything \u2014 dishes and the kitchen. What's your style?",
    followUpMessage: "Totally makes sense. I'll match you with people who have similar kitchen habits.",
    options: [
      { value: 'immediate', label: 'Clean up immediately', emoji: '🧼' },
      { value: 'sameday', label: 'Same day is fine', emoji: '🕐' },
      { value: 'nextday', label: 'Next morning is OK', emoji: '😴' },
      { value: 'flexible', label: "Doesn't bother me", emoji: '🤷' },
    ],
    profileField: 'kitchenHabits',
  },
  {
    id: 'culturalOpenness',
    aiMessage: "Would you be comfortable living with someone from a very different cultural or religious background?",
    followUpMessage: "Thanks for being honest \u2014 that helps me find you the right match.",
    options: [
      { value: 'very_open', label: 'Totally open to it', emoji: '🌍' },
      { value: 'open', label: 'Generally fine', emoji: '👍' },
      { value: 'somewhat', label: 'Depends on specifics', emoji: '🤔' },
      { value: 'prefer_similar', label: 'Prefer similar background', emoji: '🏠' },
    ],
    profileField: 'culturalOpenness',
  },
  {
    id: 'priorityFactor',
    aiMessage: "Last one \u2014 what's the single most important thing to you in a roommate? This helps me weigh your matches.",
    followUpMessage: "Got it. I'll prioritize this above everything else in your matches.",
    options: [
      { value: 'cleanliness', label: 'Cleanliness above all', emoji: '✨' },
      { value: 'quiet', label: 'A quiet, peaceful home', emoji: '🤫' },
      { value: 'compatible_schedule', label: 'Compatible schedule', emoji: '🕐' },
      { value: 'good_vibe', label: 'Good vibes and energy', emoji: '✨' },
    ],
    profileField: 'priorityFactor',
  },
];

export const getNextRefinementQuestion = (
  alreadyAsked: string[],
  personalityAnswers: Record<string, string>
): RefinementQuestion | null => {
  return REFINEMENT_QUESTIONS.find(q =>
    !alreadyAsked.includes(q.id) &&
    !personalityAnswers?.[q.profileField]
  ) ?? null;
};
