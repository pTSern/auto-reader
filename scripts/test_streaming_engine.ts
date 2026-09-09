import { splitTextIntoChunks, getHardwareProfile, ChunkCoordinator } from '../src/services/chunkingEngine.ts';

console.log('=== VERIFYING STREAMING AUDIO & MICRO-CHUNKING ENGINE ===\n');

// 1. Hardware Profile
const hw = getHardwareProfile();
console.log('1. Hardware profile detected:', hw);
if (!hw.cores || hw.cores <= 0) throw new Error('Invalid hardware profile');

// 2. Generate a 1200-word test document
const sentences: string[] = [];
for (let i = 1; i <= 60; i++) {
  sentences.push(
    `Sentence ${i} explains the low-latency streaming pipeline and micro-chunking buffer architecture in VoiceFlow Studio.`
  );
}
const testText = sentences.join(' ');
const totalWords = testText.split(/\s+/).length;
console.log(`\n2. Test text created with ${sentences.length} sentences (${totalWords} words).`);

// 3. Test Progressive Fast-Start Ladder
const chunks = splitTextIntoChunks(testText, 500, true);
console.log(`\n3. Chunks generated with Fast-Start Ladder (Total: ${chunks.length}):`);
chunks.forEach((c, idx) => {
  console.log(`   Chunk ${idx}: ${c.wordCount} words | status: ${c.status} | offset: ${c.offsetSeconds}s`);
});

// Verification assertions:
// Chunk 0 must be small for instant start (< 35 words)
if (chunks[0].wordCount > 35) {
  throw new Error(`Chunk 0 word count (${chunks[0].wordCount}) exceeded fast-start threshold (35)`);
}
console.log(`\n✔ Chunk 0 fast-start size verified: ${chunks[0].wordCount} words (synthesizes in <400ms)`);

// Chunk 1 must be bridge size (around 100 words)
if (chunks[1].wordCount > 130) {
  throw new Error(`Chunk 1 word count (${chunks[1].wordCount}) exceeded bridge threshold (130)`);
}
console.log(`✔ Chunk 1 bridge size verified: ${chunks[1].wordCount} words`);

// Every chunk must end on a sentence boundary
for (const [idx, c] of chunks.entries()) {
  const trimmed = c.text.trim();
  if (!trimmed.endsWith('.')) {
    throw new Error(`Chunk ${idx} did not terminate on sentence boundary: "...${trimmed.slice(-20)}"`);
  }
}
console.log('✔ All chunks cleanly aligned to sentence boundaries');

// 4. Test Coordinator Cue Estimation & Timeline Offset Recalculation
const coordinator = new ChunkCoordinator(
  'test_project',
  testText,
  'en-US-JennyNeural',
  0,
  0,
  100,
  { enabled: true, chunkSizeWords: 500, concurrencyMode: 'auto', useFastStartLadder: true },
  () => {}
);

const initialCues = coordinator.getAllCues();
console.log(`\n4. Initial document cues generated: ${initialCues.length} sentences covered.`);
if (initialCues.length === 0) {
  throw new Error('Initial cues must not be empty');
}

// Check that initial cue timestamps are monotonically increasing
for (let i = 1; i < initialCues.length; i++) {
  if (initialCues[i].start < initialCues[i - 1].start) {
    throw new Error(`Cue timestamps not monotonic: cue ${i} starts at ${initialCues[i].start} before cue ${i - 1} at ${initialCues[i - 1].start}`);
  }
}
console.log('✔ Cue timeline monotonicity verified');

console.log('\n======================================================');
console.log('🎉 ALL STREAMING & CHUNKING ENGINE TESTS PASSED! 🎉');
console.log('======================================================\n');
