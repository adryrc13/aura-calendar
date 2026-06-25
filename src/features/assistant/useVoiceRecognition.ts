import { speechLanguageFor, useI18n } from '../../shared/i18n';
import {
  SpeechRecognitionServiceError,
  startListening as startSpeechRecognition,
} from './speechRecognitionService';

type VoiceStatus = 'idle' | 'listening' | 'unsupported' | 'error';

interface UseVoiceRecognitionParams {
  onTranscript: (transcript: string) => void;
}

export function useVoiceRecognition({ onTranscript }: UseVoiceRecognitionParams) {
  const { language, t } = useI18n();

  async function startListening(onStatus?: (message: string, status: VoiceStatus) => void) {
    try {
      onStatus?.(t('assistant.listeningStatus'), 'listening');
      const result = await startSpeechRecognition({ language: speechLanguageFor(language) });
      const transcript = result.transcript.trim();

      if (!transcript) {
        onStatus?.(t('assistant.noTranscript'), 'idle');
        return;
      }

      onStatus?.(t('assistant.detectedTranscript', { transcript }), 'idle');
      onTranscript(transcript);
    } catch (error) {
      if (error instanceof SpeechRecognitionServiceError) {
        if (error.code === 'unsupported') {
          onStatus?.(t('assistant.unsupported'), 'unsupported');
          return;
        }

        if (error.code === 'permission-denied') {
          onStatus?.(t('assistant.microphonePermissionDenied'), 'error');
          return;
        }

        if (error.code === 'no-transcript') {
          onStatus?.(t('assistant.noTranscript'), 'idle');
          return;
        }

        onStatus?.(t('assistant.listenError', { error: error.message }), 'error');
        return;
      }

      onStatus?.(t('assistant.microphoneError'), 'error');
    }
  }

  return { startListening };
}
