import { User } from '../types/models';
import { StorageService } from './storage';

export interface MicroQuestion {
  id: string;
  question: string;
  category: keyof NonNullable<NonNullable<User['aiAssistantData']>['microQuestionPreferences']>;
  keywords: string[];
}

export const MICRO_QUESTIONS: MicroQuestion[] = [
  {
    id: 'privacy',
    question: 'How important is privacy to you?',
    category: 'privacyImportance',
    keywords: ['privacy', 'private', 'alone', 'personal space'],
  },
  {
    id: 'cooking',
    question: 'Do you cook at home often?',
    category: 'cookingFrequency',
    keywords: ['cook', 'cooking', 'kitchen', 'meals', 'food'],
  },
  {
    id: 'cleaning_schedule',
    question: 'How do you feel about shared cleaning schedules?',
    category: 'cleaningPreference',
    keywords: ['clean', 'cleaning', 'schedule', 'chores', 'tidy'],
  },
  {
    id: 'furnished',
    question: 'Do you prefer a furnished or unfurnished room?',
    category: 'furnishedPreference',
    keywords: ['furnished', 'furniture', 'unfurnished', 'room'],
  },
  {
    id: 'guests',
    question: 'Do you host guests often?',
    category: 'guestFrequency',
    keywords: ['guests', 'visitors', 'friends over', 'host'],
  },
  {
    id: 'work',
    question: 'Do you work from home or outside the home?',
    category: 'workSchedule',
    keywords: ['work', 'wfh', 'office', 'remote', 'home'],
  },
  {
    id: 'sleep',
    question: 'Are you an early bird or night owl?',
    category: 'sleepSchedule',
    keywords: ['sleep', 'early', 'late', 'night', 'morning'],
  },
  {
    id: 'noise',
    question: 'How quiet do you prefer your home environment to be?',
    category: 'noisePreference',
    keywords: ['quiet', 'noise', 'loud', 'sound', 'music'],
  },
  {
    id: 'cleanliness_importance',
    question: 'How important is apartment cleanliness to you?',
    category: 'cleanlinessImportance',
    keywords: ['cleanliness', 'clean', 'messy', 'tidy', 'organized'],
  },
  {
    id: 'smoking',
    question: 'Do you smoke or prefer non-smoking roommates?',
    category: 'smokingPreference',
    keywords: ['smoke', 'smoking', 'cigarette', 'vape'],
  },
  {
    id: 'stay_length',
    question: 'How long do you plan to stay in your next room?',
    category: 'stayLength',
    keywords: ['stay', 'length', 'duration', 'months', 'years', 'lease'],
  },
  {
    id: 'vibe',
    question: 'What is your ideal roommate\'s vibe — outgoing or more reserved?',
    category: 'roommateVibe',
    keywords: ['vibe', 'outgoing', 'reserved', 'social', 'introverted', 'extroverted'],
  },
];

export const shouldAskMicroQuestion = (user: User): boolean => {
  const aiData = user.aiAssistantData;
  
  if (!aiData?.lastMicroQuestionDate) {
    return true;
  }
  
  const lastQuestionDate = new Date(aiData.lastMicroQuestionDate);
  const hoursSinceLastQuestion = (Date.now() - lastQuestionDate.getTime()) / (1000 * 60 * 60);
  
  return hoursSinceLastQuestion >= 24;
};

export const getNextMicroQuestion = (user: User): MicroQuestion | null => {
  const questionsAsked = user.aiAssistantData?.questionsAsked || [];
  const availableQuestions = MICRO_QUESTIONS.filter(q => !questionsAsked.includes(q.id));
  
  if (availableQuestions.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * availableQuestions.length);
  return availableQuestions[randomIndex];
};

