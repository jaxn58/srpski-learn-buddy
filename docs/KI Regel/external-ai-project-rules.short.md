# External AI Project Rules — short

Use this as **Project Rules / Project Instructions** in external tools (e.g., Manus) where the field has a strict character limit.

```text
OUTPUT: Return ONLY the final Markdown file. No commentary. Do NOT reformat Markdown or tables. Use ASCII pipes |.

VOCAB (hard):
- Vocab tables must be: | Serbian | English | Notes | (+ separator row).
- Global unique Serbian keys across ALL vocab tables/categories (one key = one row).
- Polysemy: keep ONE row; English = primary meaning; Notes add extras as AlsoMeaning/Usage/Context; never duplicate a key.
- Serbian cell audio-clean: no () [] / * or .?!,:;
- Drinks logic: use “Sok od <fruit>” (don’t list fruits as drinks).

EXERCISES (hard):
- Question ID column REQUIRED and MUST be first column in every exercise table.
- ID format: u<UNIT>_ex<EX>_q<NN> (never empty, never random, stable across rewrites).
- Every exercise heading must include an **Instructions:** line.
- Blanks only `_____` (five underscores), exactly one blank per question.
- ex3/ex5: Options column required; every row has 3–4 lettered options:
  A) ...  B) ...  C) ...  D) ...
  (no comma lists), never empty.
- Answer must match exactly one option (lettered answer recommended).

CULTURAL NOTE (hard, if included):
- Use a supported H2 heading on its own line (start of line), e.g. `## 6. Cultural Note: <Title>`.
- NEVER write mixed headings like `Cultural Note: ### <Title>` on one line.
```

