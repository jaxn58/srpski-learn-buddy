import { FillInBlankQuestion } from './FillInBlank';
import { TranslationQuestion } from './TranslationExercise';

// UNIT 11 EXERCISES
export const UNIT11_EXERCISES = {
  'unit11_past_tense': {
    type: 'fillInBlank',
    title: 'Exercise 1: Past Tense Formation',
    instructions: 'Complete with the correct past tense form:',
    questions: [
      {
        id: '1',
        text: 'Ja sam ____ u Beogradu. (biti - masculine)',
        answer: 'bio',
        hint: 'Masculine past participle of biti'
      },
      {
        id: '2',
        text: 'Ona je ____ srpski. (učiti)',
        answer: 'učila',
        hint: 'Feminine past participle'
      },
      {
        id: '3',
        text: 'Mi smo ____ ćevape. (jesti)',
        answer: 'jeli',
        hint: 'Plural masculine'
      },
      {
        id: '4',
        text: 'Ti si ____ kasno. (doći - masculine)',
        answer: 'došao',
        hint: 'Past participle of doći'
      },
      {
        id: '5',
        text: 'Oni su ____ film. (gledati)',
        answer: 'gledali',
        hint: 'Plural masculine'
      },
    ] as FillInBlankQuestion[]
  },
  'unit11_past_sentences': {
    type: 'translation',
    title: 'Exercise 2: Past Tense Sentences',
    instructions: 'Translate these past tense sentences to Serbian:',
    questions: [
      {
        id: '1',
        prompt: 'I was in Belgrade. (masculine)',
        answer: 'Bio sam u Beogradu.',
        acceptableAlternatives: ['bio sam u beogradu', 'Ja sam bio u Beogradu']
      },
      {
        id: '2',
        prompt: 'She ate breakfast.',
        answer: 'Ona je doručkovala.',
        acceptableAlternatives: ['ona je doruckovala', 'Doruckovala je']
      },
      {
        id: '3',
        prompt: 'We went to the cinema.',
        answer: 'Išli smo u bioskop.',
        acceptableAlternatives: ['isli smo u bioskop', 'Mi smo išli u bioskop']
      },
      {
        id: '4',
        prompt: 'They came yesterday.',
        answer: 'Došli su juče.',
        acceptableAlternatives: ['dosli su juce', 'Oni su došli juče']
      },
    ] as TranslationQuestion[]
  },
  'unit11_time_expressions': {
    type: 'fillInBlank',
    title: 'Exercise 3: Time Expressions',
    instructions: 'Translate these time expressions:',
    questions: [
      {
        id: '1',
        text: 'yesterday = ____',
        answer: 'juče',
      },
      {
        id: '2',
        text: 'last week = prošle ____',
        answer: 'nedelje',
      },
      {
        id: '3',
        text: 'last year = prošle ____',
        answer: 'godine',
      },
      {
        id: '4',
        text: 'three days ago = pre tri ____',
        answer: 'dana',
      },
    ] as FillInBlankQuestion[]
  },
};

