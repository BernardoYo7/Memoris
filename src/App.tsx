/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, ReactNode, ChangeEvent } from 'react';
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { Capacitor } from '@capacitor/core';
import { 
  PlusCircle, 
  RotateCcw, 
  List, 
  Target, 
  Settings, 
  Flame, 
  CheckCircle2, 
  Trash2, 
  Search,
  BrainCircuit,
  Clock,
  BarChart3,
  ArrowLeft,
  Info,
  Scan,
  X,
  Sparkles,
  Zap,
  Share2,
  Check,
  Copy,
  ChevronRight,
  LayoutGrid,
  Key,
  FileText,
  Upload,
  Lightbulb,
  BookOpen
} from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';

// Set worker for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import Markdown from 'react-markdown';

// --- Types ---
type TabType = 'B' | 'L' | 'D';
type Platform = 'ios' | 'android' | 'web';

interface StudyError {
  id: number;
  materia: string;
  prova?: string;
  questao: string;
  descricao?: string;
  gabarito?: string;
  tab: TabType;
  data: string;
  ts: number;
  resolved: boolean;
  revisoes: number[];
}

interface StreakData {
  streak: number;
  lastDate: string;
}

interface PracticeHistory {
  id: number;
  tema: string;
  materia: string;
  enunciado: string;
  acertou: boolean;
  ts: number;
}

// --- Constants ---
const STORE_KEY = 'tab_erros_v3';
const STREAK_KEY = 'tab_streak_v3';
const META_KEY = 'tab_meta_v3';
const PRATICA_KEY = 'tab_pratica_v3';

const SUBJECTS = [
  { 
    name: 'Linguagens', 
    subs: ['Português', 'Literatura', 'Interpretação', 'Artes', 'Educação Física'],
    color: 'blue-500'
  },
  { 
    name: 'Matemática', 
    subs: ['Álgebra', 'Geometria', 'Estatística', 'Probabilidade', 'Financeira'],
    color: 'amber-500'
  },
  { 
    name: 'Natureza', 
    subs: ['Biologia', 'Física', 'Química', 'Ecologia', 'Genética'],
    color: 'green-500'
  },
  { 
    name: 'Humanas', 
    subs: ['História', 'Geografia', 'Filosofia', 'Sociologia', 'Atualidades'],
    color: 'red-500'
  }
];

const REVIEW_INTERVALS: Record<TabType, number[]> = {
  B: [1],
  L: [1, 3],
  D: [1, 3, 7]
};

// --- AI Service ---
function getAI() {
  const savedKey = localStorage.getItem('gemini_api_key');
  const viteEnvKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
  
  // No AI Studio environment, we use either the saved key or the VITE_ env var
  const apiKey = savedKey || viteEnvKey || "";
  return new GoogleGenAI({ apiKey });
}

async function generateQuestion(tema: string, nivel: string = "Médio") {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Gere uma questão estilo ENEM sobre: "${tema}". Dificuldade: ${nivel}.
    Instruções:
    1. Enunciado contextualizado, denso e fiel ao estilo ENEM (Matriz de Referência).
    2. 5 alternativas (A-E).
    3. Explicações analíticas para CADA alternativa, detalhando o erro lógico ou a pegadinha.
    4. Seção "Conceito Base": Explicação teórica profunda e estruturada.
    5. Seção "Como não errar": Estratégias de resolução e padrões de distratores.
    6. Seção "O que o ENEM cobra": Competências e Habilidades relacionadas (ex: H12, C4).
    7. Retorne apenas JSON:
    {
      "materia": "string",
      "enunciado": "string",
      "alternativas": ["string", "string", "string", "string", "string"],
      "gabarito": number (0-4),
      "explicacoes": { "A": "string", "B": "string", "C": "string", "D": "string", "E": "string" },
      "conceito": "string",
      "comoNaoErrar": "string",
      "oQueCobra": "string"
    }`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          materia: { type: Type.STRING },
          enunciado: { type: Type.STRING },
          alternativas: { type: Type.ARRAY, items: { type: Type.STRING } },
          gabarito: { type: Type.INTEGER },
          explicacoes: {
            type: Type.OBJECT,
            properties: {
              A: { type: Type.STRING },
              B: { type: Type.STRING },
              C: { type: Type.STRING },
              D: { type: Type.STRING },
              E: { type: Type.STRING }
            },
            required: ["A", "B", "C", "D", "E"]
          },
          conceito: { type: Type.STRING },
          comoNaoErrar: { type: Type.STRING },
          oQueCobra: { type: Type.STRING }
        },
        required: ["materia", "enunciado", "alternativas", "gabarito", "explicacoes", "conceito", "comoNaoErrar", "oQueCobra"]
      }
    }
  });
  return JSON.parse(response.text || "{}");
}

async function generateLesson(tema: string) {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Crie uma aula MASTERCLASS e profunda sobre: "${tema}".
    Estrutura:
    1. Introdução Histórica/Contextual.
    2. Teoria Aprofundada (Explicar o "porquê" e não apenas o "o quê").
    3. Conexões Interdisciplinares (Como isso se liga a outras matérias).
    4. Mapa Mental Textual (Estrutura hierárquica).
    5. Erros Críticos (Onde 90% dos alunos falham).
    6. Resumo "Flash" para revisão rápida.
    Retorne em Markdown rico e bem formatado.`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
    }
  });
  return response.text;
}

async function generateFlashcards(tema: string) {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Gere 5 flashcards de revisão ativa (Active Recall) sobre: "${tema}".
    Cada flashcard deve ter uma pergunta desafiadora (Frente) e uma resposta detalhada e explicativa (Verso).
    Retorne apenas JSON:
    {
      "flashcards": [
        { "frente": "string", "verso": "string" }
      ]
    }`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          flashcards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                frente: { type: Type.STRING },
                verso: { type: Type.STRING }
              },
              required: ["frente", "verso"]
            }
          }
        },
        required: ["flashcards"]
      }
    }
  });
  return JSON.parse(response.text || "{}");
}

async function parseEnemBulk(text: string) {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analise o texto (pode conter erros de PDF) e extraia questões do ENEM.
    Instruções:
    1. Identifique matéria e enunciado.
    2. Classifique erro: B (Banal), L (Lacuna), D (Desconhecimento).
    3. Retorne array JSON:
    [{ "materia": "string", "questao": "string", "descricao": "string", "tab": "B"|"L"|"D" }]
    Texto: "${text}"`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            materia: { type: Type.STRING },
            questao: { type: Type.STRING },
            descricao: { type: Type.STRING },
            tab: { type: Type.STRING, enum: ["B", "L", "D"] }
          },
          required: ["materia", "questao", "descricao", "tab"]
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
}

