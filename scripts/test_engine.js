// Automated verification script for VoiceFlow Studio
import { generateEstimatedCues, exportToSrt } from '../src/services/edgeTtsClient.ts';
import { cleanExtractedText, calculateTextStats, unwrapLines } from '../src/services/pdfExtractor.ts';
import { VOICES_CATALOG, filterVoices, getVoiceById } from '../src/services/voicesCatalog.ts';

console.log('=== Starting VoiceFlow Studio Verification ===\n');

// 1. Voice Catalog & Language Filters
console.log('1. Testing Voice Catalog:');
const englishVoices = filterVoices('English');
console.log(`- English voices count: ${englishVoices.length}`);
const jenny = getVoiceById('en-US-JennyNeural');
console.log(`- Jenny Neural found: ${jenny.name} (${jenny.locale}) - ${jenny.gender}`);
if (!jenny || jenny.name !== 'Jenny') throw new Error('Jenny Neural not found');

const femaleVoices = filterVoices('English', 'Female');
console.log(`- English Female voices count: ${femaleVoices.length}`);

// 2. Text Normalization & Preprocessing
console.log('\n2. Testing Text Preprocessing:');
const rawBrokenText = "This is a test of organ-\n ization and multi-line \n\n breaks.";
const cleaned = cleanExtractedText(rawBrokenText);
console.log(`- Cleaned text: "${cleaned}"`);
if (cleaned.includes('organ- \n ization') || cleaned.includes('organ-')) {
  throw new Error('Hyphenated line break was not merged correctly');
}

const stats = calculateTextStats("One two three four five six seven eight nine ten.");
console.log(`- Text stats (10 words):`, stats);
if (stats.wordCount !== 10) throw new Error('Word count failed');

// 3. Timed Cues & Karaoke Sync Logic
console.log('\n3. Testing Karaoke Cues & SRT Generation:');
const sampleScript = "Executive summary of 2026. VoiceFlow enables real-time karaoke tracking. Click any sentence to jump audio.";
const cues = generateEstimatedCues(sampleScript);
console.log(`- Generated ${cues.length} cues:`);
cues.forEach(c => console.log(`  [${c.start}s - ${c.end}s] ${c.text}`));

if (cues.length !== 3) throw new Error('Expected 3 sentence cues');
if (cues[0].start >= cues[0].end) throw new Error('Invalid cue start/end bounds');

const srt = exportToSrt(cues);
console.log('- SRT export preview:\n' + srt);

console.log('\n=== ALL ENGINE VERIFICATIONS PASSED! ===');
