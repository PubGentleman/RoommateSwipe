import { User } from '../types/models';
import { StorageService } from './storage';

export interface MicroQuestionOption {
  value: string;
  label: string;
  icon: string;
}

export interface MicroQuestion {
  id: string;
  question: string;
  category: keyof NonNullable<NonNullable<User['aiAssistantData']>['microQuestionPreferences']>;
  keywords: string[];
  options: MicroQuestionOption[];
}

export const MICRO_QUESTIONS: MicroQuestion[] = [
  {
    id: 'privacy',
    question: 'How important is personal privacy and alone time to you?',
    category: 'privacyImportance',
    keywords: ['privacy', 'private', 'alone', 'personal space'],
    options: [
      { value: 'very_important', label: 'Very important', icon: 'lock' },
      { value: 'somewhat_important', label: 'Somewhat important', icon: 'shield' },
      { value: 'not_important', label: 'Not a big deal', icon: 'thumbs-up' },
    ],
  },
  {
    id: 'cooking',
    question: 'How often do you cook at home?',
    category: 'cookingFrequency',
    keywords: ['cook', 'cooking', 'kitchen', 'meals', 'food'],
    options: [
      { value: 'daily', label: 'Almost every day', icon: 'coffee' },
      { value: 'occasionally', label: 'A few times a week', icon: 'clock' },
      { value: 'rarely', label: 'Rarely or never', icon: 'shopping-bag' },
    ],
  },
  {
    id: 'cleaning_schedule',
    question: 'Do you prefer a set cleaning schedule or a more flexible approach?',
    category: 'cleaningPreference',
    keywords: ['clean', 'cleaning', 'schedule', 'chores', 'tidy'],
    options: [
      { value: 'prefer_schedule', label: 'Set schedule', icon: 'clipboard' },
      { value: 'flexible', label: 'Flexible approach', icon: 'refresh-cw' },
      { value: 'no_preference', label: 'No preference', icon: 'minus-circle' },
    ],
  },
  {
    id: 'furnished',
    question: 'Would you prefer a furnished or unfurnished place?',
    category: 'furnishedPreference',
    keywords: ['furnished', 'furniture', 'unfurnished', 'room'],
    options: [
      { value: 'furnished', label: 'Furnished', icon: 'package' },
      { value: 'unfurnished', label: 'Unfurnished', icon: 'box' },
      { value: 'no_preference', label: 'Either works', icon: 'minus-circle' },
    ],
  },
  {
    id: 'stay_length',
    question: 'Are you looking for a short-term or long-term living situation?',
    category: 'stayLength',
    keywords: ['stay', 'length', 'duration', 'months', 'years', 'lease', 'short', 'long'],
    options: [
      { value: 'long_term', label: 'Long-term (1+ year)', icon: 'home' },
      { value: 'short_term', label: 'Short-term (few months)', icon: 'calendar' },
      { value: 'flexible', label: 'Flexible', icon: 'refresh-cw' },
    ],
  },
  {
    id: 'morning_routine',
    question: 'Do you have a morning bathroom routine that takes a while?',
    category: 'morningRoutine',
    keywords: ['morning', 'bathroom', 'routine', 'shower', 'ready'],
    options: [
      { value: 'takes_time', label: 'Yes, I need my time', icon: 'droplet' },
      { value: 'quick', label: 'Quick and efficient', icon: 'zap' },
      { value: 'moderate', label: 'Somewhere in between', icon: 'clock' },
    ],
  },
  {
    id: 'temperature',
    question: 'Do you prefer a warmer or cooler apartment temperature?',
    category: 'temperaturePreference',
    keywords: ['temperature', 'warm', 'cool', 'heat', 'ac', 'thermostat'],
    options: [
      { value: 'warmer', label: 'Keep it warm', icon: 'sun' },
      { value: 'cooler', label: 'Keep it cool', icon: 'wind' },
      { value: 'moderate', label: 'Moderate is fine', icon: 'thermometer' },
    ],
  },
  {
    id: 'kitchen_sharing',
    question: 'How do you feel about sharing kitchen space and appliances?',
    category: 'kitchenSharing',
    keywords: ['kitchen', 'cooking', 'share', 'appliances', 'fridge'],
    options: [
      { value: 'comfortable', label: 'Totally fine sharing', icon: 'thumbs-up' },
      { value: 'cautious', label: 'Prefer some boundaries', icon: 'shield' },
      { value: 'neutral', label: 'No strong feelings', icon: 'minus-circle' },
    ],
  },
  {
    id: 'parking',
    question: 'Do you need parking or own a vehicle?',
    category: 'parkingNeed',
    keywords: ['parking', 'car', 'vehicle', 'garage', 'street'],
    options: [
      { value: 'yes_need', label: 'Yes, I need parking', icon: 'truck' },
      { value: 'no_need', label: 'No, I don\'t drive', icon: 'navigation' },
    ],
  },
  {
    id: 'common_area',
    question: 'How much time do you spend in common areas versus your room?',
    category: 'commonAreaUsage',
    keywords: ['common', 'living room', 'shared space', 'hang out'],
    options: [
      { value: 'frequently', label: 'Mostly in common areas', icon: 'users' },
      { value: 'occasionally', label: 'A mix of both', icon: 'refresh-cw' },
      { value: 'rarely', label: 'Mostly in my room', icon: 'user' },
    ],
  },
  {
    id: 'communication',
    question: 'Do you prefer to communicate about house matters in person or via text?',
    category: 'communicationStyle',
    keywords: ['communication', 'text', 'talk', 'message', 'discuss'],
    options: [
      { value: 'in_person', label: 'In person', icon: 'mic' },
      { value: 'text', label: 'Text or message', icon: 'message-square' },
      { value: 'either', label: 'Either works', icon: 'minus-circle' },
    ],
  },
  {
    id: 'allergies',
    question: 'Do you have any allergies or dietary restrictions we should know about?',
    category: 'allergiesRestrictions',
    keywords: ['allergies', 'dietary', 'restrictions', 'food', 'sensitivities'],
    options: [
      { value: 'yes', label: 'Yes, I have some', icon: 'alert-triangle' },
      { value: 'none', label: 'No, none at all', icon: 'check-circle' },
    ],
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
      
    case 'stayLength':
      if (lowerAnswer.includes('year') || lowerAnswer.includes('long')) {
        updatedUser.aiAssistantData.microQuestionPreferences.stayLength = 'long_term';
      } else if (lowerAnswer.includes('month') || lowerAnswer.includes('short')) {
        updatedUser.aiAssistantData.microQuestionPreferences.stayLength = 'short_term';
      } else {
        updatedUser.aiAssistantData.microQuestionPreferences.stayLength = 'flexible';
      }
      break;
      
    case 'morningRoutine':
      if (lowerAnswer.includes('yes') || lowerAnswer.includes('long') || lowerAnswer.includes('while')) {
        updatedUser.aiAssistantData.microQuestionPreferences.morningRoutine = 'takes_time';
      } else if (lowerAnswer.includes('quick') || lowerAnswer.includes('short')) {
        updatedUser.aiAssistantData.microQuestionPreferences.morningRoutine = 'quick';
      } else {
        updatedUser.aiAssistantData.microQuestionPreferences.morningRoutine = 'moderate';
      }
      break;
      
    case 'temperaturePreference':
      if (lowerAnswer.includes('warm') || lowerAnswer.includes('hot') || lowerAnswer.includes('heat')) {
        updatedUser.aiAssistantData.microQuestionPreferences.temperaturePreference = 'warmer';
      } else if (lowerAnswer.includes('cool') || lowerAnswer.includes('cold') || lowerAnswer.includes('ac')) {
        updatedUser.aiAssistantData.microQuestionPreferences.temperaturePreference = 'cooler';
      } else {
        updatedUser.aiAssistantData.microQuestionPreferences.temperaturePreference = 'moderate';
      }
      break;
      
    case 'kitchenSharing':
      if (lowerAnswer.includes('great') || lowerAnswer.includes('fine') || lowerAnswer.includes('okay') || lowerAnswer.includes('yes')) {
        updatedUser.aiAssistantData.microQuestionPreferences.kitchenSharing = 'comfortable';
      } else if (lowerAnswer.includes('prefer') || lowerAnswer.includes('careful')) {
        updatedUser.aiAssistantData.microQuestionPreferences.kitchenSharing = 'cautious';
      } else {
        updatedUser.aiAssistantData.microQuestionPreferences.kitchenSharing = 'neutral';
      }
      break;
      
    case 'parkingNeed':
      if (lowerAnswer.includes('yes') || lowerAnswer.includes('need') || lowerAnswer.includes('car') || lowerAnswer.includes('vehicle')) {
        updatedUser.aiAssistantData.microQuestionPreferences.parkingNeed = 'yes_need';
      } else {
        updatedUser.aiAssistantData.microQuestionPreferences.parkingNeed = 'no_need';
      }
      break;
      
    case 'commonAreaUsage':
      if (lowerAnswer.includes('lot') || lowerAnswer.includes('often') || lowerAnswer.includes('much')) {
        updatedUser.aiAssistantData.microQuestionPreferences.commonAreaUsage = 'frequently';
      } else if (lowerAnswer.includes('sometimes') || lowerAnswer.includes('occasionally')) {
        updatedUser.aiAssistantData.microQuestionPreferences.commonAreaUsage = 'occasionally';
      } else {
        updatedUser.aiAssistantData.microQuestionPreferences.commonAreaUsage = 'rarely';
      }
      break;
      
    case 'communicationStyle':
      if (lowerAnswer.includes('person') || lowerAnswer.includes('face') || lowerAnswer.includes('talk')) {
        updatedUser.aiAssistantData.microQuestionPreferences.communicationStyle = 'in_person';
      } else if (lowerAnswer.includes('text') || lowerAnswer.includes('message') || lowerAnswer.includes('chat')) {
        updatedUser.aiAssistantData.microQuestionPreferences.communicationStyle = 'text';
      } else {
        updatedUser.aiAssistantData.microQuestionPreferences.communicationStyle = 'either';
      }
      break;
      
    case 'allergiesRestrictions':
      if (lowerAnswer.includes('yes') || lowerAnswer.includes('have') || (!lowerAnswer.includes('no') && !lowerAnswer.includes('none'))) {
        updatedUser.aiAssistantData.microQuestionPreferences.allergiesRestrictions = lowerAnswer;
      } else {
        updatedUser.aiAssistantData.microQuestionPreferences.allergiesRestrictions = 'none';
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
