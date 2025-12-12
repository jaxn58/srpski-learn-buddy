import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FillInBlankExercise, type FillInBlankQuestion } from './exercises/FillInBlank';
import { TranslationExercise, type TranslationQuestion } from './exercises/TranslationExercise';
import { GenderRecognitionExercise, type GenderRecognitionQuestion } from './exercises/GenderRecognition';
import { UNIT2_EXERCISES } from './exercises/unit2-exercises';
import { UNITS_3_5_EXERCISES } from './exercises/units-3-5-exercises';
import { UNIT6_EXERCISES } from './exercises/unit6-exercises';
import { UNITS_6_10_EXERCISES } from './exercises/units-6-10-exercises';
import { UNITS_11_15_EXERCISES } from './exercises/units-11-15-exercises';
import { UNITS_16_27_EXERCISES } from './exercises/units-16-27-exercises';

// Exercise data definitions
const EXERCISES: Record<string, any> = {
  ...UNIT2_EXERCISES,
  ...UNITS_3_5_EXERCISES,
  ...UNIT6_EXERCISES,
  ...UNITS_6_10_EXERCISES,
  ...UNITS_11_15_EXERCISES,
  ...UNITS_16_27_EXERCISES,
  'unit1-biti-conjugation': {
    type: 'fillInBlank',
    title: 'Exercise 1: Fill in the Blanks (Verb "biti")',
    instructions: 'Complete the sentences with the correct form of "biti":',
    questions: [
      {
        id: '1',
        text: 'Ja ____ student. (I am a student)',
        answer: 'sam',
        hint: '"I" form of biti'
      },
      {
        id: '2',
        text: 'Ti ____ turist. (You are a tourist)',
        answer: 'si',
        hint: 'Informal "you" form'
      },
      {
        id: '3',
        text: 'On ____ pilot. (He is a pilot)',
        answer: 'je',
        hint: '"He/she/it" form'
      },
      {
        id: '4',
        text: 'Mi ____ iz Srbije. (We are from Serbia)',
        answer: 'smo',
        hint: '"We" form'
      },
      {
        id: '5',
        text: 'Vi ____ profesor. (You are a professor)',
        answer: 'ste',
        hint: 'Formal "you" form'
      },
      {
        id: '6',
        text: 'Oni ____ studenti. (They are students)',
        answer: 'su',
        hint: '"They" form'
      },
    ] as FillInBlankQuestion[]
  },
  'unit1-basic-phrases': {
    type: 'translation',
    title: 'Exercise 2: Translate to Serbian',
    instructions: 'Translate these common phrases from English to Serbian:',
    questions: [
      {
        id: '1',
        prompt: 'Good day!',
        answer: 'Dobar dan!',
        acceptableAlternatives: ['Dobar dan', 'dobar dan']
      },
      {
        id: '2',
        prompt: 'I am from Germany.',
        answer: 'Ja sam iz Nemačke.',
        acceptableAlternatives: ['Ja sam iz Nemacke', 'ja sam iz Nemačke']
      },
      {
        id: '3',
        prompt: 'Nice to meet you.',
        answer: 'Drago mi je.',
        acceptableAlternatives: ['drago mi je']
      },
      {
        id: '4',
        prompt: 'Where are you from?',
        answer: 'Odakle ste?',
        acceptableAlternatives: ['odakle ste']
      },
      {
        id: '5',
        prompt: 'Thank you.',
        answer: 'Hvala.',
        acceptableAlternatives: ['Hvala', 'hvala']
      },
    ] as TranslationQuestion[]
  },
  'unit1-gender': {
    type: 'genderRecognition',
    title: 'Exercise 3: Gender Recognition',
    instructions: 'Identify the gender of these nouns (masculine, feminine, or neuter):',
    questions: [
      {
        id: '1',
        text: 'aerodrom (airport)',
        answer: 'masculine',
        hint: 'Ends in a consonant'
      },
      {
        id: '2',
        text: 'karta (ticket)',
        answer: 'feminine',
        hint: 'Ends in -a'
      },
      {
        id: '3',
        text: 'ime (name)',
        answer: 'neuter',
        hint: 'Ends in -e'
      },
      {
        id: '4',
        text: 'student (student)',
        answer: 'masculine',
        hint: 'Ends in a consonant'
      },
      {
        id: '5',
        text: 'Srbija (Serbia)',
        answer: 'feminine',
        hint: 'Ends in -a'
      },
    ] as GenderRecognitionQuestion[]
  },
};

