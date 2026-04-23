/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp, 
  doc, 
  getDocFromServer,
  updateDoc,
  increment
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { 
  Home, 
  PlusCircle, 
  BarChart2, 
  User, 
  MapPin, 
  Camera, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  TrendingUp,
  Award,
  Settings,
  LogOut,
  ThumbsUp,
  MessageSquare,
  ShieldCheck,
  Send,
  FileText,
  Scan,
  Loader2,
  Database
} from 'lucide-react';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Error handling helper
interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: any;
}

const handleFirestoreError = (err: any, op: string, path: string | null) => {
  const info: FirestoreErrorInfo = {
    error: err.message,
    operationType: op as any,
    path: path,
    authInfo: auth.currentUser ? {
      userId: auth.currentUser.uid,
      email: auth.currentUser.email || 'anon',
      emailVerified: auth.currentUser.emailVerified
    } : 'unauthenticated'
  };
  console.error("Firestore Error:", JSON.stringify(info));
  return info;
};

// Types
type Screen = 'home' | 'post' | 'detail' | 'ngo' | 'profile' | 'auth' | 'digitize';

interface Issue {
  id: string;
  title: string;
  reporterName: string;
  reporterLevel: number;
  reporterAvatar: string;
  location: string;
  votes: number;
  status: 'critical' | 'verified' | 'pending';
  category: string;
  imageUrl: string;
  createdAt: any;
  description: string;
  reporterUid: string;
}

