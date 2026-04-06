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
  Settings, 
  Flame, 
  CheckCircle2, 
  Trash2, 
  Search,
  Clock,
  BarChart3,
  ArrowLeft,
  X,
  Sparkles,
  ChevronRight,
  LayoutGrid,
  Key,
  Share2,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import Markdown from 'react-markdown';

// --- Types ---
type TabType = 'B' | 'L' | 'D';
type Platform = 'ios' | 'android' | 'web';
type Section = 'registrar' | 'revisao' | 'config';

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

// --- Constants ---
const STORE_KEY = 'tab_erros_v3';
const STREAK_KEY = 'tab_streak_v3';
const META_KEY = 'tab_meta_v3';

const REVIEW_INTERVALS: Record<TabType, number[]> = {
  B: [1],
  L: [1, 3],
  D: [1, 3, 7]
};

// --- AI Service ---
function getAI() {
  const savedKey = localStorage.getItem('gemini_api_key');
  const viteEnvKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
  
  const apiKey = savedKey || viteEnvKey || "";
  return new GoogleGenAI({ apiKey });
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
  const [activeSection, setActiveSection] = useState<Section>('registrar');
  const [errors, setErrors] = useState<StudyError[]>([]);
  const [streak, setStreak] = useState<StreakData>({ streak: 0, lastDate: '' });
  const [meta, setMeta] = useState<number>(0);
  const [platform, setPlatform] = useState<Platform>('web');

  // Form state
  const [formData, setFormData] = useState({
    materia: '',
    prova: '',
    questao: '',
    descricao: '',
    gabarito: '',
    tab: 'B' as TabType
  });

  const [isTestingKey, setIsTestingKey] = useState(false);

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
  }, []);

  // Load data
  useEffect(() => {
    const savedErrors = localStorage.getItem(STORE_KEY);
    if (savedErrors) setErrors(JSON.parse(savedErrors));

    const savedStreak = localStorage.getItem(STREAK_KEY);
    if (savedStreak) setStreak(JSON.parse(savedStreak));

    const savedMeta = localStorage.getItem(META_KEY);
    if (savedMeta) setMeta(parseInt(savedMeta));
  }, []);

  // Persist data
  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(errors));
  }, [errors]);

  useEffect(() => {
    localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
  }, [streak]);

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
      alert("Link copiado!");
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
          <div className={cn(
            "flex items-baseline gap-1 font-display font-extrabold text-xl",
            platform === 'android' ? "flex-1" : ""
          )}>
            <span className="text-tab-b">T</span>
            <span className="text-tab-l">A</span>
            <span className="text-tab-d">B</span>
            {platform === 'android' && (
              <span className="ml-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-40">
                {activeSection === 'registrar' ? 'Início' : 
                 activeSection === 'revisao' ? 'Memoris' : 'Mais'}
              </span>
            )}
          </div>
          
          {platform === 'ios' && (
            <div className="absolute left-1/2 -translate-x-1/2 font-display font-bold text-xs uppercase tracking-[0.15em] opacity-60">
              {activeSection === 'registrar' ? 'Novo Erro' : 
               activeSection === 'revisao' ? 'Memoris' : 'Mais'}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button 
              onClick={handleShare}
              className="p-2 text-muted-foreground active:text-tab-l transition-colors"
            >
              <Share2 size={18} />
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {dueErrors.length > 0 && (
                <motion.div 
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveSection('revisao')}
                  className="bg-tab-l text-white rounded-3xl p-6 flex items-center justify-between cursor-pointer shadow-xl shadow-tab-l/20"
                >
                  <div>
                    <div className="font-display font-bold text-base flex items-center gap-2">
                      <Sparkles size={18} />
                      Revisão Pendente
                    </div>
                    <div className="text-[10px] opacity-70 uppercase tracking-widest mt-1">Sua memória precisa de você</div>
                  </div>
                  <div className="font-display font-extrabold text-4xl">{dueErrors.length}</div>
                </motion.div>
              )}

              <div className="neo-card p-8 space-y-6">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Novo Registro</h3>
                </div>

                <div className="space-y-4">
                  <InputGroup label="Matéria" value={formData.materia} onChange={v => setFormData({...formData, materia: v})} placeholder="Ex: Biologia" />
                  <InputGroup label="O que você errou?" value={formData.descricao} onChange={v => setFormData({...formData, descricao: v})} placeholder="Descreva o erro..." />
                  
                  <div className="flex gap-2">
                    {(['B', 'L', 'D'] as TabType[]).map(t => (
                      <TabButton key={t} type={t} active={formData.tab === t} onClick={() => setFormData({...formData, tab: t})} />
                    ))}
                  </div>

                  <button 
                    onClick={handleSaveError}
                    disabled={!formData.materia || !formData.descricao}
                    className="w-full bg-foreground text-bg font-display font-bold py-5 rounded-[1.5rem] active:scale-[0.98] transition-all disabled:opacity-30"
                  >
                    SALVAR ERRO
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center px-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Últimos Erros</h3>
                <button onClick={() => setActiveSection('config')} className="text-[10px] font-black uppercase tracking-widest text-tab-l">Ver Todos</button>
              </div>

              <div className="space-y-2 px-2">
                {errors.slice(0, 3).map(error => (
                  <div key={error.id} className="bg-surface/50 border border-border rounded-2xl p-4 flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-display font-black", `bg-tab-${error.tab.toLowerCase()}/10 text-tab-${error.tab.toLowerCase()}`)}>
                      {error.tab}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs truncate">{error.materia}</div>
                      <div className="text-[9px] text-muted-foreground truncate">{error.questao || 'Sem ID'}</div>
                    </div>
                  </div>
                ))}
              </div>
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

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Histórico de Erros</h3>
                </div>

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

                <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                  {filteredErrors.map(error => (
                    <div key={error.id} className={cn(
                      "bg-surface border border-border rounded-2xl p-4 flex items-center gap-4",
                      error.resolved && "opacity-40 grayscale"
                    )}>
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-sm", `bg-tab-${error.tab.toLowerCase()}/10 text-tab-${error.tab.toLowerCase()}`)}>
                        {error.tab}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs truncate">{error.materia}</div>
                        <div className="text-[9px] text-muted-foreground truncate">{error.questao || 'Sem ID'}</div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleToggleResolve(error.id)} className="p-2 text-muted-foreground">
                          <CheckCircle2 size={18} className={error.resolved ? 'text-green-500' : ''} />
                        </button>
                        <button onClick={() => handleDelete(error.id)} className="p-2 text-muted-foreground">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => {
                    if (confirm('Apagar todos os dados?')) {
                      setErrors([]);
                      setStreak({ streak: 0, lastDate: '' });
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
        <NavButton active={activeSection === 'registrar'} onClick={() => setActiveSection('registrar')} icon={<PlusCircle size={22} />} label="Início" />
        <NavButton active={activeSection === 'revisao'} onClick={() => setActiveSection('revisao')} icon={<RotateCcw size={22} />} label="Revisar" badge={dueErrors.length} />
        <NavButton active={activeSection === 'config'} onClick={() => setActiveSection('config')} icon={<Settings size={22} />} label="Ajustes" />
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
