import { TimedCue } from '../types';
import { DesktopBridge } from './desktopBridge';
import { Logger } from './logger';

const EDGE_TTS_TOKEN = '6A5AA1D4EA654972839958742E8E7D8B';
const EDGE_TTS_WSS = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaheadworkaround/edge/v1?TrustedClientToken=${EDGE_TTS_TOKEN}`;

export interface SynthesisResult {
  audioBlob: Blob;
  audioUrl: string;
  cues: TimedCue[];
}

function generateUuid(): string {
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatSsml(text: string, voice: string, rate: number = 0, pitch: number = 0, volume: number = 100): string {
  const rateStr = rate >= 0 ? `+${rate}%` : `${rate}%`;
  const pitchStr = pitch >= 0 ? `+${pitch}Hz` : `${pitch}Hz`;
  const volStr = volume >= 0 ? `+${volume - 100}%` : `${volume - 100}%`;

  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
  <voice name='${voice}'>
    <prosody rate='${rateStr}' pitch='${pitchStr}' volume='${volStr}'>
      ${escapedText}
    </prosody>
  </voice>
</speak>`;
}

export async function synthesizeSpeech(
  text: string,
  voice: string = 'en-US-JennyNeural',
  rate: number = 0,
  pitch: number = 0,
  volume: number = 100,
  onProgress?: (msg: string) => void
): Promise<SynthesisResult> {
  if (!text || text.trim() === '') {
    throw new Error('Please provide text to convert to speech.');
  }

  // 1. Primary Engine: Official native Python Edge-TTS in desktop app
  if (DesktopBridge.isDesktop()) {
    onProgress?.('Synthesizing neural speech via native Edge-TTS engine...');
    Logger.info(`Synthesizing speech via native Edge-TTS with voice '${voice}'`);

    const result = await DesktopBridge.synthesizeSpeech(text, voice, rate, pitch, volume);
    if (result && result.success && result.audioBlob && result.audioUrl) {
      const finalCues = (result.cues && result.cues.length > 0)
        ? result.cues
        : generateEstimatedCues(text);

      return {
        audioBlob: result.audioBlob,
        audioUrl: result.audioUrl,
        cues: finalCues,
      };
    } else if (result && !result.success) {
      Logger.error(`Desktop Edge-TTS synthesis failed: ${result.error}`);
      throw new Error(`Edge-TTS synthesis error: ${result.error}`);
    }
  }

  // 2. Secondary Engine: Direct WebSocket streaming (browser mode)
  onProgress?.('Connecting to Edge-TTS neural endpoint...');

  return new Promise<SynthesisResult>((resolve, reject) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(EDGE_TTS_WSS);
      ws.binaryType = 'arraybuffer';
    } catch (err: any) {
      reject(new Error(`WebSocket connection failed: ${err?.message || err}`));
      return;
    }

    const audioChunks: Uint8Array[] = [];
    const cues: TimedCue[] = [];
    let cueIndex = 0;
    const requestId = generateUuid();
    const timestamp = new Date().toISOString();


    const timeout = setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
        if (audioChunks.length > 0) {
          finishSynthesis();
        } else {
          reject(new Error('Edge-TTS neural synthesis timed out.'));
        }
      }
    }, 25000);

    function finishSynthesis() {
      clearTimeout(timeout);
      const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of audioChunks) {
        combined.set(chunk, offset);
        offset += chunk.byteLength;
      }

      const audioBlob = new Blob([combined], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // If no sentence boundary events were returned, calculate estimated sentence cues
      const finalCues = cues.length > 0 ? cues : generateEstimatedCues(text);

      resolve({
        audioBlob,
        audioUrl,
        cues: finalCues,
      });
    }

    ws.onopen = () => {
      onProgress?.('Synthesizing speech & calculating sentence boundaries...');

      // 1. Speech config
      const speechConfig = JSON.stringify({
        context: {
          synthesis: {
            audio: {
              metadataoptions: {
                sentenceBoundaryEnabled: 'true',
                wordBoundaryEnabled: 'true',
              },
              outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
            },
          },
        },
      });

      const configMsg = `X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${speechConfig}`;
      ws.send(configMsg);

      // 2. SSML request
      const ssml = formatSsml(text, voice, rate, pitch, volume);
      const ssmlMsg = `X-RequestId:${requestId}\r\nX-Timestamp:${timestamp}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`;
      ws.send(ssmlMsg);
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const textData = event.data;
        if (textData.includes('Path:audio.metadata')) {
          const bodyIndex = textData.indexOf('\r\n\r\n');
          if (bodyIndex !== -1) {
            try {
              const json = JSON.parse(textData.substring(bodyIndex + 4));
              for (const meta of json.Metadata || []) {
                if (meta.Type === 'SentenceBoundary') {
                  const offsetSec = meta.Data.Offset / 10000000;
                  const durationSec = meta.Data.Duration / 10000000;
                  cues.push({
                    id: cueIndex++,
                    start: offsetSec,
                    end: offsetSec + durationSec,
                    text: meta.Data.text.Text,
                  });
                }
              }
            } catch (e) {
              // Ignore metadata parse warning
            }
          }
        } else if (textData.includes('Path:turn.end')) {
          ws.close();
          finishSynthesis();
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Binary message: first 2 bytes are header length
        const view = new DataView(event.data);
        const headerLen = view.getInt16(0);
        const audioBuffer = event.data.slice(2 + headerLen);
        if (audioBuffer.byteLength > 0) {
          audioChunks.push(new Uint8Array(audioBuffer));
        }
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      if (audioChunks.length > 0) {
        finishSynthesis();
      } else {
        reject(new Error('WebSocket connection error with Edge-TTS endpoint.'));
      }
    };

    ws.onclose = () => {
      if (audioChunks.length > 0) {
        finishSynthesis();
      }
    };
  });
}


/**
 * Splits text into sentences and assigns smooth proportional timestamps
 */
export function generateEstimatedCues(text: string): TimedCue[] {
  // Regex to split on sentence boundaries
  const rawSentences = text
    .split(/(?<=[.?!…\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (rawSentences.length === 0) {
    return [{ id: 0, start: 0, end: 3, text }];
  }

  const cues: TimedCue[] = [];
  let currentStart = 0.2;

  for (let i = 0; i < rawSentences.length; i++) {
    const s = rawSentences[i];
    const wordCount = s.split(/\s+/).length;
    // Average speech rate: ~2.6 words per second
    const duration = Math.max(1.8, (wordCount / 2.6) + 0.4);
    cues.push({
      id: i,
      start: parseFloat(currentStart.toFixed(2)),
      end: parseFloat((currentStart + duration).toFixed(2)),
      text: s,
    });
    currentStart += duration + 0.15;
  }

  return cues;
}

/**
 * Creates audio fallback using client Web Audio synthesis if offline


/**
 * Generates .SRT subtitle string from cues
 */
export function exportToSrt(cues: TimedCue[]): string {
  function formatTime(seconds: number): string {
    const date = new Date(seconds * 1000);
    const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss},${ms}`;
  }

  return cues
    .map((cue, idx) => {
      return `${idx + 1}\n${formatTime(cue.start)} --> ${formatTime(cue.end)}\n${cue.text}\n`;
    })
    .join('\n');
}
