import { FillInBlankQuestion } from './FillInBlank';
import { TranslationQuestion } from './TranslationExercise';

// UNIT 7 EXERCISES
export const UNIT7_EXERCISES = {
  'unit7_adjectives': {
    type: 'fillInBlank',
    title: 'Exercise 1: Adjective Gender Agreement',
    instructions: 'Complete with the correct adjective form (masculine/feminine/neuter):',
    questions: [
      {
        id: '1',
        text: 'visok____ čovek (tall man)',
        answer: 'visok',
        hint: 'Masculine form - no change needed'
      },
      {
        id: '2',
        text: 'visok____ žena (tall woman)',
        answer: 'visoka',
        hint: 'Feminine form - add -a'
      },
      {
        id: '3',
        text: 'lep____ dete (beautiful child)',
        answer: 'lepo',
        hint: 'Neuter form - add -o'
      },
      {
        id: '4',
        text: 'mlad____ student (young student - male)',
        answer: 'mlad',
        hint: 'Masculine form'
      },
      {
        id: '5',
        text: 'mlad____ studentkinja (young student - female)',
        answer: 'mlada',
        hint: 'Feminine form'
      },
      {
        id: '6',
        text: 'pametan____ devojka (smart girl)',
        answer: 'pametna',
        hint: 'Feminine form'
      },
    ] as FillInBlankQuestion[]
  },
  'unit7_descriptions': {
    type: 'translation',
    title: 'Exercise 2: Describing People',
    instructions: 'Translate these descriptions from English to Serbian:',
    questions: [
      {
        id: '1',
        prompt: 'He is tall.',
        answer: 'On je visok.',
        acceptableAlternatives: ['on je visok']
      },
      {
        id: '2',
        prompt: 'She is beautiful.',
        answer: 'Ona je lepa.',
        acceptableAlternatives: ['ona je lepa']
      },
      {
        id: '3',
        prompt: 'He has black hair.',
        answer: 'On ima crnu kosu.',
        acceptableAlternatives: ['on ima crnu kosu']
      },
      {
        id: '4',
        prompt: 'She has blue eyes.',
        answer: 'Ona ima plave oči.',
        acceptableAlternatives: ['ona ima plave oči', 'ona ima plave oci']
      },
      {
        id: '5',
        prompt: 'He is smart and kind.',
        answer: 'On je pametan i ljubazan.',
        acceptableAlternatives: ['on je pametan i ljubazan']
      },
    ] as TranslationQuestion[]
  },
  'unit7_agreement': {
    type: 'fillInBlank',
    title: 'Exercise 3: Physical Appearance Vocabulary',
    instructions: 'Translate these appearance terms to Serbian:',
    questions: [
      {
        id: '1',
        text: 'tall (masculine) = ____',
        answer: 'visok',
      },
      {
        id: '2',
        text: 'short (feminine) = ____',
        answer: 'niska',
      },
      {
        id: '3',
        text: 'blonde hair = ____ kosa',
        answer: 'plava',
      },
      {
        id: '4',
        text: 'brown eyes = ____ oči',
        answer: 'smeđe',
        hint: 'Plural form'
      },
      {
        id: '5',
        text: 'young (masculine) = ____',
        answer: 'mlad',
      },
      {
        id: '6',
        text: 'smart (feminine) = ____',
        answer: 'pametna',
      },
    ] as FillInBlankQuestion[]
  },
};