// --- Components ---
interface PomodoroProps {
  timeLeft: number;
  setTimeLeft: (t: number | ((prev: number) => number)) => void;
  isActive: boolean;
  setIsActive: (a: boolean) => void;
  mode: 'foco' | 'pausa';
  setMode: (m: 'foco' | 'pausa') => void;
}

function PomodoroTimer({ timeLeft, setTimeLeft, isActive, setIsActive, mode, setMode }: PomodoroProps) {
  const toggleMode = () => {
    const nextMode = mode === 'foco' ? 'pausa' : 'foco';
    setMode(nextMode);
    setTimeLeft(nextMode === 'foco' ? 25 * 60 : 5 * 60);
    setIsActive(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="neo-card p-4 flex items-center justify-between bg-gradient-to-r from-tab-b/5 to-tab-l/5 border-tab-b/10">
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
          mode === 'foco' ? "bg-tab-d/10 text-tab-d" : "bg-green-500/10 text-green-500"
        )}>
          <Clock size={20} />
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {mode === 'foco' ? 'Foco' : 'Pausa'}
          </div>
          <div className="font-display font-black text-xl tabular-nums">{formatTime(timeLeft)}</div>
        </div>
      </div>
      
      <div className="flex gap-2">
        <button 
          onClick={() => setTimeLeft(mode === 'foco' ? 25 * 60 : 5 * 60)}
          className="p-2 text-muted-foreground hover:text-tab-l transition-colors"
        >
          <RotateCcw size={18} />
        </button>
        <button 
          onClick={() => setIsActive(!isActive)}
          className={cn(
            "px-6 py-2 rounded-xl font-display font-bold text-xs transition-all",
            isActive ? "bg-tab-d text-white" : "bg-tab-l text-white shadow-lg shadow-tab-l/20"
          )}
        >
          {isActive ? 'Pausar' : 'Iniciar'}
        </button>
      </div>
    </div>
  );
}

