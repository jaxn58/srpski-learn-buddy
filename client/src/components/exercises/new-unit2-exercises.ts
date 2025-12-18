import { FillInBlankQuestion } from './FillInBlank';
import { TranslationQuestion } from './TranslationExercise';
import { GenderRecognitionQuestion } from './GenderRecognition';

/**
 * Exercises for Unit 2: Who Are You?
 * Design and formatting based on Unit 7 (old Unit 1)
 */
export const NEW_UNIT2_EXERCISES = {
  'unit2_who_are_you_introduction': {
    type: 'translation',
    title: 'Exercise 1: Translate Introduction Phrases',
    instructions: 'Translate these introduction phrases from English to Serbian:',
    questions: [
      {
        id: '1',
        prompt: 'What is your name? (formal)',
        answer: 'Kako se zovete?',
        acceptableAlternatives: ['Kako se zovete', 'kako se zovete']
      },
      {
        id: '2',
        prompt: 'What is your name? (informal)',
        answer: 'Kako se zoveš?',
        acceptableAlternatives: ['Kako se zoveš', 'kako se zoveš']
      },
      {
        id: '3',
        prompt: 'My name is Alex.',
        answer: 'Zovem se Alex.',
        acceptableAlternatives: ['Zovem se Alex', 'zovem se Alex', 'Ja se zovem Alex.', 'Ja se zovem Alex']
      },
      {
        id: '4',
        prompt: 'Where are you from? (formal)',
        answer: 'Odakle ste?',
        acceptableAlternatives: ['Odakle ste', 'odakle ste']
      },
      {
        id: '5',
        prompt: 'I am from Germany.',
        answer: 'Ja sam iz Nemačke.',
        acceptableAlternatives: ['Ja sam iz Nemačke', 'ja sam iz Nemačke', 'Ja sam iz Nemacke', 'ja sam iz Nemacke']
      },
      {
        id: '6',
        prompt: 'Nice to meet you.',
        answer: 'Drago mi je.',
        acceptableAlternatives: ['Drago mi je', 'drago mi je']
      },
    ] as TranslationQuestion[]
  },
  'unit2_biti_conjugation': {
    type: 'fillInBlank',
    title: 'Exercise 2: Fill in the Blanks (Verb "biti" - Full Conjugation)',
    instructions: 'Complete the sentences with the correct form of "biti":',
    questions: [
      {
        id: '1',
        text: 'Ja ____ iz Nemačke. (I am from Germany)',
        answer: 'sam',
        hint: '"I" form of biti'
      },
      {
        id: '2',
        text: 'Ti ____ turista. (You are a tourist)',
        answer: 'si',
        hint: 'Informal "you" form'
      },
      {
        id: '3',
        text: 'On ____ iz Srbije. (He is from Serbia)',
        answer: 'je',
        hint: '"He/she/it" form'
      },
      {
        id: '4',
        text: 'Mi ____ studenti. (We are students)',
        answer: 'smo',
        hint: '"We" form'
      },
      {
        id: '5',
        text: 'Vi ____ iz Engleske? (Are you from England?)',
        answer: 'ste',
        hint: 'Formal "you" form'
      },
      {
        id: '6',
        text: 'Oni ____ iz Amerike. (They are from America)',
        answer: 'su',
        hint: '"They" form'
      },
    ] as FillInBlankQuestion[]
  },
  'unit2_zvati_se_conjugation': {
    type: 'fillInBlank',
    title: 'Exercise 3: Fill in the Blanks (Verb "zvati se")',
    instructions: 'Complete the sentences with the correct form of "zvati se":',
    questions: [
      {
        id: '1',
        text: 'Ja ____ Alex. (My name is Alex)',
        answer: 'se zovem',
        hint: '"I" form of zvati se'
      },
      {
        id: '2',
        text: 'Kako ____? (What is your name? - informal)',
        answer: 'se zoveš',
        hint: 'Informal "you" form'
      },
      {
        id: '3',
        text: 'Kako ____? (What is your name? - formal)',
        answer: 'se zovete',
        hint: 'Formal "you" form'
      },
      {
        id: '4',
        text: 'On ____ Marko. (His name is Marko)',
        answer: 'se zove',
        hint: '"He/she/it" form'
      },
      {
        id: '5',
        text: 'Mi ____ studenti. (We are called students)',
        answer: 'se zovemo',
        hint: '"We" form'
      },
      {
        id: '6',
        text: 'Oni ____ turisti. (They are called tourists)',
        answer: 'se zovu',
        hint: '"They" form'
      },
    ] as FillInBlankQuestion[]
  },
  'unit2_noun_gender': {
    type: 'genderRecognition',
    title: 'Exercise 4: Gender Recognition',
    instructions: 'Identify the gender of these nouns:',
    questions: [
      {
        id: '1',
        text: 'ime (name)',
        answer: 'neuter',
      },
      {
        id: '2',
        text: 'prezime (last name)',
        answer: 'neuter',
      },
      {
        id: '3',
        text: 'Nemačka (Germany)',
        answer: 'feminine',
      },
      {
        id: '4',
        text: 'Engleska (England)',
        answer: 'feminine',
      },
      {
        id: '5',
        text: 'Srbija (Serbia)',
        answer: 'feminine',
      },
      {
        id: '6',
        text: 'Crna Gora (Montenegro)',
        answer: 'feminine',
      },
      {
        id: '7',
        text: 'turista (tourist - masculine)',
        answer: 'masculine',
      },
      {
        id: '8',
        text: 'student (student - masculine)',
        answer: 'masculine',
      },
    ] as GenderRecognitionQuestion[]
  },
};








