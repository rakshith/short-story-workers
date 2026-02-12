## Why
<!-- Explain the motivation. What problem does this solve? Why now? -->
when the mediaType is video the audio generation caption exceeds the 5s scene duration this should not happen audioGenertaion always should be below the scene duration ensure this

## What Changes
<!-- Bullet list of changes. Mark breaking changes with **BREAKING**. -->
- scene duration > audio duration ensure this condition
## Capabilities
### New Capabilities
- `video-scene-audio-caption-duration`: Voice-over and captions for video scenes (5s/10s) must never exceed scene duration; system shall cap or constrain so audio and captions stay within the clip.

### Modified Capabilities
<!-- Existing spec names from openspec/specs/. Leave empty if none. -->

## Impact
<!-- Affected code, APIs, dependencies, systems -->
the 