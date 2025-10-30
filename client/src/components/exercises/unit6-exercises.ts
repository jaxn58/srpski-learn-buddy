import { FillInBlankQuestion } from './FillInBlank';
import { TranslationQuestion } from './TranslationExercise';

export const UNIT6_EXERCISES = {
  'unit6_trebati': {
    type: 'fillInBlank',
    title: 'Exercise 1: Using "Trebati" (To Need)',
    instructions: 'Complete the sentences with "treba" or "trebaju":',
    questions: [
      {
        id: '1',
        text: 'Mi ____ hleb. (I need bread)',
        answer: 'treba',
        hint: 'Singular item - use "treba"'
      },
      {
        id: '2',
        text: 'Njima ____ jaja. (They need eggs)',
        answer: 'trebaju',
        hint: 'Plural item - use "trebaju"'
      },
      {
        id: '3',
        text: 'Ti ____ mleko. (You need milk)',
        answer: 'treba',
        hint: 'Singular item'
      },
      {
        id: '4',
        text: 'Nama ____ paradajzi. (We need tomatoes)',
        answer: 'trebaju',
        hint: 'Plural item'
      },
      {
        id: '5',
        text: 'Joj ____ sir. (She needs cheese)',
        answer: 'treba',
        hint: 'Singular item'
      },
      {
        id: '6',
        text: 'Mu ____ jabuke. (He needs apples)',
        answer: 'trebaju',
        hint: 'Plural item'
      },
    ] as FillInBlankQuestion[]
  },
  'unit6_shopping': {
    type: 'translation',
    title: 'Exercise 2: Shopping Phrases',
    instructions: 'Translate these shopping phrases from English to Serbian:',
    questions: [
      {
        id: '1',
        prompt: 'How much does it cost?',
        answer: 'Koliko košta?',
        acceptableAlternatives: ['koliko košta', 'Koliko kosta', 'koliko kosta']
      },
      {
        id: '2',
        prompt: 'Give me one kilo, please.',
        answer: 'Dajte mi jedan kilo, molim.',
        acceptableAlternatives: ['Dajte mi jedan kilo molim', 'dajte mi jedan kilo, molim']
      },
      {
        id: '3',
        prompt: 'Do you have cheese?',
        answer: 'Imate li sir?',
        acceptableAlternatives: ['imate li sir', 'Imate li sir', 'Da li imate sir?', 'da li imate sir']
      },
      {
        id: '4',
        prompt: 'That\'s all.',
        answer: 'To je sve.',
        acceptableAlternatives: ['to je sve', 'To je sve']
      },
      {
        id: '5',
        prompt: 'Half a kilo, please.',
        answer: 'Pola kila, molim.',
        acceptableAlternatives: ['pola kila molim', 'Pola kila molim']
      },
    ] as TranslationQuestion[]
  },
  'unit6_food_vocab': {
    type: 'fillInBlank',
    title: 'Exercise 3: Food Vocabulary',
    instructions: 'Translate these food items to Serbian:',
    questions: [
      {
        id: '1',
        text: 'apple = ____',
        answer: 'jabuka',
      },
      {
        id: '2',
        text: 'tomato = ____',
        answer: 'paradajz',
      },
      {
        id: '3',
        text: 'milk = ____',
        answer: 'mleko',
      },
      {
        id: '4',
        text: 'bread = ____',
        answer: 'hleb',
      },
      {
        id: '5',
        text: 'cheese = ____',
        answer: 'sir',
      },
      {
        id: '6',
        text: 'egg = ____',
        answer: 'jaje',
      },
      {
        id: '7',
        text: 'potato = ____',
        answer: 'krompir',
      },
      {
        id: '8',
        text: 'cucumber = ____',
        answer: 'krastavac',
      },
    ] as FillInBlankQuestion[]
  },
};

