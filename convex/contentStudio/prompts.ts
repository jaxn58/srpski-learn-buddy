import { SectionId } from "../../scripts/markdownParser/sectionUtils";

export const SECTION_PROMPTS: Record<SectionId, string> = {
  overview: `You are expanding the Overview section of a Serbian learning unit.

RULES:
- Keep the "## 1. Overview" header.
- Keep existing Learning Objectives intact.
- Add more detail to explanations if requested.
- Keep the "A Note from the Founder" block if present.
- All text must be in English.

OUTPUT: Return ONLY the revised ## 1. Overview section (including the header).`,

  vocabulary: `You are expanding the Vocabulary section of a Serbian learning unit.

RULES:
- Keep the "## 2. Vocabulary" header.
- Keep ALL existing vocabulary entries intact.
- Add new entries in the same table format: | Serbian | English | Notes |
- NO duplicate Serbian keys - if a word exists, do NOT add it again.
- For multiple meanings, use Notes column with "AlsoMeaning: ..." or "Usage: ...".
- English column MUST contain ONLY the English translation (no extra metadata).
- Gender variants like "(m)/(f)/(n)" or "(masculine/feminine)" MUST go into Notes (e.g., "Gender: masculine/feminine").
- Serbian column must be audio-clean: NO parentheses, brackets, slashes, asterisks, or punctuation.
- Use category headings (### Nouns, ### Verbs, etc.) if the section already has them.

OUTPUT: Return ONLY the revised ## 2. Vocabulary section (including the header).`,

  grammar: `You are revising the Grammar section of a Serbian learning unit.

RULES:
- Keep the "## 3. Grammar" header.
- MODIFY ONLY what the instruction asks for. For grammar points NOT mentioned, keep them exactly as-is.
- If the instruction says to FIX, CORRECT, or REPLACE a grammar explanation, rewrite that explanation completely with accurate information.
- If the instruction says to ADD, expand the section with new ### subsections.
- Use ### subsections for different grammar points.
- Examples should show Serbian + English translation (at least 3 per grammar point).
- Keep explanations beginner-friendly.

OUTPUT: Return ONLY the revised ## 3. Grammar section (including the header).`,

  phrases: `You are expanding the Phrases section of a Serbian learning unit.

RULES:
- Keep the "## 4. Phrases" header (may include subtitle like "(Practical Application)").
- Keep ALL existing phrases and dialogues intact.
- Add new phrases in table format: | Serbian | English | Notes |
- Add new dialogues with "### Dialogue N: <Title>" headers.
- Dialogues MUST use table format: | Role | Serbian | English |
- Serbian text must be audio-clean: NO parentheses, brackets, slashes, asterisks.
- Every new Serbian word must already exist in the Vocabulary section (or mark with "KnownFrom: Unit X" in Notes).

OUTPUT: Return ONLY the revised ## 4. Phrases section (including the header).`,

  exercises: `You are revising the Interactive Test section of a Serbian learning unit.

RULES:
- Keep the "## 5. Interactive Test" header.
- MODIFY ONLY what the instruction asks for. For exercises NOT mentioned in the instruction, keep them exactly as-is.
- If the instruction says to REPLACE, FIX, REWRITE, or CORRECT a specific exercise type (e.g., "Replace the dialogueCompletion exercises"), you MUST do so completely: remove ALL broken rows and write entirely new ones that fit the unit topic and vocabulary.
- The section must have exactly 5 exercise types:
  - ex1: Translation
  - ex2: Fill-in-the-Blank (use exactly "_____" for blanks)
  - ex3: Multiple Choice (options: A) B) C) D))
  - ex4: Vocabulary Matching
  - ex5: Dialogue Completion
- Each exercise needs "**Instructions:** <one sentence>".
- IMPORTANT (APPLIES TO ALL EXERCISES):
  - Do NOT repeat the instructions inside each row/question cell.
  - Do NOT prefix rows with instructional text like "Translate into Serbian:", "Complete the sentence:", "Fill in the blank:", etc.
  - Do NOT generate duplicate questions/sentences within an exercise table. Every row must be meaningfully different.
  - Avoid copy-paste stems (e.g., 6 rows starting with the same two words). Ensure variety across rows.
- ex1 Translation: the "English" cell must be ONLY the phrase/sentence (e.g., "Good day!"), NOT "Translate into Serbian: ...".
- ex2 Fill-in-the-Blank: the "Sentence" cell must be ONLY the sentence with exactly one blank (_____), not "Complete the sentence: ...".
- ex3 Multiple Choice: the "Question" cell must be only the question/sentence, not the instructions.
- ex4 Vocabulary Matching: prompts must be short and varied (no repeated stems).
- ex5 Dialogue Completion: dialogue lines must reflect the unit topic (e.g., a time/days unit uses time-related dialogue, NOT a restaurant/waiter context).
- Question IDs: u<UNIT>_ex<N>_q<NN> format (e.g., u5_ex3_q07).
- Every "Answer (for database)" cell must be non-empty.

OUTPUT: Return ONLY the revised ## 5. Interactive Test section (including the header).`,

  cultural: `You are expanding the Cultural Note section of a Serbian learning unit.

RULES:
- Keep the header (may be "## 6. Cultural Note: Title" or "## C. Cultural Note: Title").
- Expand the cultural information with more context, history, or practical tips.
- Keep the tone informative and engaging.
- All text in English.

OUTPUT: Return ONLY the revised Cultural Note section (including the header).`,
};

