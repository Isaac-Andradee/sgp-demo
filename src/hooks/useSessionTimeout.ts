import { useState, useEffect, useCallback, useRef } from "react";

interface SessionTimeoutOptions {
  /** Minutos de inatividade antes de exibir o aviso (padrão: 13) */
  warningAfterMinutes?: number;
  /** Minutos de inatividade antes do logout automático (padrão: 15) */
  logoutAfterMinutes?: number;
  /** Callback chamado quando o tempo esgota */
  onLogout: () => void;
  /** Pausar o timer (ex: quando o usuário não está autenticado) */
  active: boolean;
}

interface SessionTimeoutState {
  /** Exibir o modal de aviso */
  showWarning: boolean;
  /** Segundos restantes antes do logout automático */
  secondsLeft: number;
  /** Reiniciar o timer (chamado pelo botão "Continuar conectado") */
  resetTimer: () => void;
}

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

export function useSessionTimeout({
  warningAfterMinutes = 13,
  logoutAfterMinutes = 15,
  onLogout,
  active,
}: SessionTimeoutOptions): SessionTimeoutState {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Inicializado em 0 e preenchido no primeiro efeito — chamar Date.now() durante
  // a renderização viola a regra de pureza do React Compiler.
  const lastActivityRef = useRef<number>(0);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const startCountdown = useCallback((seconds: number) => {
    setSecondsLeft(seconds);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
  }, []);

  const scheduleTimers = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);

    const warningDelay = warningAfterMinutes * 60 * 1000;
    const logoutDelay = logoutAfterMinutes * 60 * 1000;
    const warningDuration = logoutDelay - warningDelay;

    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      startCountdown(Math.floor(warningDuration / 1000));
    }, warningDelay);

    logoutTimerRef.current = setTimeout(() => {
      clearAllTimers();
      setShowWarning(false);
      onLogout();
    }, logoutDelay);
  }, [warningAfterMinutes, logoutAfterMinutes, onLogout, clearAllTimers, startCountdown]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (active) scheduleTimers();
  }, [active, scheduleTimers]);

  // Inicializa e limpa quando ativa/desativa
  useEffect(() => {
    if (!active) {
      clearAllTimers();
      setShowWarning(false);
      return;
    }
    lastActivityRef.current = Date.now();
    scheduleTimers();
    return clearAllTimers;
  }, [active, scheduleTimers, clearAllTimers]);

  // Ouve eventos de atividade do usuário para resetar o timer
  useEffect(() => {
    if (!active) return;

    const handleActivity = () => {
      // Só reseta se não estiver no período de aviso
      if (!showWarning) {
        lastActivityRef.current = Date.now();
        scheduleTimers();
      }
    };

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, handleActivity, { passive: true })
    );
    return () =>
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, handleActivity)
      );
  }, [active, showWarning, scheduleTimers]);

  return { showWarning, secondsLeft, resetTimer };
}
