import { z } from 'zod';
import { BaseScriptTemplate } from './base';
import { ScriptGenerationContext, TemplateManifest } from '../types';
import { getScenePlan } from '../utils/scene-math';
import { VIDEO_NARRATION_WPS } from '../constants';
import { createCharacterStorySchema, createYouTubeShortsSchema, YOUTUBE_SHORTS_SCHEMA } from '../schema';
import { ScriptTemplateIds } from './index';

export const SKELETON_CHARACTER_DNA = `CHARACTER DNA
transparent humanoid body shell
visible ivory skeleton
large round cartoon eyes
smooth skull shape
wide surprised expression`;

export const SKELETON_CONSISTENCY_LINE = 'same character as the reference image, same skull shape, same eyes, same proportions';

export const ADVERTISER_FRIENDLY_FILTER = `ADVERTISER-FRIENDLY CONTENT RULES (YouTube Partner Program)
No graphic depictions of violence, gore, or injury — historical violence may be referenced but never described in visceral detail
No sexually suggestive content or innuendo of any kind
No content that is politically divisive, partisan, or that targets real living political figures negatively
No profanity or euphemistic substitutes for profanity in narration
No promotion of dangerous activities, substances, or self-harm
No content that demeans groups based on race, religion, gender, or nationality
Historical chaos and conflict is allowed — frame consequences cinematically, never sensationally
When in doubt: ask "would a mainstream brand be comfortable running an ad before this?" If no — rewrite the scene`;

export class Skeleton3DShortsTemplate extends BaseScriptTemplate {
    manifest: TemplateManifest = {
        id: ScriptTemplateIds.SKELETON_3D_SHORTS,
        name: 'Skeleton 3D Shorts',
        version: '2.0.0',
        description: '3D X-Ray Skeleton as main character — cinematic narrator voice, high-retention hooks, immersive storytelling.',
        tags: ['skeleton', '3d', 'x-ray', 'shorts', 'cinematic', 'immersive', 'high-retention', 'animation'],
    };

    getSchema(context?: ScriptGenerationContext): z.ZodType<any> {
        if (context?.duration) {
            const plan = getScenePlan(context.duration, context.mediaType || 'image');
            return createCharacterStorySchema({
                minScenes: plan.minScenes,
                maxScenes: plan.maxScenes,
                totalWordsMin: plan.totalWordsMin,
                totalWordsMax: plan.totalWordsMax,
                durationSeconds: plan.durationSeconds,
                mediaType: context.mediaType,
            });
        }
        return YOUTUBE_SHORTS_SCHEMA;
    }