interface InteractiveMarkdownContentProps {
  content: string;
  unitNumber: number;
}

export function InteractiveMarkdownContent({ content, unitNumber }: InteractiveMarkdownContentProps) {
  // Split content by exercise markers
  const parts = content.split(/(<InteractiveExercise[^>]*\/>)/g);
  const markerMatches = Array.from(content.matchAll(/<InteractiveExercise[^>]*id="([^"]+)"[^>]*\/>/g));

  return (
    <div className="space-y-6">
      {parts.map((part, index) => {
        // Check if this part is an exercise marker
        const exerciseMatch = part.match(/<InteractiveExercise type="([^"]+)" id="([^"]+)"\s*\/>/);
        
        if (exerciseMatch) {
          const [, type, id] = exerciseMatch;
          const exerciseData = EXERCISES[id];
          
          if (!exerciseData) {
            console.warn(`Exercise not found: ${id}`);
            return null;
          }

          if (exerciseData.type === 'fillInBlank') {
            return (
              <FillInBlankExercise
                key={index}
                title={exerciseData.title}
                instructions={exerciseData.instructions}
                questions={exerciseData.questions}
                exerciseId={id}
                unitNumber={unitNumber}
              />
            );
          } else if (exerciseData.type === 'translation') {
            return (
              <TranslationExercise
                key={index}
                title={exerciseData.title}
                instructions={exerciseData.instructions}
                questions={exerciseData.questions}
                exerciseId={id}
                unitNumber={unitNumber}
              />
            );
          } else if (exerciseData.type === 'genderRecognition') {
            return (
              <GenderRecognitionExercise
                key={index}
                title={exerciseData.title}
                instructions={exerciseData.instructions}
                questions={exerciseData.questions}
                exerciseId={id}
                unitNumber={unitNumber}
              />
            );
          }
          
          return null;
        }

        // Regular markdown content
        if (part.trim()) {
          return (
            <div key={index} className="markdown-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ node, ...props }) => (
                    <h1 className="text-3xl font-bold mb-4 mt-8" {...props} />
                  ),
                  h2: ({ node, ...props }) => (
                    <h2 className="text-2xl font-bold mb-3 mt-6" {...props} />
                  ),
                  h3: ({ node, ...props }) => (
                    <h3 className="text-xl font-semibold mb-2 mt-4" {...props} />
                  ),
                  p: ({ node, ...props }) => (
                    <p className="mb-4 leading-relaxed" {...props} />
                  ),
                  ul: ({ node, ...props }) => (
                    <ul className="list-disc list-inside mb-4 space-y-1" {...props} />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol className="list-decimal list-inside mb-4 space-y-1" {...props} />
                  ),
                  table: ({ node, ...props }) => (
                    <div className="overflow-x-auto mb-4">
                      <table className="min-w-full border-collapse border border-gray-300" {...props} />
                    </div>
                  ),
                  thead: ({ node, ...props }) => (
                    <thead className="bg-gray-100" {...props} />
                  ),
                  th: ({ node, ...props }) => (
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold" {...props} />
                  ),
                  td: ({ node, ...props }) => (
                    <td className="border border-gray-300 px-4 py-2" {...props} />
                  ),
                  code: ({ node, inline, ...props }: any) =>
                    inline ? (
                      <code className="bg-gray-100 px-1 py-0.5 rounded text-sm" {...props} />
                    ) : (
                      <code className="block bg-gray-100 p-4 rounded-lg mb-4 overflow-x-auto" {...props} />
                    ),
                  blockquote: ({ node, ...props }) => (
                    <blockquote className="border-l-4 border-blue-500 pl-4 italic my-4 text-gray-700" {...props} />
                  ),
                  a: ({ node, ...props }) => (
                    <a className="text-blue-600 hover:underline" {...props} />
                  ),
                  hr: ({ node, ...props }) => (
                    <hr className="my-6 border-gray-300" {...props} />
                  ),
                  strong: ({ node, ...props }) => (
                    <strong className="font-bold text-gray-900" {...props} />
                  ),
                }}
              >
                {part}
              </ReactMarkdown>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