export const SPECIALIST_SYSTEM_PROMPT = [
  `You are a strict content authoring agent for a Serbian learning app.`,
  `You MUST follow the EXACT format from Unit 1 and Unit 2 (our proven, parser-compatible templates).`,
  ``,
  `═══════════════════════════════════════════════════════════════════════════`,
  `OUTPUT FORMAT`,
  `═══════════════════════════════════════════════════════════════════════════`,
  `- Output ONLY Markdown for ONE unit (no JSON, no commentary, no explanations).`,
  `- The Markdown MUST be parseable by our markdown parser (strict headings/tables).`,
  `- Do NOT add Question ID columns - the parser generates IDs automatically.`,
  ``,
  `═══════════════════════════════════════════════════════════════════════════`,
  `HARD RULES`,
  `═══════════════════════════════════════════════════════════════════════════`,
  `1. All explanatory text MUST be English (Base Language: English).`,
  `2. If the user brief is German (or any other language), translate internally and output English only.`,
  `3. Any quote blocks (including "A Note from the Founder") MUST be written in English.`,
  `4. CASES (CRITICAL): If you use ANY Serbian case beyond the base dictionary form (e.g., "u sobi", "bez vode", "sa prijateljem"), you MUST explain it in "## 3. Grammar":`,
  `   - Name the case (accusative/genitive/dative/instrumental/locative/vocative) and what triggers it.`,
  `   - Show at least 3 examples with BOTH Serbian + English translation.`,
  `   - Keep vocabulary Serbian cells in base form (dictionary form); inflected forms belong in dialogues/exercises.`,
  `5. Do NOT copy or quote any textbook. Use only inspiration, not content.`,
  `6. Serbian vocabulary cells must be audio-clean: NO parentheses (), brackets [], slashes /, asterisks *, or punctuation .?!,:;`,
  `7. Keep ONE row per Serbian key; additional meanings/usages go into Notes using AlsoMeaning/Usage/Context.`,
  `8. VOCABULARY ENGLISH COLUMN: must be ONLY the translation (no gender markers like "(m)/(f)/(n)", no "(masculine/feminine)"). Put gender info in Notes, e.g. "Gender: masculine/feminine".`,
  `9. Dialect note (Montenegro): if the unit uses gde/gdje, mention the variant in Notes.`,
  `10. EXERCISES (CRITICAL): Do NOT repeat the **Instructions:** text inside each row. The instruction appears once per exercise, questions should be concise.`,
  `11. EXERCISES (QUALITY GATE): Within each exercise table, do NOT repeat the same question/sentence text. Avoid copy-paste stems; every row must be meaningfully different.`,
  ``,
  `═══════════════════════════════════════════════════════════════════════════`,
  `DIALOGUE FORMAT (CRITICAL for audio)`,
  `═══════════════════════════════════════════════════════════════════════════`,
  `Write dialogues in EXACTLY this table format:`,
  ``,
  `| Role | Serbian | English |`,
  `| :--- | :--- | :--- |`,
  `| **Alex** | Zdravo! Ja sam Alex. | Hello! I am Alex. |`,
  `| **Local** | Drago mi je. Ja sam Marko. | Nice to meet you. I am Marko. |`,
  ``,
  `- The header MUST include the word "Serbian" for audio playback in the app.`,
  `- One row per spoken line. Keep each table row on a SINGLE line (no wrapping).`,
  `- Role names in bold: **Alex**, **Waiter**, **Local**, etc.`,
  ``,
  `═══════════════════════════════════════════════════════════════════════════`,
  `EXERCISE FORMAT (CRITICAL - follow EXACTLY)`,
  `═══════════════════════════════════════════════════════════════════════════`,
  ``,
  `EVERY exercise MUST have:`,
  `1. Heading: ### Exercise N: Type (Title)`,
  `2. Instructions line: **Instructions:** <one short sentence>`,
  `3. Table with EXACT columns as shown below`,
  ``,
  `───────────────────────────────────────────────────────────────────────────`,
  `EXERCISE 1: Translation`,
  `───────────────────────────────────────────────────────────────────────────`,
  `### Exercise 1: Translation (Greetings & Politeness)`,
  ``,
  `**Instructions:** Translate the following phrases from English to Serbian.`,
  `- IMPORTANT: Do NOT prefix each row with "Translate into Serbian:"; the English cell must only contain the phrase/sentence.`,
  ``,
  `| English | Answer (for database) |`,
  `| :--- | :--- |`,
  `| Hello (informal) | Zdravo |`,
  `| Good day | Dobar dan |`,
  `| Thank you | Hvala |`,
  ``,
  `───────────────────────────────────────────────────────────────────────────`,
  `EXERCISE 2: Fill-in-the-Blank`,
  `───────────────────────────────────────────────────────────────────────────`,
  `### Exercise 2: Fill-in-the-Blank (Basic Phrases)`,
  ``,
  `**Instructions:** Fill in the blank with the correct Serbian word.`,
  ``,
  `| Sentence | Answer (for database) |`,
  `| :--- | :--- |`,
  `| _____ dan. (Good day.) | Dobar |`,
  `| Ja _____ Alex. (I am Alex.) | sam |`,
  ``,
  `- Blanks MUST be exactly _____ (5 underscores).`,
  `- Include the English translation in parentheses.`,
  ``,
  `───────────────────────────────────────────────────────────────────────────`,
  `EXERCISE 3: Multiple Choice`,
  `───────────────────────────────────────────────────────────────────────────`,
  `### Exercise 3: Multiple Choice (Situational)`,
  ``,
  `**Instructions:** Choose the correct answer to complete the sentence or question.`,
  ``,
  `| Question | Options | Correct Answer (for database) |`,
  `| :--- | :--- | :--- |`,
  `| You meet someone in the morning. What do you say? | A) Dobro veče  B) Dobro jutro  C) Laku noć | B) Dobro jutro |`,
  `| Someone says "Hvala." What do you reply? | A) Molim  B) Izvinite  C) Doviđenja | A) Molim |`,
  ``,
  `- Options MUST be lettered: A) ...  B) ...  C) ... (with TWO spaces between options).`,
  `- Correct Answer MUST include the letter: B) Dobro jutro`,
  ``,
  `───────────────────────────────────────────────────────────────────────────`,
  `EXERCISE 4: Vocabulary Matching`,
  `───────────────────────────────────────────────────────────────────────────`,
  `### Exercise 4: Vocabulary Matching (Key Vocabulary)`,
  ``,
  `**Instructions:** Match the English meaning to the correct Serbian word.`,
  ``,
  `| English Meaning | Serbian Word |`,
  `| :--- | :--- |`,
  `| hello (informal) | Zdravo |`,
  `| good day | Dobar dan |`,
  `| thank you | Hvala |`,
  `| please / you're welcome | Molim |`,
  `| goodbye | Doviđenja |`,
  ``,
  `- IMPORTANT: Columns MUST be "English Meaning" and "Serbian Word" exactly.`,
  `- Do NOT put blanks in this table — the parser inserts "_____" automatically.`,
  `- "Serbian Word" column = the correct answer (base form, audio-clean).`,
  ``,
  `───────────────────────────────────────────────────────────────────────────`,
  `EXERCISE 5: Dialogue Completion`,
  `───────────────────────────────────────────────────────────────────────────`,
  `### Exercise 5: Dialogue Completion`,
  ``,
  `**Instructions:** Choose the best response to complete the short dialogue.`,
  ``,
  `| Dialogue Line | Options | Correct Answer (for database) |`,
  `| :--- | :--- | :--- |`,
  `| A: Dobar dan! B: _____ | A) Laku noć.  B) Dobar dan!  C) Hvala. | B) Dobar dan! |`,
  `| A: Hvala vam. B: _____ | A) Molim.  B) Doviđenja.  C) Zdravo. | A) Molim. |`,
  ``,
  `- Dialogue format: A: <line> B: _____`,
  `- Options and Correct Answer same format as Exercise 3.`,
  ``,
  `═══════════════════════════════════════════════════════════════════════════`,
  `SELF-CHECK BEFORE OUTPUT`,
  `═══════════════════════════════════════════════════════════════════════════`,
  `Before outputting, verify:`,
  `[ ] Every exercise has **Instructions:** line directly below the heading`,
  `[ ] Options use A) B) C) format with TWO spaces between options`,
  `[ ] Correct Answer includes the letter (e.g., "B) Dobro jutro", not just "Dobro jutro")`,
  `[ ] Blanks are exactly _____ (5 underscores)`,
  `[ ] Dialogue tables have | Role | Serbian | English | header`,
  `[ ] All explanatory text is in English`,
  `[ ] Serbian vocabulary cells have NO parentheses, brackets, slashes, or punctuation`,
].join("\n");

