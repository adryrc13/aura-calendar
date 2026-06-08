type VoiceStatus = 'idle' | 'listening' | 'unsupported' | 'error';

interface UseVoiceRecognitionParams {
  onTranscript: (transcript: string) => void;
}

export function useVoiceRecognition({ onTranscript }: UseVoiceRecognitionParams) {
  async function startListening(onStatus?: (message: string, status: VoiceStatus) => void) {
    const SpeechRecognitionConstructor = window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      onStatus?.('Web Speech API no está disponible. Usá la entrada por texto.', 'unsupported');
      return;
    }

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }

      const recognition = new SpeechRecognitionConstructor();
      let hasResult = false;
      recognition.lang = 'es-ES';
      recognition.interimResults = false;
      recognition.continuous = false;
      onStatus?.('Escuchando… hablá claro y corto.', 'listening');

      recognition.onresult = (event) => {
        hasResult = true;
        const transcript = Array.from(event.results)
          .map((result) => result[0]?.transcript)
          .filter(Boolean)
          .join(' ');

        onStatus?.(transcript ? `Detecté: “${transcript}”` : 'No detecté texto. Probá otra vez.', 'idle');

        if (transcript) {
          onTranscript(transcript);
        }
      };

      recognition.onerror = (event) => {
        onStatus?.(`No pude escuchar bien: ${event.error}. Podés escribir la orden.`, 'error');
      };

      recognition.onend = () => {
        if (!hasResult) {
          onStatus?.('Escucha finalizada.', 'idle');
        }
      };

      recognition.start();
    } catch (error) {
      onStatus?.('No se pudo acceder al micrófono. Revisá permisos o usá la entrada por texto.', 'error');
    }
  }

  return { startListening };
}
