/**
 * Exercises for Units 16-27
 * Advanced Serbian language exercises
 */

import { FillInBlankQuestion } from './FillInBlank';
import { TranslationQuestion } from './TranslationExercise';
import { GenderRecognitionQuestion } from './GenderRecognition';

export const UNITS_16_27_EXERCISES = {
  // ============= UNIT 16: Steve's New Apartment (Dative Case) =============
  'unit16-dative-pronouns': {
    type: 'fillInBlank',
    title: 'Exercise 1: Dative Personal Pronouns',
    instructions: 'Complete the sentences with the correct dative form of personal pronouns:',
    questions: [
      {
        id: '1',
        text: 'Stiv priča ____ o stanu. (to me - meni)',
        answer: 'mi',
        hint: 'Short dative form of "ja" (I)'
      },
      {
        id: '2',
        text: 'Ana pokazuje ____ kuhinju. (to you - tebi)',
        answer: 'ti',
        hint: 'Short dative form of "ti" (you singular)'
      },
      {
        id: '3',
        text: 'Vlasnik daje ____ ključeve. (to him - njemu)',
        answer: 'mu',
        hint: 'Short dative form of "on" (he)'
      },
      {
        id: '4',
        text: 'Komšija se predstavlja ____. (to us - nama)',
        answer: 'nam',
        hint: 'Short dative form of "mi" (we)'
      },
      {
        id: '5',
        text: 'Prijatelj šalje ____ poruku. (to her - njoj)',
        answer: 'joj',
        hint: 'Short dative form of "ona" (she)'
      },
      {
        id: '6',
        text: 'Mama šalje ____ novac za stan. (to them - njima)',
        answer: 'im',
        hint: 'Short dative form of "oni" (they)'
      },
    ] as FillInBlankQuestion[]
  },
  
  'unit16-dative-nouns': {
    type: 'fillInBlank',
    title: 'Exercise 2: Dative Case with Nouns',
    instructions: 'Complete the sentences with nouns in the dative case:',
    questions: [
      {
        id: '1',
        text: 'Stiv piše ____ (prijatelj - friend masc.)',
        answer: 'prijatelju',
        hint: 'Masculine noun ending -u in dative'
      },
      {
        id: '2',
        text: 'On telefonira ____ (Ana - Ana fem.)',
        answer: 'Ani',
        hint: 'Feminine noun ending -i in dative'
      },
      {
        id: '3',
        text: 'Dajem ključ ____ (komšija - neighbor masc.)',
        answer: 'komšiji',
        hint: 'Masculine noun ending -a → -i in dative'
      },
      {
        id: '4',
        text: 'Pokazujem stan ____ (majka - mother fem.)',
        answer: 'majci',
        hint: 'Feminine noun, k→c before -i'
      },
      {
        id: '5',
        text: 'Priča ____ (student - student masc.)',
        answer: 'studentu',
        hint: 'Masculine noun ending -u'
      },
      {
        id: '6',
        text: 'Šaljem sliku ____ (sestra - sister fem.)',
        answer: 'sestri',
        hint: 'Feminine noun ending -i in dative'
      },
    ] as FillInBlankQuestion[]
  },

  'unit16-apartment-vocab': {
    type: 'translation',
    title: 'Exercise 3: Apartment Vocabulary',
    instructions: 'Translate these apartment-related phrases from English to Serbian:',
    questions: [
      {
        id: '1',
        prompt: 'I have a new apartment.',
        answer: 'Imam novi stan.',
        acceptableAlternatives: ['imam novi stan', 'Ja imam novi stan', 'ja imam novi stan']
      },
      {
        id: '2',
        prompt: 'The kitchen is big.',
        answer: 'Kuhinja je velika.',
        acceptableAlternatives: ['kuhinja je velika', 'Kuhinja je velika']
      },
      {
        id: '3',
        prompt: 'Where is the bathroom?',
        answer: 'Gde je kupatilo?',
        acceptableAlternatives: ['gde je kupatilo', 'Gde je kupatilo']
      },
      {
        id: '4',
        prompt: 'The bedroom is small.',
        answer: 'Spavaća soba je mala.',
        acceptableAlternatives: ['spavaća soba je mala', 'Spavaca soba je mala', 'spavaca soba je mala']
      },
      {
        id: '5',
        prompt: 'This is the living room.',
        answer: 'Ovo je dnevna soba.',
        acceptableAlternatives: ['ovo je dnevna soba', 'To je dnevna soba', 'to je dnevna soba']
      },
      {
        id: '6',
        prompt: 'The apartment has a balcony.',
        answer: 'Stan ima balkon.',
        acceptableAlternatives: ['stan ima balkon', 'Stan ima terasu', 'stan ima terasu']
      },
    ] as TranslationQuestion[]
  },

  'unit16-furniture-gender': {
    type: 'genderRecognition',
    title: 'Exercise 4: Furniture Gender Recognition',
    instructions: 'Identify the gender of these furniture and room nouns:',
    questions: [
      {
        id: '1',
        text: 'sto (table)',
        answer: 'masculine',
      },
      {
        id: '2',
        text: 'stolica (chair)',
        answer: 'feminine',
      },
      {
        id: '3',
        text: 'krevet (bed)',
        answer: 'masculine',
      },
      {
        id: '4',
        text: 'lampa (lamp)',
        answer: 'feminine',
      },
      {
        id: '5',
        text: 'orman (wardrobe)',
        answer: 'masculine',
      },
      {
        id: '6',
        text: 'sofa (sofa)',
        answer: 'feminine',
      },
      {
        id: '7',
        text: 'tepih (carpet)',
        answer: 'masculine',
      },
      {
        id: '8',
        text: 'polica (shelf)',
        answer: 'feminine',
      },
    ] as GenderRecognitionQuestion[]
  },

  // TODO: Add exercises for units 17-27
};