// UNIT 8 EXERCISES
export const UNIT8_EXERCISES = {
  'unit8_reflexive': {
    type: 'fillInBlank',
    title: 'Exercise 1: Reflexive Verbs',
    instructions: 'Complete with the correct form of the reflexive verb:',
    questions: [
      {
        id: '1',
        text: 'Ja ____ budim u 7 sati. (I wake up at 7)',
        answer: 'se',
        hint: 'Reflexive particle "se"'
      },
      {
        id: '2',
        text: 'On se ____ u 8 sati. (He wakes up at 8) - buditi',
        answer: 'budi',
        hint: 'Third person singular of buditi'
      },
      {
        id: '3',
        text: 'Mi se ____ ujutru. (We shower in the morning) - tuširati',
        answer: 'tušíramo',
        hint: 'First person plural'
      },
      {
        id: '4',
        text: 'Ona se ____ pre posla. (She gets dressed before work) - oblačiti',
        answer: 'oblači',
        hint: 'Third person singular'
      },
      {
        id: '5',
        text: 'Ti se ____ svaki dan. (You shave every day) - brijati',
        answer: 'briješ',
        hint: 'Second person singular'
      },
    ] as FillInBlankQuestion[]
  },
  'unit8_routine': {
    type: 'translation',
    title: 'Exercise 2: Daily Routine Phrases',
    instructions: 'Translate these daily routine phrases from English to Serbian:',
    questions: [
      {
        id: '1',
        prompt: 'I wake up at 7.',
        answer: 'Budim se u 7.',
        acceptableAlternatives: ['budim se u 7', 'Ja se budim u 7', 'ja se budim u 7']
      },
      {
        id: '2',
        prompt: 'I have breakfast.',
        answer: 'Doručkujem.',
        acceptableAlternatives: ['doručkujem', 'Ja doručkujem']
      },
      {
        id: '3',
        prompt: 'I go to work.',
        answer: 'Idem na posao.',
        acceptableAlternatives: ['idem na posao']
      },
      {
        id: '4',
        prompt: 'I watch TV in the evening.',
        answer: 'Uveče gledam TV.',
        acceptableAlternatives: ['uveče gledam TV', 'Gledam TV uveče', 'gledam TV uveče', 'Uvece gledam TV']
      },
      {
        id: '5',
        prompt: 'I go to bed at 11.',
        answer: 'Idem u krevet u 11.',
        acceptableAlternatives: ['idem u krevet u 11', 'Idem u krevet u 11 sati']
      },
    ] as TranslationQuestion[]
  },
  'unit8_time': {
    type: 'fillInBlank',
    title: 'Exercise 3: Time Expressions',
    instructions: 'Translate these time expressions to Serbian:',
    questions: [
      {
        id: '1',
        text: 'in the morning = ____',
        answer: 'ujutru',
      },
      {
        id: '2',
        text: 'in the evening = ____',
        answer: 'uveče',
      },
      {
        id: '3',
        text: 'at night = ____',
        answer: 'noću',
      },
      {
        id: '4',
        text: 'always = ____',
        answer: 'uvek',
      },
      {
        id: '5',
        text: 'sometimes = ____',
        answer: 'ponekad',
      },
      {
        id: '6',
        text: 'never = ____',
        answer: 'nikad',
      },
    ] as FillInBlankQuestion[]
  },
};

// UNIT 9 EXERCISES
export const UNIT9_EXERCISES = {
  'unit9_time': {
    type: 'fillInBlank',
    title: 'Exercise 1: Telling Time',
    instructions: 'Write these times in Serbian:',
    questions: [
      {
        id: '1',
        text: '3:00 = ____ sata',
        answer: 'tri',
      },
      {
        id: '2',
        text: '7:30 = sedam i ____',
        answer: 'po',
        hint: 'Half past'
      },
      {
        id: '3',
        text: '9:15 = devet i ____',
        answer: 'petnaest',
        hint: 'Quarter past'
      },
      {
        id: '4',
        text: '10:45 = jedanaest bez ____',
        answer: 'petnaest',
        hint: 'Quarter to 11'
      },
      {
        id: '5',
        text: '12:00 = ____ sati',
        answer: 'dvanaest',
      },
      {
        id: '6',
        text: '5:00 = ____ sati',
        answer: 'pet',
      },
    ] as FillInBlankQuestion[]
  },
  'unit9_schedule': {
    type: 'translation',
    title: 'Exercise 2: Schedule and Time Questions',
    instructions: 'Translate these time-related phrases from English to Serbian:',
    questions: [
      {
        id: '1',
        prompt: 'What time is it?',
        answer: 'Koliko je sati?',
        acceptableAlternatives: ['koliko je sati']
      },
      {
        id: '2',
        prompt: 'At 7 o\'clock.',
        answer: 'U 7 sati.',
        acceptableAlternatives: ['u 7 sati', 'U sedam sati', 'u sedam sati']
      },
      {
        id: '3',
        prompt: 'At what time?',
        answer: 'U koliko sati?',
        acceptableAlternatives: ['u koliko sati']
      },
      {
        id: '4',
        prompt: 'From 9 to 5.',
        answer: 'Od 9 do 5.',
        acceptableAlternatives: ['od 9 do 5', 'Od devet do pet', 'od devet do pet']
      },
      {
        id: '5',
        prompt: 'On Monday.',
        answer: 'U ponedeljak.',
        acceptableAlternatives: ['u ponedeljak']
      },
    ] as TranslationQuestion[]
  },
  'unit9_days': {
    type: 'fillInBlank',
    title: 'Exercise 3: Days of the Week',
    instructions: 'Translate these days to Serbian:',
    questions: [
      {
        id: '1',
        text: 'Monday = ____',
        answer: 'ponedeljak',
      },
      {
        id: '2',
        text: 'Tuesday = ____',
        answer: 'utorak',
      },
      {
        id: '3',
        text: 'Wednesday = ____',
        answer: 'sreda',
      },
      {
        id: '4',
        text: 'Thursday = ____',
        answer: 'četvrtak',
      },
      {
        id: '5',
        text: 'Friday = ____',
        answer: 'petak',
      },
      {
        id: '6',
        text: 'Saturday = ____',
        answer: 'subota',
      },
      {
        id: '7',
        text: 'Sunday = ____',
        answer: 'nedelja',
      },
    ] as FillInBlankQuestion[]
  },
};

