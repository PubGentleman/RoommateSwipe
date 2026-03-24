export interface RefinementQuestion {
  id: string;
  aiMessage: string;
  followUpMessage: string;
  options: { value: string; label: string; icon: string }[];
  profileField: string;
}

export const REFINEMENT_QUESTIONS: RefinementQuestion[] = [
  {
    id: 'commuteTime',
    aiMessage: "Quick question that could improve your matches \u2014 how long of a commute can you handle from home each day?",
    followUpMessage: "Got it. I'll factor commute distance into your matches going forward.",
    options: [
      { value: 'under_20', label: 'Under 20 min', icon: 'navigation' },
      { value: 'under_40', label: 'Up to 40 min', icon: 'map-pin' },
      { value: 'under_60', label: 'Up to 1 hour', icon: 'clock' },
      { value: 'remote', label: 'I work remotely', icon: 'monitor' },
    ],
    profileField: 'commuteTime',
  },
  {
    id: 'roommateRelationship',
    aiMessage: "What kind of relationship are you hoping for with your roommate? This makes a big difference in who I show you.",
    followUpMessage: "Noted. I'll match you with people who want the same kind of living dynamic.",
    options: [
      { value: 'friends', label: 'Actual friends', icon: 'users' },
      { value: 'friendly', label: 'Friendly but independent', icon: 'smile' },
      { value: 'respectful', label: 'Respectful, minimal interaction', icon: 'home' },
      { value: 'parallel', label: 'Ships passing', icon: 'user' },
    ],
    profileField: 'roommateRelationship',
  },
  {
    id: 'kitchenHabits',
    aiMessage: "One small thing that causes more roommate conflict than almost anything \u2014 dishes and the kitchen. What's your style?",
    followUpMessage: "Totally makes sense. I'll match you with people who have similar kitchen habits.",
    options: [
      { value: 'immediate', label: 'Clean up immediately', icon: 'zap' },
      { value: 'sameday', label: 'Same day is fine', icon: 'clock' },
      { value: 'nextday', label: 'Next morning is OK', icon: 'moon' },
      { value: 'flexible', label: "Doesn't bother me", icon: 'thumbs-up' },
    ],
    profileField: 'kitchenHabits',
  },
  {
    id: 'culturalOpenness',
    aiMessage: "Would you be comfortable living with someone from a very different cultural or religious background?",
    followUpMessage: "Thanks for being honest \u2014 that helps me find you the right match.",
    options: [
      { value: 'very_open', label: 'Totally open to it', icon: 'globe' },
      { value: 'open', label: 'Generally fine', icon: 'thumbs-up' },
      { value: 'somewhat', label: 'Depends on specifics', icon: 'help-circle' },
      { value: 'prefer_similar', label: 'Prefer similar background', icon: 'home' },
    ],
    profileField: 'culturalOpenness',
  },
  {
    id: 'priorityFactor',
    aiMessage: "Last one \u2014 what's the single most important thing to you in a roommate? This helps me weigh your matches.",
    followUpMessage: "Got it. I'll prioritize this above everything else in your matches.",
    options: [
      { value: 'cleanliness', label: 'Cleanliness above all', icon: 'star' },
      { value: 'quiet', label: 'A quiet, peaceful home', icon: 'volume-x' },
      { value: 'compatible_schedule', label: 'Compatible schedule', icon: 'clock' },
      { value: 'good_vibe', label: 'Good vibes and energy', icon: 'sun' },
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