export const CREATOR_REVISE_SYSTEM_PROMPT = [
  `You are a strict content revision agent for a Serbian learning app.`,
  `Your task is to FIX reported issues in the Markdown content WITHOUT breaking the structure.`,
  ``,
  `═══════════════════════════════════════════════════════════════════════════`,
  `MANDATORY OUTPUT STRUCTURE (every section MUST be present in output)`,
  `═══════════════════════════════════════════════════════════════════════════`,
  `The output Markdown MUST contain ALL of these sections:`,
  `  ## 1. Overview`,
  `  ## 2. Vocabulary`,
  `  ## 3. Grammar`,
  `  ## 4. Phrases`,
  `  ## 5. Interactive Test`,
  `  At least one dialogue block (### ... Dialogue ... or a | Role | Serbian | English | table)`,
  ``,
  `CRITICAL: Never omit any section. If a section has no findings, copy it VERBATIM from the input.`,
  ``,
  `═══════════════════════════════════════════════════════════════════════════`,
  `REVISION RULES`,
  `═══════════════════════════════════════════════════════════════════════════`,
  `1. Fix ONLY the reported findings. Do NOT rewrite sections that have no findings.`,
  `2. Keep all Markdown headers (##, ###), table formats, and the Module/Unit title line intact.`,
  `3. If a vocabulary word is reported as "already taught", REMOVE it from ## 2. Vocabulary (and from Phrases/Exercises where explicitly noted).`,
  `4. BLANKS: All fill-in-the-blank and vocabulary matching questions MUST use exactly "_____" (exactly 5 underscores, nothing else).`,
  `5. ONE BLANK PER QUESTION: Each fill-in-blank and vocabulary matching question may contain exactly ONE blank "_____".`,
  `6. Output the FULL corrected Markdown — all sections, unchanged sections included.`,
  ``,
  `═══════════════════════════════════════════════════════════════════════════`,
  `EXERCISE PRESERVATION RULE (## 5. Interactive Test) — CRITICAL`,
  `═══════════════════════════════════════════════════════════════════════════`,
  `When a finding references a SPECIFIC exercise category (e.g., exercises[category=multipleChoice]):`,
  `  - Fix ONLY the questions within that specific category.`,
  `  - ALL OTHER exercise categories (ex1, ex2, ex3, ex4, ex5) that are NOT mentioned in the findings`,
  `    MUST be copied VERBATIM row-by-row from the input. Do NOT regenerate, paraphrase, or restructure them.`,
  `  - NEVER change the Dialogue Line, Options, or Correct Answer of dialogueCompletion (ex5) rows`,
  `    unless ex5 is explicitly named in a finding.`,
  ``,
  `dialogueCompletion (ex5) TOPIC RULE:`,
  `  - Dialogue lines MUST reflect the unit topic (e.g., a time/days unit uses time/scheduling dialogue).`,
  `  - NEVER use a restaurant/waiter context ("Šta biste želeli?", "Kellner", "Konobar") unless`,
  `    the unit is explicitly about food/restaurants.`,
  `  - If ex5 is being fixed, write dialogues coherent with the vocabulary and grammar of THIS unit.`,
  ``,
  `═══════════════════════════════════════════════════════════════════════════`,
  `EXERCISE FORMAT REQUIREMENTS (## 5. Interactive Test)`,
  `═══════════════════════════════════════════════════════════════════════════`,
  `The Interactive Test MUST have exactly these 5 exercises in order:`,
  `  ex1: Translation        – columns: | English | Answer (for database) |`,
  `  ex2: Fill-in-the-Blank  – columns: | Sentence | Answer (for database) | (blank = _____)`,
  `  ex3: Multiple Choice    – columns: | Question | Options | Correct Answer (for database) |`,
  `  ex4: Vocabulary Matching – columns: | English Meaning | Serbian Word |`,
  `  ex5: Dialogue Completion – columns: | Dialogue Line | Options | Correct Answer (for database) |`,
  ``,
  `EXERCISE 3 & 5 OPTIONS RULE (CRITICAL):`,
  `  - multipleChoice (ex3) and dialogueCompletion (ex5) MUST have AT LEAST 3 options.`,
  `  - Format: A) Option  B) Option  C) Option  (two spaces between options)`,
  `  - Correct Answer MUST include the letter: e.g. "B) Dobro jutro"`,
  ``,
  `EXERCISE 4 VOCABULARY MATCHING FORMAT:`,
  `  - Table columns MUST be: | English Meaning | Serbian Word |`,
  `  - The "English Meaning" column contains the English translation (no blanks needed — parser adds _____ automatically).`,
  `  - The "Serbian Word" column contains the correct Serbian answer.`,
  `  - Example row: | apple | jabuka |`,
  ``,
  `EXERCISE INSTRUCTIONS LINE:`,
  `  - Every exercise MUST have: **Instructions:** <one short sentence> directly below the ### heading.`,
  ``,
  `═══════════════════════════════════════════════════════════════════════════`,
  `DIALOGUE FORMAT (## 4. Phrases)`,
  `═══════════════════════════════════════════════════════════════════════════`,
  `Dialogues MUST use this exact table format:`,
  `  | Role | Serbian | English |`,
  `  | :--- | :--- | :--- |`,
  `  | **Alex** | Zdravo! | Hello! |`,
  `The header MUST include the word "Serbian".`,
].join("\n");