// --- Main App Component ---
export default function App() {
  const [activeSection, setActiveSection] = useState<'registrar' | 'revisao' | 'lista' | 'pratica' | 'config'>('registrar');
  const [errors, setErrors] = useState<StudyError[]>([]);
  const [streak, setStreak] = useState<StreakData>({ streak: 0, lastDate: '' });
  const [meta, setMeta] = useState<number>(0);
  const [praticaHist, setPraticaHist] = useState<PracticeHistory[]>([]);
  const [platform, setPlatform] = useState<Platform>('web');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [manualApiKey, setManualApiKey] = useState(localStorage.getItem('gemini_api_key') || "");
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    materia: '',
    prova: '',
    questao: '',
    descricao: '',
    gabarito: '',
    tab: 'B' as TabType
  });

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [scannedResults, setScannedResults] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);

  // Practice state
  const [practiceTema, setPracticeTema] = useState('');
  const [practiceNivel, setPracticeNivel] = useState<'Fácil' | 'Médio' | 'Difícil'>('Médio');
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAlt, setSelectedAlt] = useState<number | null>(null);
  const [isTestingKey, setIsTestingKey] = useState(false);

  // Lesson state
  const [lessonContent, setLessonContent] = useState<string | null>(null);
  const [isGeneratingLesson, setIsGeneratingLesson] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);

  // Flashcards state
  const [flashcards, setFlashcards] = useState<any[] | null>(null);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [showFlashcardBack, setShowFlashcardBack] = useState(false);

  // Pomodoro state
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'foco' | 'pausa'>('foco');

  // Pomodoro logic (global)
  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      if (window.navigator.vibrate) window.navigator.vibrate([200, 100, 200]);
      const nextMode = mode === 'foco' ? 'pausa' : 'foco';
      setMode(nextMode);
      setTimeLeft(nextMode === 'foco' ? 25 * 60 : 5 * 60);
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, mode]);

  // Filter state
  const [filter, setFilter] = useState<string>('todos');
  const [search, setSearch] = useState('');

  // Detect platform
  useEffect(() => {
    const p = Capacitor.getPlatform() as Platform;
    setPlatform(p);
    document.body.classList.add(`platform-${p}`);

    const checkKey = async () => {
      if ((window as any).aistudio?.hasSelectedApiKey) {
        const has = await (window as any).aistudio.hasSelectedApiKey();
        setHasApiKey(has);
      } else if (localStorage.getItem('gemini_api_key') || (import.meta as any).env.VITE_GEMINI_API_KEY) {
        setHasApiKey(true);
      }
    };
    checkKey();
  }, []);

  const saveManualKey = () => {
    if (manualApiKey.trim()) {
      localStorage.setItem('gemini_api_key', manualApiKey.trim());
      setHasApiKey(true);
      setShowKeyInput(false);
      alert("Chave salva com sucesso!");
    } else {
      localStorage.removeItem('gemini_api_key');
      setHasApiKey(false);
      alert("Chave removida. Usando padrão do sistema.");
    }
  };

  const testKey = async () => {
    setIsTestingKey(true);
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Diga 'OK' se você estiver funcionando.",
      });
      if (response.text) {
        alert("Conexão bem-sucedida! A IA está respondendo corretamente.");
      }
    } catch (error) {
      console.error(error);
      alert("Erro na conexão. Verifique sua chave e tente novamente.");
    } finally {
      setIsTestingKey(false);
    }
  };

  // Load data
  useEffect(() => {
    const savedErrors = localStorage.getItem(STORE_KEY);
    if (savedErrors) setErrors(JSON.parse(savedErrors));

    const savedStreak = localStorage.getItem(STREAK_KEY);
    if (savedStreak) setStreak(JSON.parse(savedStreak));

    const savedMeta = localStorage.getItem(META_KEY);
    if (savedMeta) setMeta(parseInt(savedMeta));

    const savedPratica = localStorage.getItem(PRATICA_KEY);
    if (savedPratica) setPraticaHist(JSON.parse(savedPratica));
  }, []);

  // Persist data
  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(errors));
  }, [errors]);

  useEffect(() => {
    localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
  }, [streak]);

  useEffect(() => {
    localStorage.setItem(PRATICA_KEY, JSON.stringify(praticaHist));
  }, [praticaHist]);

  // Helper: Proxima Revisão
  const getProximaRevisao = (item: StudyError) => {
    const intervals = REVIEW_INTERVALS[item.tab] || [1];
    const revisoes = item.revisoes || [];
    const idx = Math.min(revisoes.length, intervals.length - 1);
    const interval = intervals[idx];
    const base = revisoes.length > 0 ? revisoes[revisoes.length - 1] : item.ts;
    return new Date(base + interval * 86400000);
  };

  const isDueForReview = (item: StudyError) => {
    if (item.resolved) return false;
    if (item.tab === 'B' && item.revisoes.length >= 1) return false;
    const prox = getProximaRevisao(item);
    return prox <= new Date();
  };

  const dueErrors = useMemo(() => errors.filter(isDueForReview), [errors]);

  // Handlers
  const handleSaveError = () => {
    if (!formData.materia || !formData.questao) return;

    const now = new Date();
    const newError: StudyError = {
      id: Date.now(),
      ...formData,
      data: now.toLocaleDateString('pt-BR'),
      ts: now.getTime(),
      resolved: false,
      revisoes: []
    };

    setErrors([newError, ...errors]);
    
    const today = now.toDateString();
    if (streak.lastDate !== today) {
      const yesterday = new Date(now.getTime() - 86400000).toDateString();
      setStreak(prev => ({
        streak: prev.lastDate === yesterday ? prev.streak + 1 : 1,
        lastDate: today
      }));
    }

    setFormData({ materia: '', prova: '', questao: '', descricao: '', gabarito: '', tab: 'B' });
    if (window.navigator.vibrate) window.navigator.vibrate(10);
  };

  const handleToggleResolve = (id: number) => {
    setErrors(errors.map(e => e.id === id ? { ...e, resolved: !e.resolved } : e));
    if (window.navigator.vibrate) window.navigator.vibrate(5);
  };

  const handleScan = async () => {
    if (!scanInput) return;
    setIsParsing(true);
    try {
      const results = await parseEnemBulk(scanInput);
      
      if (activeSection === 'pratica') {
        if (results.length > 0) {
          setPracticeTema(results[0].questao || results[0].materia);
          setIsScanning(false);
          setScanInput('');
        }
        return;
      }

      if (results.length === 1) {
        setFormData({
          ...formData,
          materia: results[0].materia,
          questao: results[0].questao,
          descricao: results[0].descricao,
          tab: results[0].tab
        });
        setIsScanning(false);
        setScanInput('');
      } else {
        setScannedResults(results);
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao processar. Tente colar o texto novamente.");
    } finally {
      setIsParsing(false);
    }
  };

  const handlePdfUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtractingPdf(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      
      // Extract text from first 5 pages to avoid overload
      const numPages = Math.min(pdf.numPages, 5);
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((item: any) => item.str);
        fullText += strings.join(' ') + '\n';
      }
      
      setScanInput(fullText);
    } catch (error) {
      console.error("Erro ao ler PDF:", error);
      alert("Não foi possível extrair o texto deste PDF.");
    } finally {
      setIsExtractingPdf(false);
    }
  };

  const handleSaveScanned = (item: any) => {
    const now = new Date();
    const newError: StudyError = {
      id: Date.now() + Math.random(),
      ...item,
      data: now.toLocaleDateString('pt-BR'),
      ts: now.getTime(),
      resolved: false,
      revisoes: []
    };
    setErrors(prev => [newError, ...prev]);
    setScannedResults(prev => prev.filter(i => i !== item));
    if (window.navigator.vibrate) window.navigator.vibrate(5);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Memoris - Método TAB',
          text: 'Estude com o Método TAB e Memoris!',
          url: url,
        });
      } catch (err) {
        console.error(err);
      }
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReview = (id: number) => {
    setErrors(errors.map(e => e.id === id ? { ...e, revisoes: [...e.revisoes, Date.now()] } : e));
    if (window.navigator.vibrate) window.navigator.vibrate(5);
  };

  const handleDelete = (id: number) => {
    if (confirm('Deseja excluir este erro?')) {
      setErrors(errors.filter(e => e.id !== id));
    }
  };

  const handlePractice = async () => {
    if (!practiceTema) return;
    setIsGenerating(true);
    setCurrentQuestion(null);
    setSelectedAlt(null);
    try {
      const q = await generateQuestion(practiceTema, practiceNivel);
      setCurrentQuestion(q);
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar questão. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswer = (idx: number) => {
    if (selectedAlt !== null) return;
    setSelectedAlt(idx);
    const acertou = idx === currentQuestion.gabarito;
    setPraticaHist([{
      id: Date.now(),
      tema: practiceTema,
      materia: currentQuestion.materia,
      enunciado: currentQuestion.enunciado,
      acertou,
      ts: Date.now()
    }, ...praticaHist]);
    if (window.navigator.vibrate) window.navigator.vibrate(acertou ? [10, 30, 10] : 50);
  };

  const handleLesson = async () => {
    const tema = selectedSub || practiceTema;
    if (!tema) return;
    setIsGeneratingLesson(true);
    setLessonContent(null);
    try {
      const content = await generateLesson(tema);
      setLessonContent(content);
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar aula. Tente novamente.");
    } finally {
      setIsGeneratingLesson(false);
    }
  };

  const handleFlashcards = async () => {
    const tema = selectedSub || practiceTema;
    if (!tema) return;
    setIsGeneratingFlashcards(true);
    setFlashcards(null);
    setCurrentFlashcardIndex(0);
    setShowFlashcardBack(false);
    try {
      const data = await generateFlashcards(tema);
      setFlashcards(data.flashcards);
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar flashcards.");
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  const masteryByTopic = useMemo(() => {
    const stats: Record<string, { total: number, correct: number }> = {};
    praticaHist.forEach(h => {
      if (!stats[h.tema]) stats[h.tema] = { total: 0, correct: 0 };
      stats[h.tema].total++;
      if (h.acertou) stats[h.tema].correct++;
    });
    return stats;
  }, [praticaHist]);

  const filteredErrors = useMemo(() => {
    return errors.filter(e => {
      const matchesSearch = e.materia.toLowerCase().includes(search.toLowerCase()) || 
                            e.questao.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === 'todos' || 
                            (filter === 'pendente' && !e.resolved) || 
                            (filter === 'resolvido' && e.resolved) || 
                            e.tab === filter;
      return matchesSearch && matchesFilter;
    });
  }, [errors, filter, search]);

  return (
    <div className={cn(
      "max-w-md mx-auto min-h-screen flex flex-col bg-bg text-foreground overflow-x-hidden",
      platform === 'ios' ? "font-sans" : "font-sans"
    )}>
      <header className={cn(
        "sticky top-0 z-30 bg-bg/80 backdrop-blur-xl border-b border-border px-4 pt-safe pb-3 transition-all",
        platform === 'android' ? "h-16 flex items-center border-none shadow-sm" : "h-14"
      )}>
        <div className={cn(
          "flex items-center justify-between w-full",
          platform === 'android' ? "gap-4" : ""
        )}>
          {currentQuestion && activeSection === 'pratica' ? (
            <button onClick={() => setCurrentQuestion(null)} className="p-2 -ml-2 text-tab-l active:bg-tab-l/10 rounded-full transition-colors">
              <ArrowLeft size={24} />
            </button>
          ) : null}
          
          <div className={cn(
            "flex items-baseline gap-1 font-display font-extrabold text-xl",
            platform === 'android' && !currentQuestion ? "flex-1" : ""
          )}>
            <span className="text-tab-b">T</span>
            <span className="text-tab-l">A</span>
            <span className="text-tab-d">B</span>
            {platform === 'android' && (
              <span className="ml-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-40">
                {activeSection === 'registrar' ? 'Início' : 
                 activeSection === 'revisao' ? 'Memoris' :
                 activeSection === 'lista' ? 'Erros' :
                 activeSection === 'pratica' ? 'Prática' : 'Mais'}
              </span>
            )}
          </div>
          
          {platform === 'ios' && !currentQuestion && (
            <div className="absolute left-1/2 -translate-x-1/2 font-display font-bold text-xs uppercase tracking-[0.15em] opacity-60">
              {activeSection === 'registrar' ? 'Novo Erro' : 
               activeSection === 'revisao' ? 'Memoris' :
               activeSection === 'lista' ? 'Meus Erros' :
               activeSection === 'pratica' ? 'Prática' : 'Mais'}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button 
              onClick={handleShare}
              className="p-2 text-muted-foreground active:text-tab-l transition-colors"
            >
              {copied ? <Check size={18} className="text-green-500" /> : <Share2 size={18} />}
            </button>
            <div className="flex items-center gap-2 bg-tab-b/10 border border-tab-b/20 rounded-full px-3 py-1 text-tab-b text-[10px] font-bold">
              <Flame size={12} />
              {streak.streak}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 pb-32">
        {activeSection === 'registrar' && platform === 'android' && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-2 mb-6"
          >
            <StatBox type="B" count={errors.filter(e => e.tab === 'B').length} />
            <StatBox type="L" count={errors.filter(e => e.tab === 'L').length} />
            <StatBox type="D" count={errors.filter(e => e.tab === 'D').length} />
          </motion.div>
        )}
        
        <AnimatePresence mode="wait">
          {activeSection === 'registrar' && (
            <motion.div 
              key="registrar"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {dueErrors.length > 0 && (
                <motion.div 
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveSection('revisao')}
                  className="bg-gradient-to-br from-tab-l/20 to-purple-500/10 border border-tab-l/30 rounded-3xl p-6 flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <div className="font-display font-bold text-base flex items-center gap-2">
                      <Sparkles size={18} className="text-tab-l" />
                      Memoris
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Sessão de revisão pendente</div>
                  </div>
                  <div className="font-display font-extrabold text-4xl text-tab-l">{dueErrors.length}</div>
                </motion.div>
              )}

              <PomodoroTimer 
                timeLeft={timeLeft} 
                setTimeLeft={setTimeLeft} 
                isActive={isActive} 
                setIsActive={setIsActive} 
                mode={mode} 
                setMode={setMode} 
              />

              <div className="neo-card p-8 space-y-6">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Novo Registro</h3>
                  <button 
                    onClick={() => setIsScanning(true)}
                    className="flex items-center gap-2 text-tab-l text-[10px] font-black uppercase tracking-widest bg-tab-l/10 px-4 py-2 rounded-xl"
                  >
                    <Scan size={14} />
                    Escanear ENEM
                  </button>
                </div>

                <div className="space-y-4">
                  <InputGroup label="Matéria" value={formData.materia} onChange={v => setFormData({...formData, materia: v})} placeholder="Ex: Matemática..." />
                  <InputGroup label="Questão / Tópico" value={formData.questao} onChange={v => setFormData({...formData, questao: v})} placeholder="Ex: Questão 42..." />
                  
                  <div className="grid grid-cols-3 gap-3">
                    {(['B', 'L', 'D'] as TabType[]).map(t => (
                      <TabButton key={t} type={t} active={formData.tab === t} onClick={() => setFormData({...formData, tab: t})} />
                    ))}
                  </div>

                  <button 
                    onClick={handleSaveError}
                    className="w-full bg-gradient-to-br from-tab-l to-purple-500 text-white font-display font-bold py-5 rounded-[1.5rem] shadow-2xl shadow-tab-l/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <PlusCircle size={20} />
                    Salvar Registro
                  </button>
                </div>
              </div>

              {isScanning && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="fixed inset-0 z-50 bg-bg/95 flex items-center justify-center p-6 backdrop-blur-2xl"
                >
                  <div className="w-full max-w-sm space-y-6 max-h-[90vh] flex flex-col">
                    <div className="flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-tab-l/10 flex items-center justify-center text-tab-l">
                          <Scan size={20} />
                        </div>
                        <h3 className="font-display font-bold text-xl">Scanner ENEM</h3>
                      </div>
                      <button onClick={() => { setIsScanning(false); setScannedResults([]); }} className="text-muted-foreground p-2">
                        <X size={24} />
                      </button>
                    </div>

                    {scannedResults.length > 0 ? (
                      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                        <p className="text-[10px] font-black uppercase tracking-widest text-tab-l">Questões Detectadas ({scannedResults.length})</p>
                        {scannedResults.map((res, i) => (
                          <motion.div 
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="neo-card p-4 space-y-3"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-[10px] font-bold px-2 py-1 bg-tab-l/10 text-tab-l rounded-lg uppercase">{res.materia}</span>
                              <div className="flex gap-1">
                                <span className={cn(
                                  "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black",
                                  res.tab === 'B' ? "bg-tab-b/20 text-tab-b" :
                                  res.tab === 'L' ? "bg-tab-l/20 text-tab-l" : "bg-tab-d/20 text-tab-d"
                                )}>
                                  {res.tab}
                                </span>
                              </div>
                            </div>
                            <h4 className="text-sm font-bold leading-tight">{res.questao}</h4>
                            <p className="text-[11px] text-muted-foreground line-clamp-2">{res.descricao}</p>
                            <button 
                              onClick={() => handleSaveScanned(res)}
                              className="w-full py-3 bg-tab-l/10 hover:bg-tab-l/20 text-tab-l text-[11px] font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                              <PlusCircle size={14} />
                              SALVAR ESTA
                            </button>
                          </motion.div>
                        ))}
                        {scannedResults.length > 0 && (
                          <button 
                            onClick={() => {
                              scannedResults.forEach(handleSaveScanned);
                              setIsScanning(false);
                              setScannedResults([]);
                            }}
                            className="w-full py-4 bg-tab-l text-white font-display font-bold rounded-2xl shadow-xl shadow-tab-l/20"
                          >
                            SALVAR TODAS ({scannedResults.length})
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-6 flex-1 flex flex-col">
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground leading-relaxed">Cole o texto da prova do ENEM ou envie um PDF. Nossa IA vai separar as questões automaticamente.</p>
                          
                          <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-2xl hover:border-tab-l transition-colors cursor-pointer group">
                            <input type="file" accept=".pdf" onChange={handlePdfUpload} className="hidden" />
                            <Upload size={18} className="text-muted-foreground group-hover:text-tab-l" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-tab-l">
                              {isExtractingPdf ? 'Extraindo...' : 'Enviar PDF'}
                            </span>
                          </label>
                        </div>

                        <textarea 
                          value={scanInput}
                          onChange={e => setScanInput(e.target.value)}
                          placeholder="Ou cole o texto aqui..."
                          className="flex-1 bg-surface border border-border rounded-3xl p-6 text-sm outline-none focus:border-tab-l transition-all resize-none font-medium"
                        />
                        <button 
                          onClick={handleScan}
                          disabled={isParsing || !scanInput}
                          className="w-full bg-tab-l text-white font-display font-bold py-5 rounded-2xl shadow-xl shadow-tab-l/20 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
                        >
                          {isParsing ? (
                            <>
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>Processando...</span>
                            </>
                          ) : (
                            <>
                              <Zap size={18} />
                              <span>ANALISAR PROVA</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeSection === 'revisao' && (
            <motion.div 
              key="revisao"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between px-2">
                <h2 className="font-display font-black text-2xl tracking-tight">Memoris</h2>
                <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-surface px-3 py-1 rounded-full border border-border">
                  Spaced Repetition
                </div>
              </div>

              {dueErrors.length === 0 ? (
                <div className="neo-card p-12 text-center space-y-6 flex flex-col items-center">
                  <div className="relative">
                    <div className="w-24 h-24 bg-green-500/10 rounded-[2.5rem] flex items-center justify-center text-green-500">
                      <CheckCircle2 size={48} />
                    </div>
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="absolute -top-2 -right-2 w-8 h-8 bg-tab-l/20 rounded-full flex items-center justify-center text-tab-l"
                    >
                      <Sparkles size={16} />
                    </motion.div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-display font-bold text-xl">Tudo em dia!</h3>
                    <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[200px] mx-auto">Sua memória está afiada. O algoritmo de repetição espaçada avisará quando for hora de revisar.</p>
                  </div>
                  <button 
                    onClick={() => setActiveSection('registrar')}
                    className="bg-surface border border-border px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-border transition-colors"
                  >
                    VOLTAR AO INÍCIO
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {dueErrors.map(error => (
                    <ErrorCard 
                      key={error.id} 
                      error={error} 
                      onReview={() => handleReview(error.id)}
                      onResolve={() => handleToggleResolve(error.id)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeSection === 'lista' && (
            <motion.div 
              key="lista"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="text" 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar erro..."
                  className="w-full bg-surface border border-border rounded-2xl pl-10 pr-4 py-3 text-sm outline-none focus:border-tab-l transition-all"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {['todos', 'B', 'L', 'D', 'pendente', 'resolvido'].map(f => (
                  <button 
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "text-[10px] px-4 py-2 rounded-full border whitespace-nowrap transition-all font-bold uppercase tracking-wider",
                      filter === f ? "bg-tab-l border-tab-l text-white" : "bg-surface border-border text-muted-foreground"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {filteredErrors.map(error => (
                  <div key={error.id} className={cn(
                    "bg-surface border border-border rounded-2xl p-4 flex items-center gap-4 active:scale-[0.99] transition-all",
                    error.resolved && "opacity-40 grayscale"
                  )}>
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center font-display font-extrabold text-xl",
                      `bg-tab-${error.tab.toLowerCase()}/10 text-tab-${error.tab.toLowerCase()}`
                    )}>
                      {error.tab}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{error.materia}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{error.questao}</div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleToggleResolve(error.id)} className="p-2 text-muted-foreground active:text-green-500">
                        <CheckCircle2 size={20} className={error.resolved ? 'text-green-500' : ''} />
                      </button>
                      <button onClick={() => handleDelete(error.id)} className="p-2 text-muted-foreground active:text-tab-d">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeSection === 'pratica' && (
            <motion.div 
              key="pratica"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              {flashcards ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  <div className="flex justify-between items-center px-2">
                    <button onClick={() => setFlashcards(null)} className="text-[10px] font-black text-tab-l uppercase tracking-widest flex items-center gap-1">
                      <ArrowLeft size={12} /> Sair
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Flashcard {currentFlashcardIndex + 1} de {flashcards.length}</span>
                  </div>

                  <div 
                    onClick={() => setShowFlashcardBack(!showFlashcardBack)}
                    className="perspective-1000 cursor-pointer h-64"
                  >
                    <motion.div 
                      animate={{ rotateY: showFlashcardBack ? 180 : 0 }}
                      transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                      className="relative w-full h-full preserve-3d"
                    >
                      {/* Front */}
                      <div className="absolute inset-0 backface-hidden bg-surface border-2 border-tab-l rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center shadow-2xl">
                        <div className="text-[10px] font-black text-tab-l uppercase tracking-widest mb-4">Pergunta</div>
                        <p className="text-lg font-display font-bold leading-tight">{flashcards[currentFlashcardIndex].frente}</p>
                        <div className="mt-8 text-[8px] font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Toque para virar</div>
                      </div>
                      {/* Back */}
                      <div className="absolute inset-0 backface-hidden bg-surface-2 border-2 border-green-500 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center shadow-2xl rotate-y-180">
                        <div className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-4">Resposta</div>
                        <p className="text-sm font-medium leading-relaxed">{flashcards[currentFlashcardIndex].verso}</p>
                      </div>
                    </motion.div>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      disabled={currentFlashcardIndex === 0}
                      onClick={() => { setCurrentFlashcardIndex(i => i - 1); setShowFlashcardBack(false); }}
                      className="flex-1 bg-surface border border-border py-4 rounded-2xl font-bold disabled:opacity-30"
                    >
                      Anterior
                    </button>
                    <button 
                      onClick={() => { 
                        if (currentFlashcardIndex < flashcards.length - 1) {
                          setCurrentFlashcardIndex(i => i + 1);
                          setShowFlashcardBack(false);
                        } else {
                          setFlashcards(null);
                        }
                      }}
                      className="flex-1 bg-tab-l text-white py-4 rounded-2xl font-bold"
                    >
                      {currentFlashcardIndex < flashcards.length - 1 ? 'Próximo' : 'Finalizar'}
                    </button>
                  </div>
                </motion.div>
              ) : lessonContent ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface border border-border rounded-3xl p-6 shadow-xl relative"
                >
                  <button 
                    onClick={() => setLessonContent(null)}
                    className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-tab-l"
                  >
                    <X size={20} />
                  </button>
                  <div className="prose prose-sm dark:prose-invert max-w-none markdown-body">
                    <Markdown>{lessonContent}</Markdown>
                  </div>
                  <button 
                    onClick={() => { setLessonContent(null); handlePractice(); }}
                    className="w-full mt-8 bg-tab-l text-white font-display font-bold py-4 rounded-2xl active:scale-95 transition-all"
                  >
                    Praticar com Questão
                  </button>
                </motion.div>
              ) : !currentQuestion ? (
                <div className="space-y-6">
                  <PomodoroTimer 
                    timeLeft={timeLeft} 
                    setTimeLeft={setTimeLeft} 
                    isActive={isActive} 
                    setIsActive={setIsActive} 
                    mode={mode} 
                    setMode={setMode} 
                  />
                  
                  <div className="bg-surface-2 border border-border rounded-3xl p-8 text-center shadow-2xl">
                    <div className="w-16 h-16 bg-tab-l/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <BrainCircuit size={32} className="text-tab-l" />
                    </div>
                    <h3 className="font-display font-bold text-lg mb-2">Prática Inteligente</h3>
                    <p className="text-xs text-muted-foreground mb-6 leading-relaxed">A IA gera questões e aulas personalizadas para você dominar qualquer tema.</p>
                    
                    {!selectedSubject ? (
                      <div className="grid grid-cols-2 gap-3 mb-6">
                        {SUBJECTS.map(s => (
                          <button
                            key={s.name}
                            onClick={() => setSelectedSubject(s.name)}
                            className={cn(
                              "p-4 rounded-2xl border-2 border-border bg-surface hover:border-tab-l transition-all text-center group",
                              `hover:bg-${s.color}/5`
                            )}
                          >
                            <div className={cn("font-display font-black text-lg mb-1", `text-${s.color}`)}>{s.name}</div>
                            <div className="text-[8px] font-bold uppercase tracking-widest opacity-40">Explorar</div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mb-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <button onClick={() => { setSelectedSubject(null); setSelectedSub(null); }} className="text-[10px] font-black text-tab-l uppercase tracking-widest flex items-center gap-1">
                            <ArrowLeft size={12} /> Voltar
                          </button>
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{selectedSubject}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {SUBJECTS.find(s => s.name === selectedSubject)?.subs.map(sub => (
                            <button
                              key={sub}
                              onClick={() => { setSelectedSub(sub); setPracticeTema(sub); }}
                              className={cn(
                                "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border flex flex-col items-center gap-1",
                                selectedSub === sub ? "bg-tab-l border-tab-l text-white" : "bg-surface border-border text-muted-foreground"
                              )}
                            >
                              <span>{sub}</span>
                              {masteryByTopic[sub] && (
                                <div className="w-12 h-1 bg-black/20 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-white transition-all" 
                                    style={{ width: `${(masteryByTopic[sub].correct / masteryByTopic[sub].total) * 100}%` }}
                                  />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="relative mb-4">
                      <input 
                        type="text" 
                        value={practiceTema}
                        onChange={e => { setPracticeTema(e.target.value); setSelectedSub(null); }}
                        placeholder="Ou digite um tema livre..."
                        className="w-full bg-surface border border-border rounded-2xl p-4 pr-12 text-sm outline-none focus:border-tab-l text-center font-bold"
                      />
                      <button 
                        onClick={() => setIsScanning(true)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-tab-l active:scale-90 transition-all"
                      >
                        <Scan size={20} />
                      </button>
                    </div>

                    <div className="flex gap-2 mb-6">
                      {[
                        { n: 'Fácil', s: 'Stanford', d: 'Fundamentos' },
                        { n: 'Médio', s: 'MIT', d: 'Raciocínio' },
                        { n: 'Difícil', s: 'Harvard', d: 'Análise' }
                      ].map(({ n, s, d }) => (
                        <button
                          key={n}
                          onClick={() => setPracticeNivel(n as any)}
                          className={cn(
                            "flex-1 py-3 rounded-xl transition-all border-2 flex flex-col items-center gap-0.5",
                            practiceNivel === n 
                              ? "bg-tab-l/20 border-tab-l text-tab-l" 
                              : "bg-surface border-border text-muted-foreground opacity-50"
                          )}
                        >
                          <span className="text-[10px] font-black uppercase tracking-widest leading-none">{n}</span>
                          <span className="text-[8px] font-bold opacity-80 leading-none">{s}</span>
                          <span className="text-[6px] font-medium opacity-40 uppercase tracking-tighter leading-none">{d}</span>
                        </button>
                      ))}
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2">
                      <button 
                        onClick={handlePractice}
                        disabled={isGenerating || isGeneratingLesson || isGeneratingFlashcards || !practiceTema}
                        className="w-full bg-tab-l text-white font-display font-bold py-4 rounded-2xl disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        {isGenerating ? 'Gerando...' : 'Gerar Questão'}
                      </button>
                      <div className="flex gap-2">
                        <button 
                          onClick={handleLesson}
                          disabled={isGenerating || isGeneratingLesson || isGeneratingFlashcards || !practiceTema}
                          className="flex-1 bg-surface border border-border text-foreground font-display font-bold py-4 rounded-2xl disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          {isGeneratingLesson ? 'Gerando...' : 'Ver Aula'}
                        </button>
                        <button 
                          onClick={handleFlashcards}
                          disabled={isGenerating || isGeneratingLesson || isGeneratingFlashcards || !practiceTema}
                          className="flex-1 bg-surface border border-border text-foreground font-display font-bold py-4 rounded-2xl disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          {isGeneratingFlashcards ? 'Gerando...' : 'Flashcards'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {praticaHist.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Últimos Treinos</h4>
                      {praticaHist.slice(0, 3).map(h => (
                        <div key={h.id} className="bg-surface border border-border rounded-2xl p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-2 h-2 rounded-full", h.acertou ? "bg-green-500" : "bg-tab-d")} />
                            <div className="text-xs font-bold">{h.tema}</div>
                          </div>
                          <div className="text-[10px] text-muted-foreground">{new Date(h.ts).toLocaleDateString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-surface border border-border rounded-3xl p-6 shadow-xl"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-bold text-tab-l uppercase tracking-widest">{currentQuestion.materia}</span>
                      <div className="text-[10px] text-muted-foreground font-mono">ESTILO ENEM</div>
                    </div>
                    
                    <div className="text-sm leading-relaxed mb-8 font-medium">{currentQuestion.enunciado}</div>
                    
                    <div className="space-y-3">
                      {currentQuestion.alternativas.map((alt: string, i: number) => {
                        let status = "default";
                        if (selectedAlt !== null) {
                          if (i === currentQuestion.gabarito) status = "correct";
                          else if (i === selectedAlt) status = "wrong";
                          else status = "disabled";
                        }

                        return (
                          <button
                            key={i}
                            onClick={() => handleAnswer(i)}
                            disabled={selectedAlt !== null}
                            className={cn(
                              "w-full text-left p-4 rounded-2xl border-2 transition-all flex gap-4 items-start",
                              status === "default" && "border-border bg-surface active:bg-surface-2",
                              status === "correct" && "border-green-500 bg-green-500/10 scale-[1.02]",
                              status === "wrong" && "border-tab-d bg-tab-d/10",
                              status === "disabled" && "border-border opacity-30 grayscale"
                            )}
                          >
                            <span className={cn(
                              "font-display font-black text-lg",
                              status === "correct" ? "text-green-500" : "text-muted-foreground"
                            )}>{String.fromCharCode(65 + i)}</span>
                            <span className="text-xs font-medium leading-snug">{alt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>

                  {selectedAlt !== null && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-surface-2 border border-border rounded-3xl p-6 space-y-4 shadow-2xl"
                    >
                      <div className={cn(
                        "text-lg font-display font-black text-center",
                        selectedAlt === currentQuestion.gabarito ? "text-green-500" : "text-tab-d"
                      )}>
                        {selectedAlt === currentQuestion.gabarito ? 'ACERTOU! 🎯' : 'ERROU... 📉'}
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-px flex-1 bg-border" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Explicação Detalhada</span>
                          <div className="h-px flex-1 bg-border" />
                        </div>
                        
                        <div className="space-y-2">
                          {Object.entries(currentQuestion.explicacoes).map(([key, text]: any) => (
                            <div key={key} className={cn(
                              "p-3 rounded-xl text-[11px] leading-relaxed",
                              key === String.fromCharCode(65 + currentQuestion.gabarito) 
                                ? "bg-green-500/10 border border-green-500/20 text-green-600 font-medium" 
                                : "bg-surface border border-border text-muted-foreground opacity-80"
                            )}>
                              <span className="font-black mr-2">{key}:</span> {text}
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/10">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                  <BookOpen size={14} />
                                </div>
                                <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Conceito Base</div>
                              </div>
                            </div>
                            <p className="text-[11px] leading-relaxed text-foreground/80">{currentQuestion.conceito}</p>
                          </div>

                          <div className="bg-amber-500/5 p-4 rounded-2xl border border-amber-500/10">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                                  <Lightbulb size={14} />
                                </div>
                                <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Como não errar</div>
                              </div>
                            </div>
                            <p className="text-[11px] leading-relaxed text-foreground/80">{currentQuestion.comoNaoErrar}</p>
                          </div>

                          <div className="bg-purple-500/5 p-4 rounded-2xl border border-purple-500/10">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
                                  <Zap size={14} />
                                </div>
                                <div className="text-[10px] font-black text-purple-500 uppercase tracking-widest">O que o ENEM cobra</div>
                              </div>
                            </div>
                            <p className="text-[11px] leading-relaxed text-foreground/80">{currentQuestion.oQueCobra}</p>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => setCurrentQuestion(null)}
                        className="w-full bg-foreground text-bg font-display font-bold py-4 rounded-2xl active:scale-95 transition-all"
                      >
                        Próxima Questão
                      </button>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeSection === 'config' && (
            <motion.div 
              key="config"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="neo-card p-8 space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-[2rem] bg-tab-b/10 flex items-center justify-center text-tab-b">
                    <BarChart3 size={32} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-xl">Estatísticas</h3>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Seu desempenho no TAB</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface border border-border rounded-3xl p-4 text-center">
                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total</div>
                    <div className="font-display font-black text-2xl text-tab-l">{errors.length}</div>
                  </div>
                  <div className="bg-surface border border-border rounded-3xl p-4 text-center">
                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Resolvidos</div>
                    <div className="font-display font-black text-2xl text-green-500">{errors.filter(e => e.resolved).length}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Meta Semanal</span>
                    <span className="font-display font-bold text-xl">{Math.round((errors.filter(e => e.resolved).length / (meta || 1)) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-surface rounded-full overflow-hidden border border-border">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (errors.filter(e => e.resolved).length / (meta || 1)) * 100)}%` }}
                      className="h-full bg-gradient-to-r from-tab-l to-green-500"
                    />
                  </div>
                </div>
              </div>

              <div className="neo-card p-6 space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Compartilhar & Convite</h4>
                <button 
                  onClick={handleShare}
                  className="w-full flex items-center justify-between p-5 bg-surface rounded-3xl border border-border hover:border-tab-l transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-tab-l/10 flex items-center justify-center text-tab-l group-hover:scale-110 transition-transform">
                      <Share2 size={20} />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold">Convidar Amigos</div>
                      <div className="text-[10px] text-muted-foreground">Compartilhe o Memoris</div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="bg-surface-2 border border-border rounded-3xl p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-tab-l/10 flex items-center justify-center text-tab-l">
                      <Key size={20} />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold">Chave de API Gemini</div>
                      <div className="text-[9px] text-muted-foreground">
                        {hasApiKey ? "Chave configurada e ativa" : "Nenhuma chave configurada"}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <input 
                      type="password"
                      value={manualApiKey}
                      onChange={(e) => setManualApiKey(e.target.value)}
                      placeholder="Cole sua chave aqui (AI_...)"
                      className="w-full bg-surface border border-border rounded-xl p-3 text-xs outline-none focus:border-tab-l"
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={saveManualKey}
                        className="flex-1 bg-tab-l text-white font-black text-[10px] py-3 rounded-xl uppercase tracking-widest"
                      >
                        Salvar Chave
                      </button>
                      {hasApiKey && (
                        <button 
                          onClick={testKey}
                          disabled={isTestingKey}
                          className="flex-1 bg-surface border border-border text-foreground font-black text-[10px] py-3 rounded-xl uppercase tracking-widest disabled:opacity-50"
                        >
                          {isTestingKey ? "..." : "Testar"}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-[8px] text-muted-foreground text-center leading-tight">
                    Obtenha sua chave grátis em <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-tab-l underline">Google AI Studio</a>.
                  </p>
                </div>

                <button 
                  onClick={() => {
                    if (confirm('Apagar todos os dados?')) {
                      setErrors([]);
                      setStreak({ streak: 0, lastDate: '' });
                      setPraticaHist([]);
                      localStorage.clear();
                    }
                  }}
                  className="w-full bg-tab-d/5 text-tab-d border border-tab-d/10 font-black text-[10px] uppercase tracking-widest py-5 rounded-[1.5rem] active:scale-95 transition-all"
                >
                  Zerar Aplicativo
                </button>
              </div>

              <div className="text-center space-y-2 py-8">
                <div className="font-display font-black text-2xl opacity-10 tracking-tighter">MEMORIS TAB</div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em] opacity-20">v3.2.0</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-bg/80 backdrop-blur-2xl border-t border-border flex justify-around px-2 pt-2 pb-safe-bottom z-40">
        <NavButton active={activeSection === 'registrar'} onClick={() => setActiveSection('registrar')} icon={<LayoutGrid size={22} />} label="Início" />
        <NavButton active={activeSection === 'revisao'} onClick={() => setActiveSection('revisao')} icon={<RotateCcw size={22} />} label="Memoris" badge={dueErrors.length} />
        <NavButton active={activeSection === 'lista'} onClick={() => setActiveSection('lista')} icon={<List size={22} />} label="Erros" />
        <NavButton active={activeSection === 'pratica'} onClick={() => setActiveSection('pratica')} icon={<Target size={22} />} label="Prática" />
        <NavButton active={activeSection === 'config'} onClick={() => setActiveSection('config')} icon={<Settings size={22} />} label="Mais" />
      </nav>
    </div>
  );
}

// --- Sub-components ---

interface StatBoxProps {
  key?: any;
  type: TabType;
  count: number;
}

function StatBox({ type, count }: StatBoxProps) {
  const colors = { B: 'text-tab-b bg-tab-b/10 border-tab-b/20', L: 'text-tab-l bg-tab-l/10 border-tab-l/20', D: 'text-tab-d bg-tab-d/10 border-tab-d/20' };
  return (
    <div className={cn("rounded-xl border p-2 text-center", colors[type])}>
      <div className="font-display font-black text-lg leading-none">{count}</div>
      <div className="text-[7px] font-bold uppercase tracking-widest opacity-70 mt-1">{type}</div>
    </div>
  );
}

interface InputGroupProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}

function InputGroup({ label, value, onChange, placeholder }: InputGroupProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">{label}</label>
      <input 
        type="text" 
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-surface border border-border rounded-2xl p-4 text-sm font-medium focus:border-tab-l outline-none transition-all shadow-sm"
      />
    </div>
  );
}

interface TabButtonProps {
  key?: any;
  type: TabType;
  active: boolean;
  onClick: () => void;
}

function TabButton({ type, active, onClick }: TabButtonProps) {
  const labels = { B: 'Banal', L: 'Lacuna', D: 'Desconhec.' };
  const color = type === 'B' ? 'tab-b' : type === 'L' ? 'tab-l' : 'tab-d';
  
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "p-4 rounded-2xl border-2 transition-all text-center",
        active 
          ? `bg-${color}/20 border-${color} shadow-lg shadow-${color}/10` 
          : 'bg-surface border-border opacity-40 grayscale'
      )}
    >
      <div className={cn("font-display font-black text-3xl", `text-${color}`)}>{type}</div>
      <div className="text-[8px] font-bold uppercase tracking-tighter text-muted-foreground">{labels[type]}</div>
    </motion.button>
  );
}

interface ErrorCardProps {
  key?: any;
  error: StudyError;
  onReview: () => void;
  onResolve: () => void;
}

function ErrorCard({ error, onReview, onResolve }: ErrorCardProps) {
  const color = error.tab.toLowerCase();
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "bg-surface border-l-4 border-y border-r border-border rounded-2xl p-5 shadow-sm",
        `border-l-tab-${color}`
      )}
    >
      <div className="flex justify-between items-start mb-3">
        <span className={cn(
          "text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest",
          `bg-tab-${color}/10 text-tab-${color}`
        )}>
          {error.tab} — {error.tab === 'B' ? 'Banal' : error.tab === 'L' ? 'Lacuna' : 'Desconhec.'}
        </span>
        <span className="text-[9px] font-bold text-muted-foreground font-mono">{error.data}</span>
      </div>
      <h3 className="font-display font-bold text-sm mb-1">{error.materia}</h3>
      <p className="text-xs text-muted-foreground mb-5 font-medium">{error.questao}</p>
      <div className="flex gap-2">
        <button onClick={onReview} className="flex-1 bg-tab-l text-white text-[10px] font-black py-3 rounded-xl shadow-lg shadow-tab-l/20 active:scale-95 transition-all">
          REVISEI
        </button>
        <button onClick={onResolve} className="flex-1 bg-surface-2 text-foreground border border-border text-[10px] font-black py-3 rounded-xl active:scale-95 transition-all">
          RESOLVIDO
        </button>
      </div>
    </motion.div>
  );
}

interface StatsCardProps {
  icon: ReactNode;
  label: string;
  value: number;
  color: string;
}

function StatsCard({ icon, label, value, color }: StatsCardProps) {
  return (
    <div className="bg-surface border border-border rounded-3xl p-5 text-center shadow-sm">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3", `bg-${color}/10 text-${color}`)}>
        {icon}
      </div>
      <div className="font-display font-black text-3xl leading-none">{value}</div>
      <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-2">{label}</div>
    </div>
  );
}

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  badge?: number;
}

function NavButton({ active, onClick, icon, label, badge }: NavButtonProps) {
  const platform = Capacitor.getPlatform();
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 p-2 transition-all relative flex-1 group",
        active ? "text-foreground" : "text-muted-foreground opacity-40"
      )}
    >
      <div className={cn(
        "relative px-5 py-1.5 rounded-2xl transition-all duration-500",
        active && "bg-tab-l/10 shadow-[0_0_20px_rgba(139,92,246,0.1)]"
      )}>
        <div className={cn(
          "transition-all duration-500",
          active ? "text-tab-l scale-110" : "scale-100"
        )}>
          {icon}
        </div>
        {badge ? (
          <span className={cn(
            "absolute -top-1 -right-1 bg-tab-d text-white text-[7px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-bg",
            platform === 'android' && "top-0 right-2"
          )}>
            {badge}
          </span>
        ) : null}
      </div>
      <span className={cn(
        "text-[8px] font-black uppercase tracking-[0.15em] transition-all mt-1",
        active ? "opacity-100 text-tab-l" : "opacity-40"
      )}>{label === 'Revisão' ? 'Memoris' : label}</span>
    </button>
  );
}
