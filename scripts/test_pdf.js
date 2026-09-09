import fs from 'fs';
import { extractTextFromPdf } from '../src/services/pdfExtractor.ts';

async function testPdf() {
  const pdfPath = 'C:/Users/Wild Boar PC/.gemini/antigravity-cli/brain/d0a49bf2-ef96-467c-9840-7efde155cd56/scratch/test.pdf';
  if (!fs.existsSync(pdfPath)) {
    console.log('Test PDF not found at path, skipping PDF test');
    return;
  }

  const buffer = fs.readFileSync(pdfPath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  console.log('Testing PDF extraction on sample PDF...');
  const res = await extractTextFromPdf(arrayBuffer);
  console.log('Extraction Result:');
  console.log('- Page count:', res.pageCount);
  console.log('- Extracted text:\n', res.text);

  if (!res.text.includes('Hello from PyMuPDF') && !res.text.includes('PDF Reader Test Document')) {
    throw new Error('PDF text extraction did not match expected content');
  }

  console.log('=== PDF EXTRACTION VERIFIED SUCCESSFULLY! ===');
}

testPdf().catch(console.error);
