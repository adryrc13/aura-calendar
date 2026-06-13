import { speechLanguageFor, useI18n } from '../../shared/i18n';

type VoiceStatus = 'idle' | 'listening' | 'unsupported' | 'error';

interface UseVoiceRecognitionParams {
  onTranscript: (transcript: string) => void;
}

export function useVoiceRecognition({ onTranscript }: UseVoiceRecognitionParams) {
  const { language, t } = useI18n();

  async function startListening(onStatus?: (message: string, status: VoiceStatus) => void) {
    const SpeechRecognitionConstructor = window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      onStatus?.(t('assistant.unsupported'), 'unsupported');
      return;
    }

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }

      const recognition = new SpeechRecognitionConstructor();
      let hasResult = false;
      recognition.lang = speechLanguageFor(language);
      recognition.interimResults = false;
      recognition.continuous = false;
      onStatus?.(t('assistant.listeningStatus'), 'listening');

      recognition.onresult = (event) => {
        hasResult = true;
        const transcript = Array.from(event.results)
          .map((result) => result[0]?.transcript)
          .filter(Boolean)
          .join(' ');

        onStatus?.(transcript ? t('assistant.detectedTranscript', { transcript }) : t('assistant.noTranscript'), 'idle');

        if (transcript) {
          onTranscript(transcript);
        }
      };

      recognition.onerror = (event) => {
        onStatus?.(t('assistant.listenError', { error: event.error }), 'error');
      };

      recognition.onend = () => {
        if (!hasResult) {
          onStatus?.(t('assistant.listenEnd'), 'idle');
        }
      };

      recognition.start();
    } catch {
      onStatus?.(t('assistant.microphoneError'), 'error');
    }
  }

  return { startListening };
}
