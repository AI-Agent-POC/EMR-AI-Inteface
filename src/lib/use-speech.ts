"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Dictation through the browser's own speech recognition. No audio leaves the page via
 * our servers; Chrome, Edge and Safari provide the engine. Where it is missing the hook
 * reports `supported: false` and the microphone button simply does not render.
 */
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
};
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noSubscribe = () => () => {};

export function useSpeech(onText: (text: string, final: boolean) => void) {
  // false on the server and during hydration, true on a client that has the engine —
  // no state, no effect, no hydration mismatch.
  const supported = useSyncExternalStore(noSubscribe, () => ctor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onText);
  useEffect(() => { cb.current = onText; }, [onText]);

  const stop = useCallback(() => { rec.current?.stop(); }, []);

  const start = useCallback(() => {
    const C = ctor(); if (!C) return;
    const r = new C();
    r.lang = navigator.language?.startsWith("ar") ? "ar-AE" : "en-AE";
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const t = res[0]?.transcript ?? "";
        if (res.isFinal) finalText += t; else interim += t;
      }
      cb.current((finalText + interim).trim(), false);
    };
    r.onerror = (e) => {
      setError(e.error === "not-allowed" ? "Microphone access was blocked." : e.error);
      setListening(false);
    };
    r.onend = () => {
      setListening(false);
      if (finalText.trim()) cb.current(finalText.trim(), true);
      rec.current = null;
    };
    rec.current = r;
    setError(null);
    setListening(true);
    r.start();
  }, []);

  useEffect(() => () => rec.current?.abort(), []);

  return { supported, listening, error, start, stop };
}
