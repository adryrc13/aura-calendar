import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';

type SpeechRecognitionSource = 'native-android' | 'web';

export type SpeechRecognitionErrorCode =
  | 'unsupported'
  | 'permission-denied'
  | 'no-transcript'
  | 'start-failed';

export interface StartListeningOptions {
  language: string;
}

export interface SpeechRecognitionResult {
  transcript: string;
  source: SpeechRecognitionSource;
}

export class SpeechRecognitionServiceError extends Error {
  constructor(
    public readonly code: SpeechRecognitionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SpeechRecognitionServiceError';
  }
}

let activeWebRecognition: SpeechRecognition | null = null;

export async function isSpeechRecognitionAvailable() {
  if (isNativeAndroid()) {
    try {
      const { available } = await SpeechRecognition.available();
      return available;
    } catch {
      return false;
    }
  }

  return Boolean(getWebSpeechRecognitionConstructor());
}

export async function requestSpeechPermission() {
  if (isNativeAndroid()) {
    try {
      const currentStatus = await SpeechRecognition.checkPermissions();
      if (currentStatus.speechRecognition === 'granted') {
        return true;
      }

      const requestedStatus = await SpeechRecognition.requestPermissions();
      return requestedStatus.speechRecognition === 'granted';
    } catch {
      return false;
    }
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return true;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}

export async function startListening({ language }: StartListeningOptions): Promise<SpeechRecognitionResult> {
  const available = await isSpeechRecognitionAvailable();
  if (!available) {
    throw new SpeechRecognitionServiceError('unsupported', 'Speech recognition is not available.');
  }

  const hasPermission = await requestSpeechPermission();
  if (!hasPermission) {
    throw new SpeechRecognitionServiceError('permission-denied', 'Microphone permission was denied.');
  }

  return isNativeAndroid() ? startNativeAndroidListening(language) : startWebListening(language);
}

export async function stopListening() {
  if (isNativeAndroid()) {
    await SpeechRecognition.stop();
    return;
  }

  activeWebRecognition?.stop();
  activeWebRecognition = null;
}

function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

async function startNativeAndroidListening(language: string): Promise<SpeechRecognitionResult> {
  try {
    const result = await SpeechRecognition.start({
      language,
      maxResults: 1,
      partialResults: false,
      popup: false,
    });
    const transcript = firstTranscript(result.matches);

    if (!transcript) {
      throw new SpeechRecognitionServiceError('no-transcript', 'Speech recognition returned no text.');
    }

    return { transcript, source: 'native-android' };
  } catch (error) {
    if (error instanceof SpeechRecognitionServiceError) {
      throw error;
    }

    throw new SpeechRecognitionServiceError('start-failed', error instanceof Error ? error.message : 'Speech recognition failed.');
  }
}

function startWebListening(language: string): Promise<SpeechRecognitionResult> {
  const SpeechRecognitionConstructor = getWebSpeechRecognitionConstructor();
  if (!SpeechRecognitionConstructor) {
    throw new SpeechRecognitionServiceError('unsupported', 'Web Speech API is not available.');
  }

  return new Promise((resolve, reject) => {
    const recognition = new SpeechRecognitionConstructor();
    let settled = false;
    let hasResult = false;

    activeWebRecognition = recognition;
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      hasResult = true;
      const transcript = firstTranscript(
        Array.from(event.results).map((result) => result[0]?.transcript),
      );

      if (!transcript) {
        rejectOnce(new SpeechRecognitionServiceError('no-transcript', 'Web Speech API returned no text.'));
        return;
      }

      resolveOnce({ transcript, source: 'web' });
    };

    recognition.onerror = (event) => {
      const code = event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'permission-denied' : 'start-failed';
      rejectOnce(new SpeechRecognitionServiceError(code, event.error));
    };

    recognition.onend = () => {
      activeWebRecognition = null;
      if (!hasResult) {
        rejectOnce(new SpeechRecognitionServiceError('no-transcript', 'Speech recognition ended without text.'));
      }
    };

    try {
      recognition.start();
    } catch (error) {
      rejectOnce(new SpeechRecognitionServiceError('start-failed', error instanceof Error ? error.message : 'Speech recognition failed.'));
    }

    function resolveOnce(result: SpeechRecognitionResult) {
      if (settled) return;
      settled = true;
      activeWebRecognition = null;
      resolve(result);
    }

    function rejectOnce(error: SpeechRecognitionServiceError) {
      if (settled) return;
      settled = true;
      activeWebRecognition = null;
      reject(error);
    }
  });
}

function getWebSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

function firstTranscript(matches: Array<string | undefined> | undefined) {
  const normalizedMatches = matches?.map((match) => match?.trim()).filter(Boolean) ?? [];
  return Array.from(new Set(normalizedMatches))[0] ?? '';
}
