class GermanTTSService {
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private isInitialized = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.loadVoices();
      };
    }
  }

  private loadVoices(): void {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;

    // Prioritize local/offline German voices first, then any de-DE voice, then any German variant
    const offlineGerman = voices.find(
      (v) => v.lang.toLowerCase().startsWith('de') && v.localService
    );
    const standardGerman = voices.find(
      (v) => v.lang.toLowerCase() === 'de-de' || v.lang.toLowerCase() === 'de_de'
    );
    const anyGerman = voices.find((v) => v.lang.toLowerCase().startsWith('de'));

    this.selectedVoice = offlineGerman || standardGerman || anyGerman || null;
    this.isInitialized = true;
  }

  /**
   * Speaks a German word or sentence aloud offline.
   * @param text The German text to read
   * @param rate Playback speed (0.95 is slightly clearer for technical terms)
   */
  public speakGerman(text: string, rate = 0.95): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('SpeechSynthesis is not supported in this browser.');
      return;
    }

    if (!this.isInitialized) {
      this.loadVoices();
    }

    // Cancel any ongoing speech so rapid taps respond immediately
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = rate;
    utterance.pitch = 1.0;

    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }

    window.speechSynthesis.speak(utterance);
  }

  public stop(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const ttsService = new GermanTTSService();