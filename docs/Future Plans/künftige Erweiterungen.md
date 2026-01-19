# Future Extensions

This document tracks ideas we intentionally postpone until a later milestone (e.g. Go‑Live update), to keep the current scope focused and reduce risk.

## Audio: Profile Speaker Settings (Speed + Male/Female)

**Goal**
- Let users choose a **preferred speaker** (e.g. male/female) and adjust **speaking speed** via a slider (e.g. \(0.8\times\)–\(1.2\times\), default \(1.0\times\)).
- Apply the preference consistently to:
  - Unit content audio (Phrases/Dialogues)
  - Vocabulary audio

**Key implementation notes**
- **Unit content audio**: already supports per-variant caching via a stable variant key (e.g. `voiceKey`) + hash → storageId.
- **Vocabulary audio**: current storage is **global** (`courseVocabulary.audioStorageId`). User-specific variants must **not** overwrite the global/default audio.  
  - Proposed: add a separate “vocabulary audio variants” cache table keyed by `(courseVocabularyId, voiceKey, speakingRate, versionTag)` → `audioStorageId`.
- **TTS inputs**:
  - Speaker selection depends on available `sr-RS` voices in the current Google Cloud project/region.
  - Speed should be implemented via `speakingRate` (and/or SSML `<prosody rate>`), with caching keys including the effective rate.

**Estimated effort (rough)**
- Unit content only: ~0.5–1.5 days
- Unit content + vocabulary (incl. variant cache for vocabulary): ~2–4 days

**Milestone target**
- Go‑Live update / post‑launch iteration

