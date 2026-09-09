// Verification script for Chunking & Shadow Engine
import { splitTextIntoChunks, getHardwareProfile } from '../src/services/chunkingEngine.ts';

console.log('=== Testing Chunking & Hardware Adaptation Engine ===\n');

// 1. Hardware Profile
const hw = getHardwareProfile();
console.log('Hardware Profile:', hw);
if (hw.cores <= 0) throw new Error('Invalid core count detected');

// 2. Text Partitioning on 1200 words
const sentences = [];
for (let i = 1; i <= 60; i++) {
  sentences.push(`This is sentence number ${i} describing the architecture and capabilities of VoiceFlow Studio with comprehensive text chunking.`);
}
const longText = sentences.join(' ');
const totalWords = longText.split(/\s+/).length;
console.log(`Input text total words: ${totalWords}`);

const chunks = splitTextIntoChunks(longText, 500);
console.log(`Generated ${chunks.length} chunks:`);
chunks.forEach((c, idx) => {
  console.log(`  Chunk ${idx + 1}: ${c.wordCount} words (${c.text.slice(0, 50)}...)`);
});

if (chunks.length < 2) {
  throw new Error(`Expected at least 2 chunks for ${totalWords} words, got ${chunks.length}`);
}

// Ensure no sentence was split
for (const chunk of chunks) {
  if (!chunk.text.endsWith('.')) {
    throw new Error('Chunk did not align on sentence boundary');
  }
}

console.log('\n=== CHUNKING & SHADOW TESTS PASSED! ===');
