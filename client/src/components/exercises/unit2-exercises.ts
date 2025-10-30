import { FillInBlankQuestion } from './FillInBlank';
import { TranslationQuestion } from './TranslationExercise';

export const UNIT2_EXERCISES = {
  'unit2-imati-conjugation': {
    type: 'fillInBlank',
    title: 'Exercise 1: Fill in the Blanks (Verb "imati")',
    instructions: 'Complete the sentences with the correct form of "imati" (to have):',
    questions: [
      {
        id: '1',
        text: 'Ja ____ kafu. (I have coffee)',
        answer: 'imam',
        hint: '"I" form of imati'
      },
      {
        id: '2',
        text: 'Ti ____ čaj. (You have tea)',
        answer: 'imaš',
        hint: 'Informal "you" form'
      },
      {
        id: '3',
        text: 'On ____ novac. (He has money)',
        answer: 'ima',
        hint: '"He/she/it" form'
      },
      {
        id: '4',
        text: 'Mi ____ vreme. (We have time)',
        answer: 'imamo',
        hint: '"We" form'
      },
      {
        id: '5',
        text: 'Vi ____ meniju. (You have a menu)',
        answer: 'imate',
        hint: 'Formal "you" form'
      },
      {
        id: '6',
        text: 'Oni ____ kafu. (They have coffee)',
        answer: 'imaju',
        hint: '"They" form'
      },
    ] as FillInBlankQuestion[]
  },
  'unit2-numbers': {
    type: 'fillInBlank',
    title: 'Exercise 2: Numbers in Serbian',
    instructions: 'Write these numbers in Serbian:',
    questions: [
      {
        id: '1',
        text: '5 = ____',
        answer: 'pet',
      },
      {
        id: '2',
        text: '10 = ____',
        answer: 'deset',
      },
      {
        id: '3',
        text: '15 = ____',
        answer: 'petnaest',
      },
      {
        id: '4',
        text: '20 = ____',
        answer: 'dvadeset',
      },
      {
        id: '5',
        text: '50 = ____',
        answer: 'pedeset',
      },
      {
        id: '6',
        text: '100 = ____',
        answer: 'sto',
      },
    ] as FillInBlankQuestion[]
  },
  'unit2-cafe-phrases': {
    type: 'translation',
    title: 'Exercise 3: Café Phrases',
    instructions: 'Translate these café phrases to Serbian:',
    questions: [
      {
        id: '1',
        prompt: 'One coffee, please.',
        answer: 'Molim jednu kafu.',
        acceptableAlternatives: ['Molim jednu kafu', 'molim jednu kafu']
      },
      {
        id: '2',
        prompt: 'How much does it cost?',
        answer: 'Koliko košta?',
        acceptableAlternatives: ['koliko košta', 'Koliko kosta?', 'koliko kosta']
      },
      {
        id: '3',
        prompt: 'Coffee with milk',
        answer: 'Kafa sa mlekom',
        acceptableAlternatives: ['kafa sa mlekom', 'Kafa sa mlekom.']
      },
      {
        id: '4',
        prompt: 'Tea without sugar',
        answer: 'Čaj bez šećera',
        acceptableAlternatives: ['čaj bez šećera', 'Caj bez secera', 'caj bez secera']
      },
      {
        id: '5',
        prompt: 'I have money.',
        answer: 'Ja imam novac.',
        acceptableAlternatives: ['Ja imam novac', 'ja imam novac', 'Imam novac']
      },
    ] as TranslationQuestion[]
  },
};

