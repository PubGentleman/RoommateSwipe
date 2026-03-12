export interface RefinementQuestion {
  id: string;
  aiMessage: string;
  followUpMessage: string;
  options: { value: string; label: string; emoji: string }[];
  profileField: string;
}

export const REFINEMENT_QUESTIONS: RefinementQuestion[] = [
  {
    id: 'sleepSchedule',
    aiMessage: "I noticed you haven't found a great match yet — let me ask you something that might help. What's your sleep schedule like? 🌙",
    followUpMessage: "Got it. I'll start filtering for people with compatible schedules.",
    options: [
      { value: 'early_bird', label: 'Early bird (before 10pm)', emoji: '🌅' },
      { value: 'night_owl', label: 'Night owl (after midnight)', emoji: '🦉' },
      { value: 'varies', label: 'Varies day to day', emoji: '🔄' },
      { value: 'flexible', label: 'Flexible — no set schedule', emoji: '🤷' },
    ],
    profileField: 'sleepSchedule',
  },
  {
    id: 'guestPreference',
    aiMessage: "Let me refine your matches a bit more. How do you feel about guests at home? This is one of the top causes of roommate friction. 🏠",
    followUpMessage: "Perfect. I'll weight this heavily in your upcoming matches.",
    options: [
      { value: 'advance', label: 'Always let me know in advance', emoji: '❌' },
      { value: 'headsup', label: 'Occasionally fine with a heads up', emoji: '👋' },
      { value: 'open', label: 'Come anytime', emoji: '✅' },
      { value: 'love', label: 'Love it, the more the merrier', emoji: '🎉' },
    ],
    profileField: 'guestPreference',
  },
  {
    id: 'communicationStyle',
    aiMessage: "One more thing that could improve your matches — how do you prefer to handle issues with a roommate? 💬",
    followUpMessage: "Noted. Compatible communication styles make a big difference.",
    options: [
      { value: 'text', label: 'Text everything', emoji: '💬' },
      { value: 'direct', label: 'Direct — face to face', emoji: '🗣️' },
      { value: 'meeting', label: 'Group house meeting', emoji: '📋' },
      { value: 'flow', label: 'Go with the flow', emoji: '😎' },
    ],
    profileField: 'communicationStyle',
  },
  {
    id: 'weekendStyle',
    aiMessage: "Your matches are getting better. Last refinement — what does a typical weekend at home look like for you? 🏠",
    followUpMessage: "Great. Your match quality should improve significantly now.",
    options: [
      { value: 'clean', label: 'Deep clean and organize', emoji: '🧹' },
      { value: 'chill', label: 'Games, movies, total chill', emoji: '🎮' },
      { value: 'social', label: 'Have people over', emoji: '🏠' },
      { value: 'out', label: 'Out most of the time', emoji: '🚶' },
    ],
    profileField: 'weekendStyle',
  },
  {
    id: 'noiseLevel',
    aiMessage: "Hey — how do you feel about noise levels at home? Music, TV, people talking? 🎵",
    followUpMessage: "Makes sense. I'll factor that into your matches going forward.",
    options: [
      { value: 'silent', label: 'Very quiet please', emoji: '🤫' },
      { value: 'moderate', label: 'Some noise is fine', emoji: '🎵' },
      { value: 'lively', label: 'Love a lively home', emoji: '🎉' },
    ],
    profileField: 'noiseLevel',
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
