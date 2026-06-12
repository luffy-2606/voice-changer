/**
 * Decodes an audio Blob and resamples it to 16000 Hz mono Float32Array
 * for consumption by Whisper models.
 */
export async function decodeAudioToFloat32(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("Web Audio API is not supported in this browser.");
  }
  
  const audioContext = new AudioContextClass();
  let audioBuffer: AudioBuffer;
  
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } catch (err) {
    audioContext.close();
    throw new Error("Failed to decode audio file. Make sure it is a valid audio format.");
  } finally {
    audioContext.close();
  }
  
  const targetSampleRate = 16000;
  const numberOfChannels = 1;
  const duration = audioBuffer.duration;
  const length = Math.floor(duration * targetSampleRate);
  
  // OfflineAudioContext for resampling
  const offlineContext = new OfflineAudioContext(
    numberOfChannels,
    length,
    targetSampleRate
  );
  
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start(0);
  
  const renderedBuffer = await offlineContext.startRendering();
  return renderedBuffer.getChannelData(0);
}

/**
 * Decodes an audio Blob into an AudioBuffer at its native sample rate.
 */
export async function decodeAudioToBuffer(blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("Web Audio API is not supported in this browser.");
  }
  
  const audioContext = new AudioContextClass();
  try {
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (err) {
    throw new Error("Failed to decode audio data for DSP post-processing.");
  } finally {
    audioContext.close();
  }
}


/**
 * Applies digital signal processing (DSP) to synthesized speech to make it
 * sound more like Kasane Teto's cute electronic voice.
 * Uses a BiquadFilter (high shelf & peaking) for brightness/formant boost,
 * and pitch-shifting using playbackRate.
 */
export async function applyTetoEffects(
  inputBuffer: AudioBuffer,
  pitchSemitones: number = 3.0, // Shift up by 3 semitones for cute high-pitch
  brightnessGain: number = 5.0  // Boost treble for electronic sparkle (+5dB)
): Promise<AudioBuffer> {
  const sampleRate = inputBuffer.sampleRate;
  const numChannels = inputBuffer.numberOfChannels;
  
  // A semitone pitch ratio: 2^(semitones / 12)
  const pitchRatio = Math.pow(2, pitchSemitones / 12);
  
  // Since we scale the speed up along with the pitch (which matches traditional sampler pitch shifts)
  const targetDuration = inputBuffer.duration / pitchRatio;
  const targetLength = Math.floor(targetDuration * sampleRate);
  
  const offlineCtx = new OfflineAudioContext(numChannels, targetLength, sampleRate);
  
  const source = offlineCtx.createBufferSource();
  source.buffer = inputBuffer;
  source.playbackRate.value = pitchRatio;
  
  // High-shelf filter to boost the treble frequencies (formant/brightness emphasis)
  const highShelf = offlineCtx.createBiquadFilter();
  highShelf.type = "highshelf";
  highShelf.frequency.value = 2200; // Boost frequencies above 2.2 kHz
  highShelf.gain.value = brightnessGain;
  
  // Peaking filter for vocal clarity
  const presenceBoost = offlineCtx.createBiquadFilter();
  presenceBoost.type = "peaking";
  presenceBoost.frequency.value = 1400; // Focus on high mid frequencies
  presenceBoost.Q.value = 2.0;
  presenceBoost.gain.value = 3.0; // +3dB
  
  // Connect the chain
  source.connect(presenceBoost);
  presenceBoost.connect(highShelf);
  highShelf.connect(offlineCtx.destination);
  
  source.start(0);
  return await offlineCtx.startRendering();
}

/**
 * Encodes an AudioBuffer into a WAV formatted Blob.
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // 1 = Uncompressed LPCM
  const bitDepth = 16;
  
  let result: Float32Array;
  if (numOfChan === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }
  
  const bufferLength = result.length * 2;
  const bufferArray = new ArrayBuffer(44 + bufferLength);
  const view = new DataView(bufferArray);
  
  /* RIFF identifier */
  writeString(view, 0, "RIFF");
  /* File length */
  view.setUint32(4, 36 + bufferLength, true);
  /* RIFF type */
  writeString(view, 8, "WAVE");
  /* Format chunk identifier */
  writeString(view, 12, "fmt ");
  /* Format chunk length */
  view.setUint32(16, 16, true);
  /* Sample format (raw PCM) */
  view.setUint16(20, format, true);
  /* Channel count */
  view.setUint16(22, numOfChan, true);
  /* Sample rate */
  view.setUint32(24, sampleRate, true);
  /* Byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true);
  /* Block align (channel count * bytes per sample) */
  view.setUint16(32, numOfChan * (bitDepth / 8), true);
  /* Bits per sample */
  view.setUint16(34, bitDepth, true);
  /* Data chunk identifier */
  writeString(view, 36, "data");
  /* Data chunk length */
  view.setUint32(40, bufferLength, true);
  
  floatTo16BitPCM(view, 44, result);
  
  return new Blob([bufferArray], { type: "audio/wav" });
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function interleave(inputL: Float32Array, inputR: Float32Array): Float32Array {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;
  
  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}
