import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Library, 
  BookOpen, 
  BarChart3, 
  Settings as SettingsIcon,
  Moon,
  Sun,
  Flame,
  Trophy
} from 'lucide-react';
import { Toaster } from './components/ui/sonner';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarFooter, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem,
  SidebarProvider 
} from './components/ui/sidebar';
import { UploadExams } from './components/UploadExams';
import { ExamLibrary } from './components/ExamLibrary';
import { ExamDetail } from './components/ExamDetail';
import { CourseOverview } from './components/CourseOverview';
import { Analytics } from './components/Analytics';
import { Settings } from './components/Settings';
import { Exam, Question, UserSettings, UserProgress } from './types/exam';
import { saveExams, loadExams, saveSettings, loadSettings, saveProgress, loadProgress } from './utils/storage';
import { generateMockExams } from './utils/mockData';

type View = 'upload' | 'library' | 'detail' | 'courses' | 'analytics' | 'settings';

export default function App() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [currentView, setCurrentView] = useState<View>('library');
  const [settings, setSettings] = useState<UserSettings>({
    theme: 'light',
    language: 'sv',
    fontSize: 16,
    compactView: false
  });
  const [progress, setProgress] = useState<UserProgress>({
    totalXP: 0,
    level: 0,
    currentStreak: 0,
    longestStreak: 0,
    badges: []
  });

  // Load data on mount
  useEffect(() => {
    const loadedExams = loadExams();
    const loadedSettings = loadSettings();
    const loadedProgress = loadProgress();

    // If no exams exist, create mock data for demo
    if (loadedExams.length === 0) {
      const mockExams = generateMockExams(8);
      setExams(mockExams);
      saveExams(mockExams);
    } else {
      setExams(loadedExams);
    }

    setSettings(loadedSettings);
    setProgress(loadedProgress);

    // Apply theme
    if (loadedSettings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    }

    // Apply font size
    document.documentElement.style.setProperty('--font-size', `${loadedSettings.fontSize}px`);
  }, []);

  // Save exams when they change
  useEffect(() => {
    if (exams.length > 0) {
      saveExams(exams);
    }
  }, [exams]);

  const handleExamsUploaded = (newExams: Exam[]) => {
    setExams(prev => [...prev, ...newExams]);
    setCurrentView('library');
  };

  const handleExamClick = (exam: Exam) => {
    setSelectedExam(exam);
    setCurrentView('detail');
  };

  const handleBackToLibrary = () => {
    setSelectedExam(null);
    setCurrentView('library');
  };

  const handleUpdateQuestion = (examId: string, questionId: string, updates: Partial<Question>) => {
    setExams(prev => prev.map(exam => {
      if (exam.id === examId) {
        return {
          ...exam,
          questions: exam.questions.map(q => 
            q.id === questionId ? { ...q, ...updates } : q
          )
        };
      }
      return exam;
    }));

    // Update selected exam if it's the current one
    if (selectedExam?.id === examId) {
      setSelectedExam(prev => prev ? {
        ...prev,
        questions: prev.questions.map(q => 
          q.id === questionId ? { ...q, ...updates } : q
        )
      } : null);
    }

    // Update XP and streak
    if (updates.status === 'solved') {
      const newXP = progress.totalXP + 10;
      const newLevel = Math.floor(newXP / 100);
      const newProgress = {
        ...progress,
        totalXP: newXP,
        level: newLevel,
        currentStreak: progress.currentStreak + 1,
        longestStreak: Math.max(progress.longestStreak, progress.currentStreak + 1),
        lastStudyDate: new Date()
      };
      setProgress(newProgress);
      saveProgress(newProgress);
    }
  };

  const handleSettingsChange = (newSettings: UserSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleClearData = () => {
    setExams([]);
    setProgress({ totalXP: 0, level: 0, currentStreak: 0, longestStreak: 0, badges: [] });
    localStorage.clear();
  };

  const toggleTheme = () => {
    const newTheme = settings.theme === 'light' ? 'dark' : 'light';
    const newSettings = { ...settings, theme: newTheme };
    setSettings(newSettings);
    saveSettings(newSettings);
    
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const menuItems = [
    { id: 'library' as View, label: 'Tentabibliotek', icon: Library },
    { id: 'upload' as View, label: 'Ladda upp', icon: Upload },
    { id: 'courses' as View, label: 'Kursöversikt', icon: BookOpen },
    { id: 'analytics' as View, label: 'Statistik', icon: BarChart3 },
    { id: 'settings' as View, label: 'Inställningar', icon: SettingsIcon }
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <SidebarHeader>
            <div className="p-4">
              <h2 className="flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-primary" />
                ExamTracker
              </h2>
            </div>
          </SidebarHeader>
          
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => {
                          setCurrentView(item.id);
                          if (item.id !== 'detail') {
                            setSelectedExam(null);
                          }
                        }}
                        isActive={currentView === item.id}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Framsteg</SidebarGroupLabel>
              <SidebarGroupContent>
                <div className="px-4 py-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-warning" />
                      <span className="text-sm">Nivå</span>
                    </div>
                    <Badge className="bg-warning/10 text-warning border-warning/20">Level {progress.level}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-primary" />
                      <span className="text-sm">XP</span>
                    </div>
                    <Badge className="bg-primary/10 text-primary border-primary/20">{progress.totalXP}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-danger" />
                      <span className="text-sm">Streak</span>
                    </div>
                    <Badge className="bg-success/10 text-success border-success/20">{progress.currentStreak} dagar</Badge>
                  </div>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          
          <SidebarFooter>
            <div className="p-4 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={toggleTheme}
              >
                {settings.theme === 'light' ? (
                  <>
                    <Moon className="w-4 h-4 mr-2" />
                    Mörkt läge
                  </>
                ) : (
                  <>
                    <Sun className="w-4 h-4 mr-2" />
                    Ljust läge
                  </>
                )}
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6 max-w-7xl">
            {currentView === 'upload' && (
              <UploadExams onExamsUploaded={handleExamsUploaded} />
            )}

            {currentView === 'library' && (
              <ExamLibrary exams={exams} onExamClick={handleExamClick} />
            )}

            {currentView === 'detail' && selectedExam && (
              <ExamDetail
                exam={selectedExam}
                onBack={handleBackToLibrary}
                onUpdateQuestion={(questionId, updates) => 
                  handleUpdateQuestion(selectedExam.id, questionId, updates)
                }
              />
            )}

            {currentView === 'courses' && (
              <CourseOverview exams={exams} />
            )}

            {currentView === 'analytics' && (
              <Analytics exams={exams} />
            )}

            {currentView === 'settings' && (
              <Settings
                settings={settings}
                onSettingsChange={handleSettingsChange}
                onClearData={handleClearData}
              />
            )}
          </div>
        </main>
      </div>
      
      <Toaster />
    </SidebarProvider>
  );
}
