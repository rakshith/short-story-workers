# Video scene audio and caption duration

Specification for ensuring generated voice-over and captions never exceed the scene duration when `mediaType` is `video` (e.g. 5s or 10s clips). Enforcement is by **narration generation only**: the system prompt and script-generation constraints MUST ensure the LLM produces narration that fits within the scene duration when spoken — **2.0 words/second for 5s scenes** and **2.6 words/second for 10s scenes**. No capping or trimming of audio or captions after generation.

## ADDED Requirements

### Requirement: Narration text SHALL be constrained at generation so voice-over and captions fit within scene duration

For any scene with `mediaType === 'video'`, the system SHALL ensure that the **narration text is created** so that when converted to speech (TTS), the resulting voice-over and captions naturally stay within the scene's declared duration (5 or 10 seconds). The system SHALL enforce this **only** via the system prompt and script-generation flow: explicit word limits per scene duration (5s → at 2.0 wps, max 10 words; 10s → at 2.6 wps, max 26 words) MUST be included in the prompt and schema so the LLM never generates over-long narration. The system SHALL NOT rely on capping, trimming, or adjusting audio or captions after generation.

#### Scenario: 5s video scene — prompt enforces max words for 5s

- **WHEN** script/narration is generated for a scene with `duration === 5` and `mediaType === 'video'`
- **THEN** the system prompt (and any schema or instructions) MUST state a maximum word count for that scene at **2.0 words/second** so the narration fits within 5 seconds (at most 10 words)
- **AND** the generated narration for that scene MUST NOT exceed that word limit so that TTS and captions naturally stay within 5s

#### Scenario: 10s video scene — prompt enforces max words for 10s

- **WHEN** script/narration is generated for a scene with `duration === 10` and `mediaType === 'video'`
- **THEN** the system prompt (and any schema or instructions) MUST state a maximum word count for that scene at **2.6 words/second** so the narration fits within 10 seconds (at most 26 words)
- **AND** the generated narration for that scene MUST NOT exceed that word limit so that TTS and captions naturally stay within 10s

#### Scenario: No post-generation capping or trimming

- **WHEN** the system generates or uses voice-over and captions for video scenes
- **THEN** the system SHALL NOT cap, trim, or adjust audio duration or caption timings after TTS to force them within scene duration
- **AND** compliance with scene duration SHALL be achieved solely by ensuring the narration text produced by the LLM fits the scene duration at generation time

#### Scenario: Outcome — voice-over and captions within scene duration

- **WHEN** narration has been generated under the above constraints for a video scene (5s or 10s)
- **THEN** the resulting voice-over duration MUST naturally be at most the scene duration
- **AND** all caption segments MUST naturally have end times within the scene duration, with no system-side trimming or capping applied