// UNIT 12 EXERCISES
export const UNIT12_EXERCISES = {
  'unit12_motion_verbs': {
    type: 'fillInBlank',
    title: 'Exercise 1: Motion Verbs',
    instructions: 'Complete with the correct motion verb:',
    questions: [
      {
        id: '1',
        text: '____ u školu. (I go - present)',
        answer: 'Idem',
        hint: 'Present tense of ići'
      },
      {
        id: '2',
        text: '____ sam iz Beograda. (I came)',
        answer: 'Došao',
        hint: 'Past tense of doći'
      },
      {
        id: '3',
        text: 'Ona je ____ kući. (she left)',
        answer: 'otišla',
        hint: 'Past tense of otići, feminine'
      },
      {
        id: '4',
        text: '____ smo u 8 sati. (we set off)',
        answer: 'Pošli',
        hint: 'Past tense of poći'
      },
    ] as FillInBlankQuestion[]
  },
  'unit12_directions': {
    type: 'translation',
    title: 'Exercise 2: Directions and Movement',
    instructions: 'Translate these sentences:',
    questions: [
      {
        id: '1',
        prompt: 'I am going to school.',
        answer: 'Idem u školu.',
        acceptableAlternatives: ['idem u skolu', 'Ja idem u školu']
      },
      {
        id: '2',
        prompt: 'She came from Belgrade.',
        answer: 'Došla je iz Beograda.',
        acceptableAlternatives: ['dosla je iz beograda', 'Ona je došla iz Beograda']
      },
      {
        id: '3',
        prompt: 'We are going by bus.',
        answer: 'Idemo autobusom.',
        acceptableAlternatives: ['idemo autobusom', 'Mi idemo autobusom']
      },
    ] as TranslationQuestion[]
  },
  'unit12_transportation': {
    type: 'fillInBlank',
    title: 'Exercise 3: Transportation Vocabulary',
    instructions: 'Translate these transportation words:',
    questions: [
      {
        id: '1',
        text: 'bus = ____',
        answer: 'autobus',
      },
      {
        id: '2',
        text: 'train = ____',
        answer: 'voz',
      },
      {
        id: '3',
        text: 'airplane = ____',
        answer: 'avion',
      },
      {
        id: '4',
        text: 'bicycle = ____',
        answer: 'bicikl',
      },
    ] as FillInBlankQuestion[]
  },
};

// UNIT 13 EXERCISES
export const UNIT13_EXERCISES = {
  'unit13_weather': {
    type: 'fillInBlank',
    title: 'Exercise 1: Weather Expressions',
    instructions: 'Complete the weather expressions:',
    questions: [
      {
        id: '1',
        text: 'It is sunny = ____ je',
        answer: 'Sunčano',
      },
      {
        id: '2',
        text: 'It is raining = ____ pada',
        answer: 'Kiša',
      },
      {
        id: '3',
        text: 'It is cold = ____ je',
        answer: 'Hladno',
      },
      {
        id: '4',
        text: 'It is hot = ____ je',
        answer: 'Vruće',
      },
    ] as FillInBlankQuestion[]
  },
  'unit13_seasons': {
    type: 'translation',
    title: 'Exercise 2: Seasons and Weather',
    instructions: 'Translate these sentences:',
    questions: [
      {
        id: '1',
        prompt: 'It is sunny today.',
        answer: 'Danas je sunčano.',
        acceptableAlternatives: ['danas je suncano', 'Suncano je danas']
      },
      {
        id: '2',
        prompt: 'It is snowing.',
        answer: 'Pada sneg.',
        acceptableAlternatives: ['pada sneg', 'Sneg pada']
      },
      {
        id: '3',
        prompt: 'It is warm in summer.',
        answer: 'Toplo je u leto.',
        acceptableAlternatives: ['toplo je u leto', 'U leto je toplo']
      },
    ] as TranslationQuestion[]
  },
  'unit13_temperature': {
    type: 'fillInBlank',
    title: 'Exercise 3: Seasons Vocabulary',
    instructions: 'Translate the seasons:',
    questions: [
      {
        id: '1',
        text: 'spring = ____',
        answer: 'proleće',
      },
      {
        id: '2',
        text: 'summer = ____',
        answer: 'leto',
      },
      {
        id: '3',
        text: 'autumn = ____',
        answer: 'jesen',
      },
      {
        id: '4',
        text: 'winter = ____',
        answer: 'zima',
      },
    ] as FillInBlankQuestion[]
  },
};