export default function App() {
  const [activeScreen, setActiveScreen] = useState<Screen>('auth');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Connection test & Auth listener
  useEffect(() => {
    async function init() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (e) {
        console.warn("Initial connection test (expected if doc missing):", e);
      }
      
      onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        setIsLoading(false);
      });
    }
    init();
  }, []);

  // Real-time issues
  useEffect(() => {
    if (!currentUser) return;
    
    const q = query(collection(db, 'issues'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Issue[];
      setIssues(data);
    }, (err) => handleFirestoreError(err, 'list', 'issues'));

    return () => unsubscribe();
  }, [currentUser]);

  const triggerToast = (msg: string) => {
    setShowToast(msg);
    setTimeout(() => setShowToast(null), 3000);
  };

  const handleLogin = async () => {
    try {
      console.log("Attempting Auth...");
      await signInAnonymously(auth);
      setActiveScreen('home');
    } catch (e: any) {
      console.warn("Auth failed, bypassing for prototype:", e.message);
      // BYPASS: Create a localized guest session
      const guestUser = {
        uid: 'guest_' + Math.random().toString(36).substr(2, 9),
        isAnonymous: true,
        email: null,
      } as any;
      
      setCurrentUser(guestUser);
      triggerToast("Guest Mode Enabled (Firebase Auth Skipped)");
      setActiveScreen('home');
    }
  };

  const submitReport = async (data: Partial<Issue>) => {
    if (!currentUser) return;
    try {
      await addDoc(collection(db, 'issues'), {
        ...data,
        votes: 0,
        status: 'pending',
        reporterUid: currentUser.uid,
        reporterName: 'Meera K.',
        reporterLevel: 3,
        reporterAvatar: 'MK',
        createdAt: serverTimestamp()
      });
      triggerToast('Report submitted successfully!');
      setActiveScreen('home');
    } catch (e) {
      handleFirestoreError(e, 'create', 'issues');
      triggerToast('Submission failed');
    }
  };

  const castVote = async (issueId: string) => {
    try {
      await updateDoc(doc(db, 'issues', issueId), {
        votes: increment(1)
      });
      triggerToast('Vote recorded!');
    } catch (e) {
      handleFirestoreError(e, 'update', `issues/${issueId}`);
    }
  };

  const renderScreen = () => {
    if (isLoading) return <LoadingScreen />;
    
    switch (activeScreen) {
      case 'auth': return <AuthScreen onLogin={handleLogin} />;
      case 'home': return <HomeScreen issues={issues} onSelectIssue={(issue) => { setSelectedIssue(issue); setActiveScreen('detail'); }} />;
      case 'post': return <PostScreen onBack={() => setActiveScreen('home')} onSubmit={submitReport} />;
      case 'detail': return <DetailScreen issue={selectedIssue!} onBack={() => setActiveScreen('home')} onVote={() => castVote(selectedIssue!.id)} />;
      case 'ngo': return <NGODashboard issues={issues} onDigitize={() => setActiveScreen('digitize')} />;
      case 'digitize': return <DigitizeScreen currentUser={currentUser} onBack={() => setActiveScreen('ngo')} onComplete={() => { triggerToast('Surveys synchronized with database.'); setActiveScreen('ngo'); }} triggerToast={triggerToast} />;
      case 'profile': return <ProfileScreen onLogout={() => { auth.signOut(); setActiveScreen('auth'); }} />;
      default: return <HomeScreen issues={issues} onSelectIssue={() => {}} />;
    }
  };

  return (
    <div className="max-w-md mx-auto h-[100dvh] bg-white relative overflow-hidden flex flex-col font-sans selection:bg-slate-900 selection:text-white">
      {/* Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="absolute top-4 left-4 right-4 z-[100] flex justify-center"
          >
            <div className="bg-slate-900 text-white px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest shadow-2xl flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              {showToast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeScreen}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="h-full"
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </div>

      {activeScreen !== 'auth' && (
        <nav className="absolute bottom-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-xl border-t border-slate-100 flex justify-around items-center px-6 z-50">
          <NavButton active={activeScreen === 'home'} onClick={() => setActiveScreen('home')} icon={<Home size={22} />} label="Feed" />
          <NavButton active={activeScreen === 'ngo'} onClick={() => setActiveScreen('ngo')} icon={<BarChart2 size={22} />} label="Priority" />
          <div className="relative -top-6">
            <button 
              onClick={() => setActiveScreen('post')}
              className="w-14 h-14 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300"
            >
              <PlusCircle size={28} />
            </button>
          </div>
          <NavButton active={activeScreen === 'profile'} onClick={() => setActiveScreen('profile')} icon={<User size={22} />} label="Me" />
          <NavButton active={false} onClick={() => triggerToast('Search coming soon')} icon={<MapPin size={22} />} label="Map" />
        </nav>
      )}
    </div>
  );
}

// Components
function LoadingScreen() {
  return (
    <div className="h-full flex items-center justify-center">
      <Loader2 className="animate-spin text-slate-300" size={32} />
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 transition-colors duration-300 ${active ? 'text-slate-900' : 'text-slate-300 hover:text-slate-500'}`}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      {active && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-slate-900 rounded-full" />}
    </button>
  );
}

function AuthScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="h-full flex flex-col px-12 py-16 justify-center bg-white">
      <div className="mb-12">
        <div className="w-12 h-12 bg-slate-900 rounded-2xl mb-8 flex items-center justify-center">
          <div className="w-4 h-4 bg-white rounded-sm" />
        </div>
        <h1 className="text-[4rem] leading-[0.95] font-light tracking-tighter text-slate-900 mb-4">
          Lumina<br/><span className="font-medium text-slate-400">Community.</span>
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed max-w-[240px]">
          Verified neighborhood insights for a more resilient locality.
        </p>
      </div>

      <div className="space-y-4">
        <button 
          onClick={onLogin}
          className="w-full py-5 bg-slate-900 text-white rounded-3xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl"
        >
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
          Continue to Community
        </button>
      </div>
      
      <footer className="mt-12 text-[10px] text-slate-300 font-mono tracking-widest uppercase text-center">
        Built for Modern Workflows — 2024
      </footer>
    </div>
  );
}

interface HomeScreenProps {
  issues: Issue[];
  onSelectIssue: (i: Issue) => void;
}

function HomeScreen({ issues, onSelectIssue }: HomeScreenProps) {
  const critical = issues.filter(i => i.status === 'critical')[0];

  return (
    <div className="px-8 py-12 space-y-12">
      <header className="flex justify-between items-center">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">Koramangala, BLR</div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 leading-none">Pulse</h2>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-900 font-bold text-xs ring-1 ring-slate-100">
          MK
        </div>
      </header>

      <section>
        <div className="flex justify-between items-end mb-6 px-2">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Critical Alerts</h3>
          <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-ping" />
        </div>
        {critical ? (
          <div className="bg-white border border-slate-100 rounded-[3rem] p-8 shadow-minimal">
            <div className="flex items-start gap-6 mb-8">
              <div className="w-12 h-12 shrink-0 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-red-500">
                <AlertCircle size={22} />
              </div>
              <div className="flex-1">
                <div className="mb-2 inline-block px-3 py-1 bg-red-50 text-red-500 text-[9px] font-bold uppercase tracking-widest rounded-full">
                  Live Alert
                </div>
                <p className="text-base text-slate-700 leading-relaxed font-medium tracking-tight truncate">{critical.title}</p>
                <p className="text-xs text-slate-400 mt-1 line-clamp-1">{critical.description}</p>
              </div>
            </div>
            <button 
              onClick={() => onSelectIssue(critical)}
              className="w-full py-4 bg-slate-900 text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95"
            >
              View Impact Details
            </button>
          </div>
        ) : (
          <div className="text-center py-10 bg-slate-50 rounded-[3rem] border border-slate-100 border-dashed">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">No Critical Alerts</p>
          </div>
        )}
      </section>

      <section>
        <div className="flex justify-between items-center mb-8 px-2">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Nearby Issues</h3>
          <span className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-widest underline decoration-slate-100 underline-offset-4">{issues.length} Active</span>
        </div>
        <div className="space-y-10">
          {issues.map(issue => (
            <div key={issue.id}>
              <IssueCard issue={issue} onClick={() => onSelectIssue(issue)} />
            </div>
          ))}
          {issues.length === 0 && (
            <div className="text-center text-slate-300 text-xs py-20">All clear in your community today.</div>
          )}
        </div>
      </section>
    </div>
  );
}

interface IssueCardProps {
  issue: Issue;
  onClick: () => void;
}

function IssueCard({ issue, onClick }: IssueCardProps) {
  return (
    <motion.div 
      whileHover={{ y: -6 }}
      onClick={onClick}
      className="group cursor-pointer"
    >
      <div className="bg-white border border-slate-100 rounded-[3rem] overflow-hidden shadow-minimal transition-all duration-500">
        <div className="aspect-[3/2] relative overflow-hidden">
          {issue.imageUrl && <img src={issue.imageUrl} className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700" alt={issue.title} />}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent opacity-60" />
          <div className="absolute top-6 right-6">
            <div className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest backdrop-blur-xl bg-white/20 text-white border border-white/30 truncate max-w-[80px]`}>
              {issue.status}
            </div>
          </div>
        </div>
        <div className="p-8">
          <div className="flex justify-between items-start mb-6 text-slate-900">
             <div className="max-w-[80%]">
                <h4 className="text-xl font-semibold leading-tight tracking-tight mb-2 truncate">{issue.title}</h4>
                <div className="flex items-center gap-2">
                  <MapPin size={12} className="text-slate-300" />
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-none">{issue.location}</span>
                </div>
             </div>
             <div className="flex flex-col items-center">
                <div className="text-lg font-light tracking-tighter">{issue.votes || 0}</div>
                <div className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Votes</div>
             </div>
          </div>
          <div className="flex items-center justify-between pt-6 border-t border-slate-50">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-900">
                  {issue.reporterAvatar || 'U'}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{issue.reporterName || 'User'}</span>
             </div>
             <div className="px-4 py-2 bg-slate-50 rounded-full text-[9px] font-bold uppercase tracking-widest text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                Verify Report
             </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function PostScreen({ onBack, onSubmit }: { onBack: () => void; onSubmit: (data: Partial<Issue>) => void }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('Water');

  return (
    <div className="px-6 py-10 min-h-full bg-white">
      <nav className="flex justify-between items-center mb-12">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl border border-slate-100 flex items-center justify-center text-slate-900">
          <ArrowLeft size={18} />
        </button>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-900">New Report</div>
        <div className="w-10" />
      </nav>

      <div className="space-y-8">
        <div>
          <h1 className="text-5xl font-light tracking-tighter text-slate-900 mb-8 leading-[0.9]">Tell your <br/>community.</h1>
          
          <label className="block mb-6 cursor-pointer group">
            <div className="w-full aspect-video bg-slate-50 border border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 group-hover:bg-slate-100 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400 group-hover:text-slate-900 transition-colors">
                <Camera size={24} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Capture Evidence</span>
            </div>
          </label>

          <div className="space-y-6">
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What is the issue?"
              className="w-full text-xl font-medium tracking-tight border-b-2 border-slate-100 focus:border-slate-900 outline-none transition-colors placeholder:text-slate-200 py-2"
            />
            
            <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
              {['Water', 'Road', 'Safe', 'Clean', 'Other'].map(c => (
                <button 
                  key={c} 
                  onClick={() => setCat(c)}
                  className={`px-5 py-2 whitespace-nowrap border rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${cat === c ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-900 hover:text-slate-900'}`}
                >
                  {c}
                </button>
              ))}
            </div>

            <textarea 
              rows={4}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Brief description..."
              className="w-full text-slate-500 leading-relaxed border-b-2 border-slate-100 pb-4 focus:border-slate-900 outline-none transition-colors placeholder:text-slate-200 resize-none"
            />
          </div>
        </div>

        <button 
          onClick={() => onSubmit({ title, description: desc, category: cat, location: 'Koramangala, BLR', imageUrl: 'https://images.unsplash.com/photo-1542013936693-884638332954?auto=format&fit=crop&q=80&w=800' })}
          className="w-full py-6 bg-slate-900 text-white rounded-[2.5rem] font-bold text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 mt-10"
        >
          Submit Report
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

function DetailScreen({ issue, onBack, onVote }: { issue: Issue; onBack: () => void; onVote: () => void }) {
  return (
    <div className="h-full flex flex-col bg-slate-50">
       <div className="relative h-2/5 shrink-0">
          {issue.imageUrl && <img src={issue.imageUrl} className="w-full h-full object-cover" alt="" />}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-transparent" />
          <button 
            onClick={onBack}
            className="absolute top-10 left-6 w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="absolute top-10 right-6">
            <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md bg-white border border-white text-slate-900 shadow-xl`}>
              {issue.status}
            </div>
          </div>
       </div>

       <div className="flex-1 bg-white -mt-12 rounded-t-[3rem] p-8 space-y-8 overflow-y-auto no-scrollbar relative z-10">
          <div className="flex justify-between items-start">
            <div className="max-w-[70%]">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{issue.category}</div>
              <h1 className="text-3xl font-semibold tracking-tight leading-tight">{issue.title}</h1>
            </div>
            <div className="text-right">
              <div className="text-2xl font-light tracking-tighter text-slate-900 leading-none">{issue.votes || 0}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Neighbors</div>
            </div>
          </div>

          <div className="flex items-center gap-4 p-5 bg-slate-50 border border-slate-100 rounded-3xl">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-900 font-bold">
              {issue.reporterAvatar || 'U'}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold mb-1">{issue.reporterName || 'User'} <span className="text-[10px] text-slate-400 font-normal uppercase tracking-widest ml-2">Level {issue.reporterLevel || 0}</span></div>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                   <div key={i} className={`w-3 h-0.5 rounded-full ${i < (issue.reporterLevel || 0) ? 'bg-slate-900' : 'bg-slate-200'}`} />
                 ))}
              </div>
            </div>
            <ShieldCheck size={20} className="text-blue-400" />
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Description</h3>
            <p className="text-slate-500 leading-relaxed text-sm">
              {issue.description}
            </p>
          </div>

          <div className="pt-6 border-t border-slate-50 flex gap-4">
            <button 
              onClick={onVote}
              className="flex-1 py-5 bg-slate-900 text-white rounded-3xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] transition-transform"
            >
              <ThumbsUp size={16} /> Still a problem
            </button>
            <button 
              className="w-16 h-16 rounded-3xl border border-slate-100 bg-white flex items-center justify-center text-slate-900 hover:bg-slate-50 transition-colors"
            >
              <MessageSquare size={20} />
            </button>
          </div>
       </div>
    </div>
  );
}

function NGODashboard({ issues, onDigitize }: { issues: Issue[]; onDigitize: () => void }) {
  const criticalCount = issues.filter(i => i.status === 'critical').length;
  const verifiedCount = issues.filter(i => i.status === 'verified').length;

  return (
    <div className="px-6 py-10 space-y-10">
      <header>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Impact Overview</div>
        <h2 className="text-2xl font-semibold tracking-tight leading-none mb-4">NGO Control Center</h2>
        <p className="text-[10px] font-medium text-slate-400 leading-relaxed max-w-[200px] mb-10">Solving the "Solution Challenge": Turning scattered data into community action.</p>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="p-6 bg-slate-900 rounded-[2.5rem] text-white">
            <div className="text-2xl font-light tracking-tighter mb-1">{String(criticalCount).padStart(2, '0')}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">Critical</div>
          </div>
          <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2.5rem]">
            <div className="text-2xl font-light tracking-tighter mb-1">{String(verifiedCount).padStart(2, '0')}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Verified</div>
          </div>
          <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2.5rem]">
            <div className="text-2xl font-light tracking-tighter mb-1">{String(issues.length).padStart(2, '0')}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Digitized</div>
          </div>
        </div>
      </header>

      <section className="bg-slate-50 p-8 rounded-[3rem] border border-slate-100 relative overflow-hidden">
        <div className="relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-900 mb-6">
            <Scan size={24} />
          </div>
          <h3 className="text-xl font-semibold tracking-tight mb-2">Sync Paper Surveys</h3>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">Found meaningful data in field reports? Use Gemini to digitize and unify scattered community needs instantly.</p>
          <button 
            onClick={onDigitize}
            className="w-full py-4 bg-slate-900 text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-lg"
          >
            Start Scan Process
            <Database size={14} className="text-blue-400" />
          </button>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100/30 blur-3xl rounded-full translate-x-10 -translate-y-10" />
      </section>

      <div className="space-y-6">
         <div className="flex justify-between items-center px-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Urgent Dispatch</h3>
            <ChevronRight size={14} className="text-slate-300" />
         </div>
         {issues.slice(0, 3).map(issue => (
           <div key={issue.id} className="flex items-center gap-5 group py-2">
              <div className="w-16 h-16 shrink-0 bg-slate-50 border border-slate-100 rounded-3xl overflow-hidden grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                {issue.imageUrl && <img src={issue.imageUrl} className="w-full h-full object-cover" alt="" />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold truncate group-hover:text-slate-900 transition-colors uppercase tracking-tight">{issue.title}</h4>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1">
                    <ThumbsUp size={10} className="text-slate-400" />
                    <span className="text-[10px] font-mono text-slate-400">{issue.votes}</span>
                  </div>
                  <div className="w-1 h-1 bg-slate-200 rounded-full" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">L{issue.reporterLevel} Verified</span>
                </div>
              </div>
              <button className="px-5 py-2.5 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all">
                Dispatch
              </button>
           </div>
         ))}
      </div>
      
      <div className="p-8 bg-slate-900 rounded-[3rem] text-white overflow-hidden relative">
        <div className="relative z-10">
          <TrendingUp className="text-blue-400 mb-4" size={24} />
          <h3 className="text-xl font-medium tracking-tight mb-2">Neighborhood Health</h3>
          <p className="text-xs text-blue-100/60 leading-relaxed mb-6">Action efficiency is up 12% this month. Trusted reporting is active.</p>
          <div className="flex items-center gap-2">
             <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: '75%' }} className="h-full bg-blue-400" />
             </div>
             <span className="text-[10px] font-mono font-bold tracking-widest">75%</span>
          </div>
        </div>
        <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-blue-500/20 blur-3xl rounded-full" />
      </div>
    </div>
  );
}

function DigitizeScreen({ currentUser, onBack, onComplete, triggerToast }: { currentUser: FirebaseUser | null; onBack: () => void; onComplete: () => void; triggerToast: (msg: string) => void }) {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDigitize = async () => {
    if (!image) return;
    setIsAnalyzing(true);
    try {
      const base64Data = image.split(',')[1];
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            parts: [
              { text: "This is a photo of a community survey or field report. Extract the key data into a structured JSON format. Identify the 'Primary Need', 'Location', 'Severity (1-5)', and 'Citizen Comment'. Be precise." },
              { inlineData: { data: base64Data, mimeType: 'image/jpeg' } }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              need: { type: Type.STRING },
              location: { type: Type.STRING },
              severity: { type: Type.NUMBER },
              comment: { type: Type.STRING }
            },
            required: ['need', 'location', 'severity']
          }
        }
      });

      // Handle potential markdown formatting from the AI
      const rawText = response.text || '{}';
      const jsonMatch = rawText.match(/```json\n?([\s\S]*?)\n?```/) || 
                       rawText.match(/```\n?([\s\S]*?)\n?```/);
      const cleanedText = jsonMatch ? jsonMatch[1] : rawText;
      
      const data = JSON.parse(cleanedText.trim());
      setResults(data);
    } catch (error) {
      console.error("Digitization failed:", error);
      triggerToast("Digitization failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSync = async () => {
    if (!currentUser || !results) return;
    try {
      await addDoc(collection(db, 'surveys'), {
        ...results,
        processedByUid: currentUser.uid,
        processedAt: serverTimestamp()
      });
      onComplete();
    } catch (e) {
      handleFirestoreError(e, 'create', 'surveys');
    }
  };

  return (
    <div className="px-6 py-10 min-h-full bg-white">
      <nav className="flex justify-between items-center mb-12">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl border border-slate-100 flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <div className="text-xs font-bold uppercase tracking-[0.2em]">Digitize Survey</div>
        <div className="w-10" />
      </nav>

      <div className="space-y-8">
        {!results ? (
          <>
            <div>
              <h1 className="text-5xl font-light tracking-tighter mb-8 leading-[0.9]">Capture the <br/><span className="font-medium">Unseen.</span></h1>
              <p className="text-slate-400 text-sm leading-relaxed mb-10">Scan paper surveys to bring scattered community data into our global sync engine.</p>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-[4/5] bg-slate-50 border border-dashed border-slate-200 rounded-[3rem] overflow-hidden flex flex-col items-center justify-center cursor-pointer group hover:bg-slate-100 transition-all"
            >
              {image ? (
                <img src={image} className="w-full h-full object-cover grayscale opacity-80" alt="Survey" />
              ) : (
                <>
                  <div className="w-16 h-16 rounded-3xl bg-white shadow-sm flex items-center justify-center text-slate-400 group-hover:text-slate-900 transition-colors mb-4">
                    <Camera size={32} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Capture Paper Survey</span>
                </>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />

            <button 
              disabled={!image || isAnalyzing}
              onClick={handleDigitize}
              className="w-full py-6 bg-slate-900 text-white rounded-[2.5rem] font-bold text-xs uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={16} className="animate-spin text-blue-400" />
                  Analyzing with Gemini...
                </>
              ) : (
                <>
                  Extract Intelligence
                  <Scan size={16} />
                </>
              )}
            </button>
          </>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-10 text-center">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-100 shadow-minimal">
                <CheckCircle2 size={40} />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">Data Identified</h2>
              <p className="text-slate-400 text-xs font-mono mt-2 lowercase">SOURCE: PHYSICAL SURVEY 0942-X</p>
            </div>

            <div className="space-y-6">
              <ResultCard label="Identified Need" value={results.need} icon={<PlusCircle size={16} className="text-slate-400" />} />
              <ResultCard label="Location" value={results.location} icon={<MapPin size={16} className="text-slate-400" />} />
              <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem]">
                 <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Calculated Severity</span>
                    <span className="text-xl font-light tracking-tighter">{results.severity}/5</span>
                 </div>
                 <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(results.severity / 5) * 100}%` }} className="h-full bg-slate-900" />
                 </div>
              </div>
              {results.comment && <ResultCard label="Citizen Feedback" value={results.comment} icon={<MessageSquare size={16} className="text-slate-400" />} />}
            </div>

            <button 
              onClick={handleSync}
              className="w-full py-6 bg-slate-900 text-white rounded-[2.5rem] font-bold text-xs uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 mt-12"
            >
              Sync to Central Database
              <Database size={16} className="text-blue-400" />
            </button>
            <button onClick={() => setResults(null)} className="w-full py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Rescan Correct Document</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({ label, value, icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-minimal">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <div className="text-lg font-medium tracking-tight text-slate-900">{value}</div>
    </div>
  );
}

function ProfileScreen({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="px-6 py-10 space-y-12 pb-32">
      <header className="flex justify-between items-center">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-900">Profile</h2>
        <div className="flex gap-4">
           <button className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors">
              <Settings size={18} />
           </button>
           <button onClick={onLogout} className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-red-400 hover:red-600 transition-colors">
              <LogOut size={18} />
           </button>
        </div>
      </header>

      <div className="flex flex-col items-center text-center">
        <div className="w-32 h-32 rounded-[3.5rem] bg-slate-50 p-2 shadow-xl mb-6 flex items-center justify-center">
           <div className="w-full h-full rounded-[3rem] bg-slate-900 flex items-center justify-center text-white text-5xl font-light tracking-tighter">
              MK
           </div>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Meera Krishnan</h1>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-100 rounded-full">
           <Award size={14} className="text-slate-900" />
           <span className="text-[10px] font-bold uppercase tracking-widest">Level 3 Reporter</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem]">
          <div className="text-3xl font-light tracking-tighter mb-1">23</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Reports Filed</div>
        </div>
        <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem]">
          <div className="text-3xl font-light tracking-tighter mb-1">87</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Votes Cast</div>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 px-2">Achievements</h3>
        <div className="flex flex-wrap gap-3">
          {['First Report', 'Voter Prime', 'Civic Eye', 'Top 10%', 'Safe Guard'].map(badge => (
            <div key={badge} className="px-5 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-slate-900 shadow-sm flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
              {badge}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 px-2">Reputation Meter</h3>
        <div className="p-8 bg-slate-900 rounded-[3rem] text-white">
          <div className="flex justify-between items-end mb-6">
            <div>
              <div className="text-4xl font-light tracking-tighter mb-1">79.5</div>
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">Current Trust Score</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">Next Level At 130</div>
              <TrendingUp size={16} className="text-emerald-400 ml-auto" />
            </div>
          </div>
          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
             <motion.div initial={{ width: 0 }} animate={{ width: '61.5%' }} className="h-full bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
