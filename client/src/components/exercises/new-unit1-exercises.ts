import { FillInBlankQuestion } from './FillInBlank';
import { TranslationQuestion } from './TranslationExercise';
import { GenderRecognitionQuestion } from './GenderRecognition';

/**
 * Exercises for Unit 1: First Words
 * Design and formatting based on Unit 7 (old Unit 1)
 */
export const NEW_UNIT1_EXERCISES = {
  'unit1_first_words_greetings': {
    type: 'translation',
    title: 'Exercise 1: Translate Greetings',
    instructions: 'Translate these greetings from English to Serbian:',
    questions: [
      {
        id: '1',
        prompt: 'Hello! (informal)',
        answer: 'Zdravo!',
        acceptableAlternatives: ['Zdravo', 'zdravo']
      },
      {
        id: '2',
        prompt: 'Good day! (formal)',
        answer: 'Dobar dan!',
        acceptableAlternatives: ['Dobar dan', 'dobar dan']
      },
      {
        id: '3',
        prompt: 'Good morning!',
        answer: 'Dobro jutro!',
        acceptableAlternatives: ['Dobro jutro', 'dobro jutro']
      },
      {
        id: '4',
        prompt: 'Good evening!',
        answer: 'Dobro veče!',
        acceptableAlternatives: ['Dobro veče', 'dobro veče']
      },
      {
        id: '5',
        prompt: 'Goodbye! (formal)',
        answer: 'Doviđenja!',
        acceptableAlternatives: ['Doviđenja', 'doviđenja']
      },
    ] as TranslationQuestion[]
  },
  'unit1_basic_phrases': {
    type: 'translation',
    title: 'Exercise 2: Translate Essential Phrases',
    instructions: 'Translate these essential phrases from English to Serbian:',
    questions: [
      {
        id: '1',
        prompt: 'Thank you.',
        answer: 'Hvala.',
        acceptableAlternatives: ['Hvala', 'hvala']
      },
      {
        id: '2',
        prompt: 'Please. / You\'re welcome.',
        answer: 'Molim.',
        acceptableAlternatives: ['Molim', 'molim']
      },
      {
        id: '3',
        prompt: 'Excuse me. / Sorry.',
        answer: 'Izvinite.',
        acceptableAlternatives: ['Izvinite', 'izvinite']
      },
      {
        id: '4',
        prompt: 'I don\'t speak Serbian.',
        answer: 'Ne govorim srpski.',
        acceptableAlternatives: ['Ne govorim srpski', 'ne govorim srpski']
      },
      {
        id: '5',
        prompt: 'Do you speak English?',
        answer: 'Govorite li engleski?',
        acceptableAlternatives: ['Govorite li engleski', 'govorite li engleski']
      },
      {
        id: '6',
        prompt: 'Yes.',
        answer: 'Da.',
        acceptableAlternatives: ['Da', 'da']
      },
      {
        id: '7',
        prompt: 'No.',
        answer: 'Ne.',
        acceptableAlternatives: ['Ne', 'ne']
      },
    ] as TranslationQuestion[]
  },
  'unit1_biti_partial': {
    type: 'fillInBlank',
    title: 'Exercise 3: Fill in the Blanks (Verb "biti" - Partial)',
    instructions: 'Complete the sentences with the correct form of "biti" (sam, si, or je):',
    questions: [
      {
        id: '1',
        text: 'Ja ____ turista. (I am a tourist)',
        answer: 'sam',
        hint: '"I" form of biti'
      },
      {
        id: '2',
        text: 'Ti ____ iz Engleske? (Are you from England?)',
        answer: 'si',
        hint: 'Informal "you" form'
      },
      {
        id: '3',
        text: 'On ____ konobar. (He is a waiter)',
        answer: 'je',
        hint: '"He/she/it" form'
      },
      {
        id: '4',
        text: 'Ona ____ turistkinja. (She is a tourist)',
        answer: 'je',
        hint: '"He/she/it" form'
      },
      {
        id: '5',
        text: 'Ja ____ Alex. (I am Alex)',
        answer: 'sam',
        hint: '"I" form'
      },
    ] as FillInBlankQuestion[]
  },
};













