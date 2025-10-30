import { FillInBlankQuestion } from './FillInBlank';
import { TranslationQuestion } from './TranslationExercise';

export const UNITS_3_5_EXERCISES = {
  // UNIT 3 EXERCISES
  'unit3-present-tense': {
    type: 'fillInBlank',
    title: 'Exercise 1: Present Tense Verbs',
    instructions: 'Complete the sentences with the correct verb form:',
    questions: [
      {
        id: '1',
        text: 'Ja ____ knjigu. (I read a book) [čitati]',
        answer: 'čitam',
        hint: '"I" form of čitati'
      },
      {
        id: '2',
        text: 'Ti ____ televiziju. (You watch TV) [gledati]',
        answer: 'gledaš',
        hint: '"You" form of gledati'
      },
      {
        id: '3',
        text: 'On ____ srpski. (He speaks Serbian) [govoriti]',
        answer: 'govori',
        hint: '"He" form of govoriti'
      },
      {
        id: '4',
        text: 'Mi ____ srpski. (We learn Serbian) [učiti]',
        answer: 'učimo',
        hint: '"We" form of učiti'
      },
      {
        id: '5',
        text: 'Vi ____ radio. (You listen to radio) [slušati]',
        answer: 'slušate',
        hint: '"You" (formal) form of slušati'
      },
    ] as FillInBlankQuestion[]
  },
  'unit3-locative': {
    type: 'fillInBlank',
    title: 'Exercise 2: Locative Case',
    instructions: 'Complete with the correct Locative form:',
    questions: [
      {
        id: '1',
        text: 'Ja sam u ____. (I am in Belgrade) [Beograd]',
        answer: 'Beogradu',
        hint: 'Masculine noun + u'
      },
      {
        id: '2',
        text: 'On je u ____. (He is in school) [škola]',
        answer: 'školi',
        hint: 'Feminine noun ending in -a'
      },
      {
        id: '3',
        text: 'Pričamo o ____. (We talk about the film) [film]',
        answer: 'filmu',
        hint: 'Masculine noun + o'
      },
      {
        id: '4',
        text: 'Živim u ____. (I live in Serbia) [Srbija]',
        answer: 'Srbiji',
        hint: 'Feminine noun ending in -a'
      },
    ] as FillInBlankQuestion[]
  },
  'unit3-daily-activities': {
    type: 'translation',
    title: 'Exercise 3: Daily Activities',
    instructions: 'Translate these sentences to Serbian:',
    questions: [
      {
        id: '1',
        prompt: 'I read a book.',
        answer: 'Ja čitam knjigu.',
        acceptableAlternatives: ['Čitam knjigu', 'čitam knjigu']
      },
      {
        id: '2',
        prompt: 'You watch TV.',
        answer: 'Ti gledaš televiziju.',
        acceptableAlternatives: ['Gledaš televiziju', 'gledaš televiziju']
      },
      {
        id: '3',
        prompt: 'We learn Serbian.',
        answer: 'Mi učimo srpski.',
        acceptableAlternatives: ['Učimo srpski', 'učimo srpski']
      },
      {
        id: '4',
        prompt: 'They listen to radio.',
        answer: 'Oni slušaju radio.',
        acceptableAlternatives: ['Slušaju radio', 'slušaju radio']
      },
    ] as TranslationQuestion[]
  },

  // UNIT 4 EXERCISES
  'unit4-ici-conjugation': {
    type: 'fillInBlank',
    title: 'Exercise 1: Verb "ići" (to go)',
    instructions: 'Complete the sentences with the correct form of "ići":',
    questions: [
      {
        id: '1',
        text: 'Ja ____ kući. (I go home)',
        answer: 'idem',
        hint: '"I" form of ići'
      },
      {
        id: '2',
        text: 'Ti ____ u grad. (You go to the city)',
        answer: 'ideš',
        hint: '"You" form of ići'
      },
      {
        id: '3',
        text: 'On ____ u školu. (He goes to school)',
        answer: 'ide',
        hint: '"He" form of ići'
      },
      {
        id: '4',
        text: 'Mi ____ u bioskop. (We go to the cinema)',
        answer: 'idemo',
        hint: '"We" form of ići'
      },
      {
        id: '5',
        text: 'Oni ____ u park. (They go to the park)',
        answer: 'idu',
        hint: '"They" form of ići'
      },
    ] as FillInBlankQuestion[]
  },
  'unit4-directions': {
    type: 'fillInBlank',
    title: 'Exercise 2: Directions',
    instructions: 'Fill in the direction words:',
    questions: [
      {
        id: '1',
        text: 'Turn left = Skrenite ____',
        answer: 'levo',
      },
      {
        id: '2',
        text: 'Go straight = Idite ____',
        answer: 'pravo',
      },
      {
        id: '3',
        text: 'Turn right = Skrenite ____',
        answer: 'desno',
      },
      {
        id: '4',
        text: 'It is near = To je ____',
        answer: 'blizu',
      },
    ] as FillInBlankQuestion[]
  },
  'unit4-city-vocab': {
    type: 'translation',
    title: 'Exercise 3: City Vocabulary',
    instructions: 'Translate to Serbian:',
    questions: [
      {
        id: '1',
        prompt: 'Where is the post office?',
        answer: 'Gde je pošta?',
        acceptableAlternatives: ['gde je pošta', 'Gde je posta?']
      },
      {
        id: '2',
        prompt: 'I go to the center.',
        answer: 'Idem u centar.',
        acceptableAlternatives: ['idem u centar', 'Ja idem u centar']
      },
      {
        id: '3',
        prompt: 'The bank is near.',
        answer: 'Banka je blizu.',
        acceptableAlternatives: ['banka je blizu']
      },
    ] as TranslationQuestion[]
  },

  // UNIT 5 EXERCISES
  'unit5-moci-conjugation': {
    type: 'fillInBlank',
    title: 'Exercise 1: Verb "moći" (can)',
    instructions: 'Complete the sentences with the correct form of "moći":',
    questions: [
      {
        id: '1',
        text: 'Ja ____ da pomognem. (I can help)',
        answer: 'mogu',
        hint: '"I" form of moći'
      },
      {
        id: '2',
        text: 'Ti ____ da dođeš. (You can come)',
        answer: 'možeš',
        hint: '"You" form of moći'
      },
      {
        id: '3',
        text: 'On ____ da govori srpski. (He can speak Serbian)',
        answer: 'može',
        hint: '"He" form of moći'
      },
      {
        id: '4',
        text: 'Mi ____ da idemo. (We can go)',
        answer: 'možemo',
        hint: '"We" form of moći'
      },
    ] as FillInBlankQuestion[]
  },
  'unit5-ordinals': {
    type: 'fillInBlank',
    title: 'Exercise 2: Ordinal Numbers',
    instructions: 'Write the ordinal number in Serbian (masculine form):',
    questions: [
      {
        id: '1',
        text: 'first = ____',
        answer: 'prvi',
      },
      {
        id: '2',
        text: 'second = ____',
        answer: 'drugi',
      },
      {
        id: '3',
        text: 'third = ____',
        answer: 'treći',
      },
      {
        id: '4',
        text: 'fourth = ____',
        answer: 'četvrti',
      },
    ] as FillInBlankQuestion[]
  },
  'unit5-furniture': {
    type: 'translation',
    title: 'Exercise 3: Furniture Vocabulary',
    instructions: 'Translate to Serbian:',
    questions: [
      {
        id: '1',
        prompt: 'The bed is big.',
        answer: 'Krevet je veliki.',
        acceptableAlternatives: ['krevet je veliki', 'Krevet je velik']
      },
      {
        id: '2',
        prompt: 'I have a table.',
        answer: 'Imam sto.',
        acceptableAlternatives: ['imam sto', 'Ja imam sto']
      },
      {
        id: '3',
        prompt: 'The room is beautiful.',
        answer: 'Soba je lepa.',
        acceptableAlternatives: ['soba je lepa']
      },
    ] as TranslationQuestion[]
  },
};