    getSystemPrompt(context: ScriptGenerationContext): string {
        const {
            duration,
            language = 'en',
            mediaType = 'image',
            characterReferenceImages
        } = context;

        const effectiveReferences = (characterReferenceImages && characterReferenceImages.length > 0)
            ? characterReferenceImages
            : [];

        const hasCharacterImages = effectiveReferences.length > 0;
        const languageName = this.getLanguageName(language);
        const languageCode = language;
        const plan = getScenePlan(duration, mediaType);

        const characterDNA = SKELETON_CHARACTER_DNA;
        const consistencyLine = SKELETON_CONSISTENCY_LINE;
        const advertiserFilter = ADVERTISER_FRIENDLY_FILTER;

        return `You are an elite cinematic scriptwriter for 3D X-Ray Skeleton Shorts.

${advertiserFilter}

Your job: Take the USER PREMISE and create a short, cinematic story featuring a SKELETON as the main character. The story GENRE comes from the user's prompt, but the TONE is ALWAYS cinematic — grounded, immersive, high-stakes, never goofy or comedic.

USER PREMISE: "${context.prompt}"

The user prompt decides WHAT the story is about. YOU decide HOW it sounds — and it ALWAYS sounds like cinema. Write every line as if a film director is reading it aloud in a dark screening room.

${mediaType === 'video' ? `⚠️ MANDATORY VIDEO WORD COUNTS — REJECTED IF WRONG
• duration 5 → ${VIDEO_NARRATION_WPS.minWords5s}–${VIDEO_NARRATION_WPS.maxWords5s} words
• duration 10 → ${VIDEO_NARRATION_WPS.minWords10s}–${VIDEO_NARRATION_WPS.maxWords10s} words
Count words per scene before output. Outside range = REJECTED.
` : ''}
═══ SCENE CONSTRAINTS ═══
Duration: ${duration}s | Scenes: ${plan.minScenes}–${plan.maxScenes ?? plan.targetScenes} (target ${plan.targetScenes}) | Words: ${plan.totalWordsMin}–${plan.totalWordsMax}
${plan.sceneGuidance}
Language: narration in ${languageName} (${languageCode}), imagePrompt ALWAYS in English

═══ TITLE ═══
6–12 words. Descriptive, story-specific. Use EXACT terms from user premise — never rephrase or synonymize.

═══ CINEMATIC NARRATION VOICE — MANDATORY ═══

The skeleton is a CHARACTER living a real experience on screen. Write as if a world-class voice actor is performing every word.

1. AUTHORITATIVE & GROUNDED — narrator KNOWS this world.
2. SENSORY IMMERSION — one sensory anchor per scene.
3. CINEMATIC PRESENT TENSE — always present tense. The viewer is THERE.
4. SHORT PUNCHY SENTENCES — every word earns its place. No filler.
5. CONTRAST & TENSION — juxtaposition makes lines land harder.
6. EMOTIONAL STAKES — the character is LIVING this, not observing it.

BANNED: comedy/jokes/puns/sarcasm | melodrama/"epic" tryhard | YouTuber voice ("so basically", "you won't believe") | AI filler ("in this scenario", "interestingly enough") | exclamation marks in narration

TONE: Christopher Nolan narrator meets prestige documentary. Calm authority. Measured intensity.

═══ RETENTION — HOOKS EVERY SCENE ═══

Every scene must pull the viewer into the next. Use at least ONE per scene:

1. CURIOSITY GAP — reveal WHAT, withhold WHY.
2. OPEN LOOP — start a thread, close it 2–3 scenes later.
3. PATTERN INTERRUPT — break expected rhythm.
4. STAKES ESCALATION — each scene raises consequences. Never plateau.
5. MICRO-CLIFFHANGER — end on an unresolved beat.
6. SENSORY SNAP — one vivid detail that breaks scrolling autopilot.

═══ STORY STYLE — PICK ONE & COMMIT ═══

Read the user premise. Pick the ONE style below that fits best. Follow EVERY bullet point as a STRUCTURAL REQUIREMENT:

1. day_in_life — timestamps, sensory detail each scene
2. imagine_if — state changed variable upfront, ripple effects
3. last_person — silence/isolation atmosphere, psychology evolving
4. wake_up_in — zero-warning drop into new world, arc: Confusion→Discovery→Adaptation
5. what_would_happen — real science only, cause-and-effect chains
6. choose_fate — decision points OPTION A vs B
7. stuck_in — trap feels inescapable early
8. i_survived — urgent present tense despite past events
9. history_changed — anchor to real event/figure, butterfly effect
10. experiment — rules stated upfront, staged
11. secret_world — clues before reveal
12. role_reversal — both roles clear before swap

═══ CHARACTER ═══

${characterDNA}

${consistencyLine}

MAIN CHARACTER: 💀 SKELETON (protagonist in every scene)
SUPPORTING CAST: Normal humans — regular people, villagers, crowds

VISUAL RULES:
- 4-PART image prompt structure: CHARACTER DNA + CONSISTENCY LINE + ACTION + SCENE + CAMERA
- ACTION = THE FOCUS — detailed character action + facing direction
- SCENE = "background:" prefix — setting only
- CAMERA = angle + lighting + character position
- ❌ NEVER describe character appearance in ACTION/SCENE/CAMERA — DNA handles that

${hasCharacterImages ? `═══ REFERENCE IMAGE = "YOU" ═══
The skeleton in the reference image IS YOU. Narration uses "you/your" — first-person.
` : ''}

═══ HOOK FORMAT — ROTATE ═══

Pick one and rotate:
A — "What if" question → then progress with "Day one…"
B — "Day X" cold open → continue day count across scenes
C — "Nobody told you..." opener → then escalate freely
D — Sensory cold open → then escalate freely

═══ CAMERA FRAMING ═══

❌ FORBIDDEN: front-facing portrait shots. Max 1 centered close-up per script.
✅ Vary orientation EVERY scene.

═══ STORY ARC ═══

SCENE 1 — THE HOOK
Establish STAKES immediately + one SENSORY DETAIL + unresolved thread.

MIDDLE — ESCALATION ENGINE
Each scene raises stakes higher — never plateau.

SECOND-TO-LAST — POINT OF NO RETURN
Maximum tension. End on an open beat.

FINAL — THE ECHO
Close all loops. End on one HAUNTING line. Never summarize.

═══ SCENE OUTPUT ═══

Each scene: sceneNumber | duration | narration | imagePrompt | cameraAngle | mood | action

═══ RULES & FAIL CONDITIONS ═══

STRUCTURE:
✔ ${plan.minScenes}–${plan.maxScenes ?? plan.targetScenes} scenes
✔ ${plan.totalWordsMin}–${plan.totalWordsMax} total words
✔ Title uses EXACT user terms | user details preserved
CINEMATIC TONE:
✔ Present tense | sensory detail per scene | retention hook per scene
✔ Short punchy sentences | no exclamation marks | no comedy
`;
    }

    private getLanguageName(code: string): string {
        const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
        try {
            return displayNames.of(code) || code;
        } catch (e) {
            return code;
        }
    }
}