// UNIT 10 EXERCISES
export const UNIT10_EXERCISES = {
  'unit10_family': {
    type: 'fillInBlank',
    title: 'Exercise 1: Family Vocabulary',
    instructions: 'Translate these family members to Serbian:',
    questions: [
      {
        id: '1',
        text: 'father = ____',
        answer: 'otac',
      },
      {
        id: '2',
        text: 'mother = ____',
        answer: 'majka',
      },
      {
        id: '3',
        text: 'brother = ____',
        answer: 'brat',
      },
      {
        id: '4',
        text: 'sister = ____',
        answer: 'sestra',
      },
      {
        id: '5',
        text: 'son = ____',
        answer: 'sin',
      },
      {
        id: '6',
        text: 'daughter = ____',
        answer: 'ćerka',
      },
      {
        id: '7',
        text: 'grandfather = ____',
        answer: 'deda',
      },
      {
        id: '8',
        text: 'grandmother = ____',
        answer: 'baka',
      },
    ] as FillInBlankQuestion[]
  },
  'unit10_relationships': {
    type: 'translation',
    title: 'Exercise 2: Talking About Family',
    instructions: 'Translate these family-related sentences from English to Serbian:',
    questions: [
      {
        id: '1',
        prompt: 'I have a brother.',
        answer: 'Imam brata.',
        acceptableAlternatives: ['imam brata', 'Ja imam brata']
      },
      {
        id: '2',
        prompt: 'My family is big.',
        answer: 'Moja porodica je velika.',
        acceptableAlternatives: ['moja porodica je velika']
      },
      {
        id: '3',
        prompt: 'He is 25 years old.',
        answer: 'On ima 25 godina.',
        acceptableAlternatives: ['on ima 25 godina', 'Ima 25 godina']
      },
      {
        id: '4',
        prompt: 'My parents live in Belgrade.',
        answer: 'Moji roditelji žive u Beogradu.',
        acceptableAlternatives: ['moji roditelji žive u beogradu', 'Moji roditelji zive u Beogradu']
      },
      {
        id: '5',
        prompt: 'I have two sisters.',
        answer: 'Imam dve sestre.',
        acceptableAlternatives: ['imam dve sestre', 'Ja imam dve sestre']
      },
    ] as TranslationQuestion[]
  },
  'unit10_plurals': {
    type: 'fillInBlank',
    title: 'Exercise 3: Plural Forms',
    instructions: 'Write the plural form of these family nouns:',
    questions: [
      {
        id: '1',
        text: 'sestra → ____ (sisters)',
        answer: 'sestre',
      },
      {
        id: '2',
        text: 'brat → ____ (brothers)',
        answer: 'braća',
        hint: 'Irregular plural!'
      },
      {
        id: '3',
        text: 'sin → ____ (sons)',
        answer: 'sinovi',
      },
      {
        id: '4',
        text: 'ćerka → ____ (daughters)',
        answer: 'ćerke',
      },
      {
        id: '5',
        text: 'dete → ____ (children)',
        answer: 'deca',
        hint: 'Irregular plural!'
      },
      {
        id: '6',
        text: 'baka → ____ (grandmothers)',
        answer: 'bake',
      },
    ] as FillInBlankQuestion[]
  },
};

// Export all exercises together
export const UNITS_6_10_EXERCISES = {
  ...UNIT7_EXERCISES,
  ...UNIT8_EXERCISES,
  ...UNIT9_EXERCISES,
  ...UNIT10_EXERCISES,
};