export const parseAnswerAndUpdatePreferences = async (
  user: User,
  answer: string,
  questionCategory: string
): Promise<User> => {
  const updatedUser = { ...user };
  
  if (!updatedUser.aiAssistantData) {
    updatedUser.aiAssistantData = {};
  }
  
  if (!updatedUser.aiAssistantData.microQuestionPreferences) {
    updatedUser.aiAssistantData.microQuestionPreferences = {};
  }
  
  const lowerAnswer = answer.toLowerCase();
  
  switch (questionCategory) {
    case 'privacyImportance':
      if (lowerAnswer.includes('very') || lowerAnswer.includes('extremely') || lowerAnswer.includes('important')) {
        updatedUser.aiAssistantData.microQuestionPreferences.privacyImportance = 'very_important';
      } else if (lowerAnswer.includes('somewhat') || lowerAnswer.includes('moderately')) {
        updatedUser.aiAssistantData.microQuestionPreferences.privacyImportance = 'somewhat_important';
      } else {
        updatedUser.aiAssistantData.microQuestionPreferences.privacyImportance = 'not_important';
      }
      break;
      
    case 'cookingFrequency':
      if (lowerAnswer.includes('daily') || lowerAnswer.includes('every day') || lowerAnswer.includes('often') || lowerAnswer.includes('yes')) {
        updatedUser.aiAssistantData.microQuestionPreferences.cookingFrequency = 'daily';
      } else if (lowerAnswer.includes('sometimes') || lowerAnswer.includes('occasionally') || lowerAnswer.includes('weekends')) {
        updatedUser.aiAssistantData.microQuestionPreferences.cookingFrequency = 'occasionally';
      } else {
        updatedUser.aiAssistantData.microQuestionPreferences.cookingFrequency = 'rarely';
      }
      break;
      
    case 'cleaningPreference':
      if (lowerAnswer.includes('yes') || lowerAnswer.includes('schedule') || lowerAnswer.includes('important')) {
        updatedUser.aiAssistantData.microQuestionPreferences.cleaningPreference = 'prefer_schedule';
      } else if (lowerAnswer.includes('flexible') || lowerAnswer.includes('casual')) {
        updatedUser.aiAssistantData.microQuestionPreferences.cleaningPreference = 'flexible';
      } else {
        updatedUser.aiAssistantData.microQuestionPreferences.cleaningPreference = 'no_preference';
      }
      break;
      
    case 'furnishedPreference':
      if (lowerAnswer.includes('furnished') && !lowerAnswer.includes('unfurnished')) {
        updatedUser.aiAssistantData.microQuestionPreferences.furnishedPreference = 'furnished';
      } else if (lowerAnswer.includes('unfurnished')) {
        updatedUser.aiAssistantData.microQuestionPreferences.furnishedPreference = 'unfurnished';
      } else {
        updatedUser.aiAssistantData.microQuestionPreferences.furnishedPreference = 'no_preference';
      }
      break;
      
    case 'guestFrequency':
      if (lowerAnswer.includes('often') || lowerAnswer.includes('frequently') || lowerAnswer.includes('yes')) {
        updatedUser.aiAssistantData.microQuestionPreferences.guestFrequency = 'frequently';
        if (updatedUser.profileData?.preferences) {
          updatedUser.profileData.preferences.guestPolicy = 'frequently';
        }
      } else if (lowerAnswer.includes('sometimes') || lowerAnswer.includes('occasionally')) {
        updatedUser.aiAssistantData.microQuestionPreferences.guestFrequency = 'occasionally';
        if (updatedUser.profileData?.preferences) {
          updatedUser.profileData.preferences.guestPolicy = 'occasionally';
        }
      } else {
        updatedUser.aiAssistantData.microQuestionPreferences.guestFrequency = 'rarely';
        if (updatedUser.profileData?.preferences) {
          updatedUser.profileData.preferences.guestPolicy = 'rarely';
        }
      }
      break;
      
    case 'workSchedule':
      if (lowerAnswer.includes('home') || lowerAnswer.includes('wfh') || lowerAnswer.includes('remote')) {
        updatedUser.aiAssistantData.microQuestionPreferences.workSchedule = 'work_from_home';
        if (updatedUser.profileData?.preferences) {
          updatedUser.profileData.preferences.workLocation = 'wfh_fulltime';
        }
      } else if (lowerAnswer.includes('hybrid') || lowerAnswer.includes('both')) {
        updatedUser.aiAssistantData.microQuestionPreferences.workSchedule = 'hybrid';
        if (updatedUser.profileData?.preferences) {
          updatedUser.profileData.preferences.workLocation = 'hybrid';
        }
      } else {
        updatedUser.aiAssistantData.microQuestionPreferences.workSchedule = 'office';
        if (updatedUser.profileData?.preferences) {
          updatedUser.profileData.preferences.workLocation = 'office_fulltime';
        }
      }
      break;
      
    case 'sleepSchedule':
      if (lowerAnswer.includes('early') || lowerAnswer.includes('morning')) {
        updatedUser.aiAssistantData.microQuestionPreferences.sleepSchedule = 'early_bird';
        if (updatedUser.profileData?.preferences) {
          updatedUser.profileData.preferences.sleepSchedule = 'early_sleeper';
        }
      } else if (lowerAnswer.includes('night') || lowerAnswer.includes('late')) {
        updatedUser.aiAssistantData.microQuestionPreferences.sleepSchedule = 'night_owl';
        if (updatedUser.profileData?.preferences) {
          updatedUser.profileData.preferences.sleepSchedule = 'late_sleeper';
        }
      } else {
        updatedUser.aiAssistantData.microQuestionPreferences.sleepSchedule = 'flexible';
        if (updatedUser.profileData?.preferences) {
          updatedUser.profileData.preferences.sleepSchedule = 'flexible';
        }
      }
      break;
      
    case 'noisePreference':
      if (lowerAnswer.includes('very quiet') || lowerAnswer.includes('quiet') || lowerAnswer.includes('silent')) {
        updatedUser.aiAssistantData.microQuestionPreferences.noisePreference = 'very_quiet';
        if (updatedUser.profileData?.preferences) {
          updatedUser.profileData.preferences.noiseTolerance = 'prefer_quiet';
        }
      } else if (lowerAnswer.includes('loud') || lowerAnswer.includes('noisy')) {
        updatedUser.aiAssistantData.microQuestionPreferences.noisePreference = 'okay_with_noise';
        if (updatedUser.profileData?.preferences) {
          updatedUser.profileData.preferences.noiseTolerance = 'loud_environments';
        }
      } else {
        updatedUser.aiAssistantData.microQuestionPreferences.noisePreference = 'moderate';
        if (updatedUser.profileData?.preferences) {
          updatedUser.profileData.preferences.noiseTolerance = 'normal_noise';
        }
      }
      break;
      
    case 'cleanlinessImportance':
      if (lowerAnswer.includes('very') || lowerAnswer.includes('extremely') || lowerAnswer.includes('important')) {
        updatedUser.aiAssistantData.microQuestionPreferences.cleanlinessImportance = 'very_important';
        if (updatedUser.profileData?.preferences) {
          updatedUser.profileData.preferences.cleanliness = 'very_tidy';
        }
      } else if (lowerAnswer.includes('somewhat') || lowerAnswer.includes('moderately')) {
        updatedUser.aiAssistantData.microQuestionPreferences.cleanlinessImportance = 'moderately_important';
        if (updatedUser.profileData?.preferences) {
          updatedUser.profileData.preferences.cleanliness = 'moderately_tidy';
        }
      } else {
        updatedUser.aiAssistantData.microQuestionPreferences.cleanlinessImportance = 'not_important';
        if (updatedUser.profileData?.preferences) {
          updatedUser.profileData.preferences.cleanliness = 'relaxed';
        }
      }
      break;
      
    case 'smokingPreference':
      if (lowerAnswer.includes('yes') || lowerAnswer.includes('smoke')) {
        updatedUser.aiAssistantData.microQuestionPreferences.smokingPreference = 'yes';
        if (updatedUser.profileData?.preferences) {
          updatedUser.profileData.preferences.smoking = 'yes';
        }
      } else if (lowerAnswer.includes('outside') || lowerAnswer.includes('outdoor')) {
        updatedUser.aiAssistantData.microQuestionPreferences.smokingPreference = 'outside_only';
        if (updatedUser.profileData?.preferences) {
          updatedUser.profileData.preferences.smoking = 'only_outside';
        }
      } else {
        updatedUser.aiAssistantData.microQuestionPreferences.smokingPreference = 'no';
        if (updatedUser.profileData?.preferences) {
          updatedUser.profileData.preferences.smoking = 'no';
        }
      }
      break;
      
    case 'stayLength':
      if (lowerAnswer.includes('year') || lowerAnswer.includes('long')) {
        updatedUser.aiAssistantData.microQuestionPreferences.stayLength = 'long_term';
      } else if (lowerAnswer.includes('month') || lowerAnswer.includes('short')) {
        updatedUser.aiAssistantData.microQuestionPreferences.stayLength = 'short_term';
      } else {
        updatedUser.aiAssistantData.microQuestionPreferences.stayLength = 'flexible';
      }
      break;
      
    case 'roommateVibe':
      if (lowerAnswer.includes('outgoing') || lowerAnswer.includes('social') || lowerAnswer.includes('extroverted')) {
        updatedUser.aiAssistantData.microQuestionPreferences.roommateVibe = 'outgoing';
        if (updatedUser.profileData?.preferences) {
          updatedUser.profileData.preferences.roommateRelationship = 'prefer_friends';
        }
      } else if (lowerAnswer.includes('reserved') || lowerAnswer.includes('quiet') || lowerAnswer.includes('introverted')) {
        updatedUser.aiAssistantData.microQuestionPreferences.roommateVibe = 'reserved';
        if (updatedUser.profileData?.preferences) {
          updatedUser.profileData.preferences.roommateRelationship = 'respectful_coliving';
        }
      } else {
        updatedUser.aiAssistantData.microQuestionPreferences.roommateVibe = 'balanced';
        if (updatedUser.profileData?.preferences) {
          updatedUser.profileData.preferences.roommateRelationship = 'occasional_hangouts';
        }
      }
      break;
  }
  
  await StorageService.setCurrentUser(updatedUser);
  return updatedUser;
};

export const markQuestionAsAsked = async (user: User, questionId: string): Promise<User> => {
  const updatedUser = { ...user };
  
  if (!updatedUser.aiAssistantData) {
    updatedUser.aiAssistantData = {};
  }
  
  if (!updatedUser.aiAssistantData.questionsAsked) {
    updatedUser.aiAssistantData.questionsAsked = [];
  }
  
  if (!updatedUser.aiAssistantData.questionsAsked.includes(questionId)) {
    updatedUser.aiAssistantData.questionsAsked.push(questionId);
  }
  
  updatedUser.aiAssistantData.lastMicroQuestionDate = new Date();
  
  await StorageService.setCurrentUser(updatedUser);
  return updatedUser;
};
