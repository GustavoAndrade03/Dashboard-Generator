"use client";

/**
 * Histórico de edição (desfazer/refazer).
 *
 * É o que permite a interface não pedir confirmação em nenhuma ação
 * destrutiva: a reversibilidade substitui o modal (CLAUDE.md, 11.7).
 *
 * `commit` grava um novo passo; `replace` troca o estado sem criar passo —
 * usado durante a digitação, para o usuário não precisar de um Ctrl+Z por
 * caractere.
 *
 * Passado, presente e futuro vivem num único `useState` de propósito: assim
 * cada atualização lê o presente pelo argumento do updater, sem ref nem
 * dependência que force a recriação dos callbacks.
 */

import { useCallback, useMemo, useState } from "react";

/** Passos guardados. Suficiente para uma sessão de edição, sem crescer sem limite. */
const MAX_STEPS = 50;

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface History<T> {
  state: T;
  commit: (next: T) => void;
  replace: (next: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (next: T) => void;
}

export function useHistory<T>(initial: T): History<T> {
  const [historico, setHistorico] = useState<HistoryState<T>>({
    past: [],
    present: initial,
    future: [],
  });

  const commit = useCallback((next: T) => {
    setHistorico((atual) => ({
      past: [...atual.past, atual.present].slice(-MAX_STEPS),
      present: next,
      future: [],
    }));
  }, []);

  const replace = useCallback((next: T) => {
    setHistorico((atual) => ({ ...atual, present: next }));
  }, []);

  const undo = useCallback(() => {
    setHistorico((atual) => {
      if (atual.past.length === 0) return atual;
      return {
        past: atual.past.slice(0, -1),
        present: atual.past[atual.past.length - 1],
        future: [atual.present, ...atual.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistorico((atual) => {
      if (atual.future.length === 0) return atual;
      const [proximo, ...resto] = atual.future;
      return {
        past: [...atual.past, atual.present].slice(-MAX_STEPS),
        present: proximo,
        future: resto,
      };
    });
  }, []);

  const reset = useCallback((next: T) => {
    setHistorico({ past: [], present: next, future: [] });
  }, []);

  return useMemo(
    () => ({
      state: historico.present,
      commit,
      replace,
      undo,
      redo,
      canUndo: historico.past.length > 0,
      canRedo: historico.future.length > 0,
      reset,
    }),
    [historico, commit, replace, undo, redo, reset],
  );
}
