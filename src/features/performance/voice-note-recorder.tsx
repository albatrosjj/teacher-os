"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Class } from "@/features/classes/types";

import { createVoiceNote } from "./actions";
import { parseVoiceNote } from "./voice";

// Minimal typings for the Web Speech API (not part of lib.dom).
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

const CLASS_STORAGE_KEY = "teacheros.voice.classId";

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "tr-TR";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

type Status =
  | { kind: "idle" }
  | { kind: "listening" }
  | { kind: "saving" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function VoiceNoteRecorder({ classes }: { classes: Class[] }) {
  const [supported, setSupported] = useState(true);
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [transcript, setTranscript] = useState("");
  const [, startTransition] = useTransition();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef("");
  const erroredRef = useRef(false);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    const stored = window.localStorage.getItem(CLASS_STORAGE_KEY);
    if (stored && classes.some((cls) => cls.id === stored)) {
      setClassId(stored);
    } else if (classes.length === 1) {
      setClassId(classes[0].id);
    }
    return () => recognitionRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectClass(id: string) {
    setClassId(id);
    window.localStorage.setItem(CLASS_STORAGE_KEY, id);
  }

  function save(spoken: string, selectedClassId: string) {
    const parsed = parseVoiceNote(spoken);
    if (!parsed) {
      const message =
        "Couldn't hear a student number. Say the number first, then the note.";
      setStatus({ kind: "error", message });
      speak("Numara anlaşılamadı, tekrar deneyin.");
      return;
    }

    setStatus({ kind: "saving" });
    startTransition(async () => {
      const result = await createVoiceNote({
        classId: selectedClassId,
        studentNumber: parsed.studentNumber,
        note: parsed.note,
      });
      if (result.status === "success") {
        setStatus({ kind: "success", message: result.message ?? "Saved." });
        speak("Kaydedildi.");
      } else {
        setStatus({ kind: "error", message: result.message ?? "Failed." });
        speak(
          result.message?.startsWith("No student")
            ? "Öğrenci bulunamadı."
            : "Kaydedilemedi.",
        );
      }
    });
  }

  function startListening() {
    const Ctor = getRecognitionCtor();
    if (!Ctor || !classId) return;

    const recognition = new Ctor();
    recognition.lang = "tr-TR";
    recognition.interimResults = true;
    // Android Chrome re-emits every final result on each event when
    // continuous is on, duplicating the transcript — disable it there.
    recognition.continuous = !/Android/i.test(navigator.userAgent);

    finalTranscriptRef.current = "";
    erroredRef.current = false;
    setTranscript("");
    setStatus({ kind: "listening" });

    recognition.onresult = (event) => {
      // Collect final segments, skipping repeats — some mobile browsers
      // deliver the same final result several times.
      const finals: string[] = [];
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;
        if (result.isFinal) {
          if (finals[finals.length - 1] !== text) finals.push(text);
        } else {
          interim += ` ${text}`;
        }
      }
      finalTranscriptRef.current = finals.join(" ");
      setTranscript(`${finals.join(" ")} ${interim}`.trim());
    };
    recognition.onerror = (event) => {
      recognitionRef.current = null;
      erroredRef.current = true;
      setStatus({
        kind: "error",
        message:
          event.error === "not-allowed"
            ? "Microphone access was denied. Allow it in the browser settings."
            : "Speech recognition failed. Please try again.",
      });
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      // onerror has already reported the failure — don't try to save.
      if (erroredRef.current) return;
      const spoken = finalTranscriptRef.current;
      if (spoken) save(spoken, classId);
      else setStatus({ kind: "idle" });
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
  }

  if (!supported) {
    return (
      <p className="text-muted-foreground py-16 text-center">
        This browser doesn&apos;t support speech recognition. Please use Chrome,
        Edge, or Safari.
      </p>
    );
  }

  const listening = status.kind === "listening";

  return (
    <div className="grid gap-6">
      <div className="grid max-w-sm gap-2">
        <Label htmlFor="voice-class">Class</Label>
        <Select value={classId} onValueChange={selectClass}>
          <SelectTrigger id="voice-class" className="w-full">
            <SelectValue placeholder="Select a class" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((cls) => (
              <SelectItem key={cls.id} value={cls.id}>
                {cls.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col items-center gap-4 py-6">
        <button
          type="button"
          onClick={listening ? stopListening : startListening}
          disabled={!classId || status.kind === "saving"}
          aria-label={listening ? "Stop and save" : "Start voice note"}
          className={`flex h-28 w-28 items-center justify-center rounded-full text-white shadow-lg transition-all focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-40 ${
            listening
              ? "animate-pulse bg-red-600 hover:bg-red-700"
              : "bg-primary hover:opacity-90"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-12 w-12"
            aria-hidden
          >
            <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
            <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V20H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-2.07A7 7 0 0 0 19 11Z" />
          </svg>
        </button>
        <p className="text-muted-foreground text-sm">
          {status.kind === "saving"
            ? "Saving…"
            : listening
              ? "Listening — tap to stop and save"
              : classId
                ? "Tap and say the student number, then the note"
                : "Select a class to start"}
        </p>
      </div>

      {transcript && (
        <p className="bg-muted rounded-md px-4 py-3 text-center text-sm">
          &ldquo;{transcript}&rdquo;
        </p>
      )}

      {status.kind === "success" && (
        <p
          role="status"
          className="rounded-md bg-green-100 px-4 py-3 text-center text-sm font-medium text-green-800 dark:bg-green-950 dark:text-green-200"
        >
          ✓ {status.message}
        </p>
      )}
      {status.kind === "error" && (
        <p
          role="alert"
          className="text-destructive text-center text-sm font-medium"
        >
          {status.message}
        </p>
      )}
    </div>
  );
}