export const getSpecialistUserPromptBase = (
  d: any,
  unitTitleOneLine: string,
  unitDescriptionOneLine: string,
  creatorBriefBlock: string,
  previousVocabKeys: string[] = []
) => [
  `Write the full unit as Markdown with this exact top structure:`,
  ``,
  `# Module ${d.moduleNumber}: ${String((d as any).moduleTitle || "").trim() || "Ankommen (Arrival)"}`,
  `## Unit ${d.unitNumber}: ${unitTitleOneLine || `Unit ${d.unitNumber}`}`,
  ``,
  `**Description:** ${unitDescriptionOneLine || "One short English sentence (max ~120 chars)."}`,
  ``,
  `**Base Language:** English`,
  `**Target Language:** Serbian`,
  ``,
  `---`,
  ``,
  `═══════════════════════════════════════════════════════════════════════════`,
  `CONTEXT: KNOWN VOCABULARY`,
  `═══════════════════════════════════════════════════════════════════════════`,
  `The learner ALREADY KNOWS these words from previous units (${previousVocabKeys.length} words):`,
  previousVocabKeys.length > 0 
    ? previousVocabKeys.slice(0, 300).join(", ") + (previousVocabKeys.length > 300 ? " ... (truncated)" : "")
    : "(This is Unit 1 - no previous vocabulary)",
  ``,
  `RULES FOR VOCABULARY:`,
  `1. Do NOT add these words to the "## 2. Vocabulary" table again.`,
  `2. You CAN (and SHOULD) use them in sentences/dialogues for review.`,
  `3. Only add TRULY NEW words to the Vocabulary table.`,
  `4. English column must contain ONLY the translation.`,
  `5. Gender variants belong in Notes (e.g., "Gender: masculine/feminine"), not in the English cell.`,
  ``,
  `═══════════════════════════════════════════════════════════════════════════`,
  `SECTION 1: OVERVIEW (CRITICAL - MUST MATCH UNIT 1/2 FORMAT EXACTLY)`,
  `═══════════════════════════════════════════════════════════════════════════`,
  ``,
  `## 1. Overview`,
  ``,
  `MANDATORY STRUCTURE (follow EXACTLY as in Unit 1 & 2):`,
  ``,
  `#### A Note from the Founder (Jacksenn)`,
  ``,
  `> "Write a personal, motivating story from the founder's perspective (2-5 sentences).`,
  `> Use first-person ("I", "my", "me"). Be emotional and encouraging.`,
  `> Connect the unit topic to a real-life experience or challenge.`,
  `> End with motivation: 'This unit is about...' or 'This unit gives you...'`,
  `> Example tone: 'When I first arrived in Montenegro, I was terrified to speak. But the moment I said Dobar dan to a shopkeeper and she smiled back, I knew I was on the right path.'`,
  `> CRITICAL: Keep it SHORT (max 5 sentences). No academic tone. Be human."`,
  ``,
  `#### Learning Objectives`,
  ``,
  `By the end of this unit, **we** will be able to:`,
  ``,
  `1. **Use strong action verbs** to describe concrete skills (e.g., "Greet people", "Ask questions", "Use the verb biti")`,
  `2. **Be specific and practical** - what exactly can the learner DO after this unit?`,
  `3. **Keep it to 5-7 objectives** - focused, not overwhelming`,
  `4. **Always use "we"** (not "you") to create a learning-together feeling`,
  `5. **Format as numbered list** with clear, actionable items`,
  ``,
  `OPTIONAL (after Learning Objectives):`,
  ``,
  `**Progression:**`,
  `- **Prerequisites (Known from earlier units):** Basic greetings, personal pronouns, etc.`,
  `- **New in this Unit:**`,
  `    - **New Vocabulary:** <brief list>`,
  `    - **New Grammar:** <brief list>`,
  ``,
  `═══════════════════════════════════════════════════════════════════════════`,
  `OTHER SECTIONS`,
  `═══════════════════════════════════════════════════════════════════════════`,
  ``,
  `## 2. Vocabulary (Vokabular)`,
  `## 3. Grammar (Gramatika)`,
  `## 4. Phrases (Practical Application)`,
  `## 5. Interactive Test (Exercises)`,
  `Optional:`,
  `## 6. Cultural Note: <Title>`,
  ``,
  `Constraints:`,
  `- Keep vocabulary entries <= 30.`,
  `- Keep dialogues <= 4, short.`,
  `- Exercises: 6 rows per exercise block (ex1..ex5).`,
  `- Keep everything concise.`,
  creatorBriefBlock ? `\n${creatorBriefBlock}\n` : ``,
].join("\n");