// UNIT 14 EXERCISES
export const UNIT14_EXERCISES = {
  'unit14_hobbies': {
    type: 'fillInBlank',
    title: 'Exercise 1: Hobby Vocabulary',
    instructions: 'Translate these hobbies:',
    questions: [
      {
        id: '1',
        text: 'reading = ____',
        answer: 'čitanje',
      },
      {
        id: '2',
        text: 'swimming = ____',
        answer: 'plivanje',
      },
      {
        id: '3',
        text: 'cooking = ____',
        answer: 'kuvanje',
      },
      {
        id: '4',
        text: 'music = ____',
        answer: 'muzika',
      },
    ] as FillInBlankQuestion[]
  },
  'unit14_activities': {
    type: 'translation',
    title: 'Exercise 2: Talking About Hobbies',
    instructions: 'Translate these sentences:',
    questions: [
      {
        id: '1',
        prompt: 'I like to read.',
        answer: 'Volim da čitam.',
        acceptableAlternatives: ['volim da citam', 'Ja volim da čitam']
      },
      {
        id: '2',
        prompt: 'I play football.',
        answer: 'Igram fudbal.',
        acceptableAlternatives: ['igram fudbal', 'Ja igram fudbal']
      },
      {
        id: '3',
        prompt: 'She does photography.',
        answer: 'Ona se bavi fotografisanjem.',
        acceptableAlternatives: ['ona se bavi fotografisanjem', 'Bavi se fotografisanjem']
      },
    ] as TranslationQuestion[]
  },
  'unit14_frequency': {
    type: 'fillInBlank',
    title: 'Exercise 3: Frequency Expressions',
    instructions: 'Translate these frequency words:',
    questions: [
      {
        id: '1',
        text: 'every day = svaki ____',
        answer: 'dan',
      },
      {
        id: '2',
        text: 'often = ____',
        answer: 'često',
      },
      {
        id: '3',
        text: 'sometimes = ____',
        answer: 'ponekad',
      },
      {
        id: '4',
        text: 'never = ____',
        answer: 'nikad',
      },
    ] as FillInBlankQuestion[]
  },
};

// UNIT 15 EXERCISES
export const UNIT15_EXERCISES = {
  'unit15_invitations': {
    type: 'fillInBlank',
    title: 'Exercise 1: Making Invitations',
    instructions: 'Complete the invitation phrases:',
    questions: [
      {
        id: '1',
        text: 'Do you want to...? = Hoćeš li da ____?',
        answer: 'idemo',
        hint: 'Verb for "go" in first person plural'
      },
      {
        id: '2',
        text: "Let's go = ____",
        answer: 'Idemo',
      },
      {
        id: '3',
        text: 'Would you like to...? = ____ li da...?',
        answer: 'Želite',
      },
    ] as FillInBlankQuestion[]
  },
  'unit15_plans': {
    type: 'translation',
    title: 'Exercise 2: Making Plans',
    instructions: 'Translate these invitation phrases:',
    questions: [
      {
        id: '1',
        prompt: 'Do you want to go to the cinema?',
        answer: 'Hoćeš li da idemo u bioskop?',
        acceptableAlternatives: ['hoces li da idemo u bioskop', 'Hoćeš li u bioskop']
      },
      {
        id: '2',
        prompt: 'Yes, gladly!',
        answer: 'Da, rado!',
        acceptableAlternatives: ['da rado', 'Rado']
      },
      {
        id: '3',
        prompt: 'I am sorry, I cannot.',
        answer: 'Žao mi je, ne mogu.',
        acceptableAlternatives: ['zao mi je ne mogu', 'Žao mi je ne mogu']
      },
    ] as TranslationQuestion[]
  },
  'unit15_responses': {
    type: 'fillInBlank',
    title: 'Exercise 3: Accepting and Declining',
    instructions: 'Translate these responses:',
    questions: [
      {
        id: '1',
        text: 'Of course! = ____!',
        answer: 'Naravno',
      },
      {
        id: '2',
        text: 'Great! = ____!',
        answer: 'Sjajno',
      },
      {
        id: '3',
        text: 'Maybe another time = Možda drugi ____',
        answer: 'put',
      },
      {
        id: '4',
        text: 'I am busy = ____ sam',
        answer: 'Zauzet',
        hint: 'Masculine form'
      },
    ] as FillInBlankQuestion[]
  },
};

// Export all exercises together
export const UNITS_11_15_EXERCISES = {
  ...UNIT11_EXERCISES,
  ...UNIT12_EXERCISES,
  ...UNIT13_EXERCISES,
  ...UNIT14_EXERCISES,
  ...UNIT15_EXERCISES,
};