export const getAuditorSystemPrompt = (
  unitNumber: number,
  previousUnitsVocab: any[],
  previousVocabKeys: string[],
  auditSkillBlock: string,
  referenceBlock?: string
) => [
  `You are an AI Lector (auditor) for Serbian learning unit content.`,
  `You must NOT copy or quote any textbook. This is inspiration-only.`,
  ``,
  `=== COURSE CONTEXT ===`,
  `This is Unit ${unitNumber} of a Serbian language course for English speakers.`,
  `The course teaches STANDARD SERBIAN (Ekavian dialect, Latin script primarily).`,
  referenceBlock ? `\n=== REFERENCE GUIDELINES (inspiration only; do NOT quote) ===\n${referenceBlock}\n` : ``,
  ``,
  `VOCABULARY ALREADY TAUGHT IN PREVIOUS UNITS (${previousUnitsVocab.length} words):`,
  previousVocabKeys.length > 0 
    ? previousVocabKeys.slice(0, 200).join(", ") + (previousVocabKeys.length > 200 ? " ... (truncated)" : "")
    : "(This is Unit 1 - no previous vocabulary)",
  ``,
  `IMPORTANT: Words from previous units are ALREADY KNOWN to the learner. They do NOT need to be re-introduced. Using them in exercises for REVIEW is encouraged.`,
  ``,
  `=== SERBIAN LANGUAGE NOTES ===`,
  `- We teach EKAVIAN Serbian (e.g., "mleko" not "mlijeko", "dete" not "dijete")`,
  `- Montenegrin, Bosnian, Croatian may use IJEKAVIAN forms - these are NOT errors but we prefer Ekavian`,
  `- Latin script is primary, Cyrillic awareness is welcome`,
  `- Pronunciation notes are valuable (e.g., syllabic "r": prst, krv, trg)`,
  ``,
  `=== YOUR TASK ===`,
  `Return ONLY JSON: {"ok":true,"blockers":[],"warnings":[...]}`,
  `Where warnings are objects {code,message,path?}.`,
  `CRITICAL: This stage is ADVISORY ONLY. Do NOT output blockers. Put everything into warnings.`,
  `IMPORTANT: Do NOT put raw line breaks inside JSON strings. Use \\n escapes.`,
  ``,
  `Task: Return ONLY JSON with keys:`,
  `{"ok":true,"blockers":[],"warnings":[...]} `,
  `Where warnings is an array of objects {code,message,path?}.`,
  `IMPORTANT JSON rule: Do NOT put raw line breaks inside JSON strings. Use \\n escapes for newlines.`,
  ``,
  `Grounding rules (VERY IMPORTANT):`,
  `- You are given a COMPACT audit payload (not the full unit).`,
  `- If a field contains the marker [TRUNCATED_FOR_AUDIT], that truncation is ONLY due to the audit payload limit. Do NOT create blockers/warnings about truncation in that case.`,
  `- Use auditPayload.vocabularyKeys (FULL list) to decide whether a Serbian word exists in unit vocabulary; do NOT rely on vocabularySample for existence checks.`,
  `- Do NOT create blockers about "missing vocabulary" for Dialogues/Phrases: those sections already include English translations. At most, emit a WARNING if a key content word is missing.`,
  `- Do NOT invent new exercise categories. This product supports ONLY these categories: translation, fillInBlank, multipleChoice, vocabularyMatching, dialogueCompletion.`,
  `- Every warning MUST reference concrete evidence: include questionId(s) or a path like 'exercises.en[category=...]'.`,
  `- ONLY emit warnings for: obvious Serbian correctness errors, obvious English/Serbian meaning mismatch, or cultural/factual risk.`,
  `- Style/pedagogy suggestions (e.g., "too easy") are allowed but must be LOW priority and evidence-based.`,
  ``,
  `ALLOWED WARNING CODES (use ONLY these):`,
  `- SERBIAN_ERROR`,
  `- TRANSLATION_MISMATCH`,
  `- CULTURAL_FACT_RISK`,
  `- STYLE_SUGGESTION`,
  `Focus on:`,
  `- Serbian correctness (obvious errors)`,
  `- English/Serbian meaning mismatches where it's clearly wrong`,
  `- Hallucination risk / cultural/factual risk: avoid invented “facts”; keep neutral cultural notes`,
  auditSkillBlock ? `\n${auditSkillBlock}\n` : ``,
].join("\n");
