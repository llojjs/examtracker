import React, { useMemo } from 'react';
import { Trophy, Award, Flame, Star, Lock, CheckCircle2, Sparkles, BookOpen, Clock, MessageSquare, FileText, Target, Zap } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { Badge as BadgeType, Exam } from '../types/exam';
import { loadProgress } from '../utils/storage';

interface LevelXPProps {
  exams: Exam[];
}

const motivationalQuotes = [
  "Consistency beats intensity",
  "Small steps lead to big changes",
  "Progress over perfection",
  "Every expert was once a beginner",
  "Study smart, not just hard",
  "Knowledge is power",
  "The secret to getting ahead is getting started",
  "Success is the sum of small efforts repeated daily"
];

export function LevelXP({ exams }: LevelXPProps) {
  const progress = loadProgress();
  
  // Calculate level and progress
  const currentLevel = progress.level;
  const xpForNextLevel = (currentLevel + 1) * 100;
  const xpInCurrentLevel = progress.totalXP % 100;
  const levelProgress = (xpInCurrentLevel / 100) * 100;
  
  const randomQuote = useMemo(() => 
    motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)],
    []
  );

  // Calculate stats
  const totalQuestions = exams.reduce((sum, exam) => sum + exam.questions.length, 0);
  const solvedQuestions = exams.reduce((sum, exam) => 
    sum + exam.questions.filter(q => q.status === 'solved').length, 0
  );
  const totalTime = exams.reduce((sum, exam) => 
    sum + exam.questions.reduce((qSum, q) => qSum + (q.timeSpent || 0), 0), 0
  );
  const totalNotes = exams.reduce((sum, exam) => 
    sum + exam.questions.filter(q => q.notes && q.notes.trim().length > 0).length, 0
  );

  // Define all badges
  const allBadges: BadgeType[] = useMemo(() => [
    {
      id: 'first-exam',
      name: 'Första tentan',
      description: 'Ladda upp din första tenta',
      icon: '📚',
    },
    {
      id: 'first-solve',
      name: 'Första lösningen',
      description: 'Lös din första uppgift',
      icon: '✅',
    },
    {
      id: 'pdf-master',
      name: 'PDF Master',
      description: 'Ladda upp 10 tentor',
      icon: '📄',
    },
    {
      id: 'streak-3',
      name: '3-dagars streak',
      description: 'Studera 3 dagar i rad',
      icon: '🔥',
    },
    {
      id: 'streak-7',
      name: 'Focused Learner',
      description: 'Studera 7 dagar i rad',
      icon: '⚡',
    },
    {
      id: 'streak-30',
      name: 'Månadsstreak',
      description: 'Studera 30 dagar i rad',
      icon: '🏆',
    },
    {
      id: 'note-taker',
      name: 'Note Taker',
      description: 'Skriv anteckningar på 20 uppgifter',
      icon: '📝',
    },
    {
      id: 'solver-10',
      name: 'Nybörjare',
      description: 'Lös 10 uppgifter',
      icon: '🌟',
    },
    {
      id: 'solver-50',
      name: 'Dedikerad',
      description: 'Lös 50 uppgifter',
      icon: '💪',
    },
    {
      id: 'solver-100',
      name: 'Expert',
      description: 'Lös 100 uppgifter',
      icon: '🎯',
    },
    {
      id: 'level-5',
      name: 'Nivå 5',
      description: 'Nå nivå 5',
      icon: '🥉',
    },
    {
      id: 'level-10',
      name: 'Nivå 10',
      description: 'Nå nivå 10',
      icon: '🥈',
    },
    {
      id: 'level-20',
      name: 'Nivå 20',
      description: 'Nå nivå 20',
      icon: '🥇',
    },
    {
      id: 'time-10h',
      name: '10 timmar',
      description: 'Studera i 10 timmar totalt',
      icon: '⏱️',
    },
    {
      id: 'time-50h',
      name: 'Tidsmästare',
      description: 'Studera i 50 timmar totalt',
      icon: '⌛',
    },
  ], []);

  // Check which badges are unlocked
  const unlockedBadgeIds = useMemo(() => {
    const unlocked: string[] = [];

    if (exams.length > 0) unlocked.push('first-exam');
    if (exams.length >= 10) unlocked.push('pdf-master');
    if (solvedQuestions > 0) unlocked.push('first-solve');
    if (progress.longestStreak >= 3) unlocked.push('streak-3');
    if (progress.longestStreak >= 7) unlocked.push('streak-7');
    if (progress.longestStreak >= 30) unlocked.push('streak-30');
    if (totalNotes >= 20) unlocked.push('note-taker');
    if (solvedQuestions >= 10) unlocked.push('solver-10');
    if (solvedQuestions >= 50) unlocked.push('solver-50');
    if (solvedQuestions >= 100) unlocked.push('solver-100');
    if (currentLevel >= 5) unlocked.push('level-5');
    if (currentLevel >= 10) unlocked.push('level-10');
    if (currentLevel >= 20) unlocked.push('level-20');
    if (totalTime >= 600) unlocked.push('time-10h');
    if (totalTime >= 3000) unlocked.push('time-50h');

    return unlocked;
  }, [exams, progress, currentLevel, solvedQuestions, totalNotes, totalTime]);

  return (
    <div className="space-y-6">
      <div>
        <h2>Level & XP</h2>
        <p className="text-muted-foreground mt-2">
          {randomQuote}
        </p>
      </div>

      {/* Level Card */}
      <Card className="p-8 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="flex items-center gap-2">
                Nivå {currentLevel}
                <Sparkles className="w-6 h-6 text-warning" />
              </h1>
              <p className="text-muted-foreground mt-1">
                {xpInCurrentLevel} / 100 XP till nivå {currentLevel + 1}
              </p>
            </div>
          </div>
          <Badge className="text-2xl px-6 py-3 bg-primary">
            {progress.totalXP} XP
          </Badge>
        </div>
        
        <Progress value={levelProgress} className="h-4" />
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6 text-center">
          <Flame className="w-8 h-8 text-danger mx-auto mb-2" />
          <p className="text-3xl">{progress.currentStreak}</p>
          <p className="text-sm text-muted-foreground mt-1">Nuvarande streak</p>
        </Card>
        <Card className="p-6 text-center">
          <Target className="w-8 h-8 text-success mx-auto mb-2" />
          <p className="text-3xl">{progress.longestStreak}</p>
          <p className="text-sm text-muted-foreground mt-1">Längsta streak</p>
        </Card>
        <Card className="p-6 text-center">
          <Award className="w-8 h-8 text-warning mx-auto mb-2" />
          <p className="text-3xl">{unlockedBadgeIds.length}/{allBadges.length}</p>
          <p className="text-sm text-muted-foreground mt-1">Badges upplåsta</p>
        </Card>
        <Card className="p-6 text-center">
          <Clock className="w-8 h-8 text-info mx-auto mb-2" />
          <p className="text-3xl">{Math.floor(totalTime / 60)}h</p>
          <p className="text-sm text-muted-foreground mt-1">Total studietid</p>
        </Card>
      </div>

      {/* XP Sources */}
      <Card className="p-6">
        <h3 className="mb-4">Hur du får XP</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-success" />
              <span>Lös en uppgift</span>
            </div>
            <Badge variant="secondary">+10 XP</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Award className="w-5 h-5 text-warning" />
              <span>Lås upp en badge</span>
            </div>
            <Badge variant="secondary">+50 XP</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Flame className="w-5 h-5 text-danger" />
              <span>Fortsätt din streak</span>
            </div>
            <Badge variant="secondary">+5 XP/dag</Badge>
          </div>
        </div>
      </Card>

      <Separator />

      {/* Badges */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3>Achievements & Badges</h3>
          <Badge variant="outline">
            {unlockedBadgeIds.length} / {allBadges.length} upplåsta
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {allBadges.map(badge => {
            const isUnlocked = unlockedBadgeIds.includes(badge.id);
            return (
              <Card
                key={badge.id}
                className={`p-4 text-center transition-all hover:scale-105 ${
                  isUnlocked
                    ? 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30'
                    : 'bg-muted/30 border-muted opacity-60'
                }`}
              >
                <div className={`text-5xl mb-3 ${!isUnlocked && 'grayscale'}`}>
                  {isUnlocked ? (
                    badge.icon
                  ) : (
                    <Lock className="w-12 h-12 mx-auto text-muted-foreground" />
                  )}
                </div>
                <p className={`font-medium mb-1 ${!isUnlocked && 'text-muted-foreground'}`}>
                  {badge.name}
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  {badge.description}
                </p>
                {isUnlocked && (
                  <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Upplåst
                  </Badge>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Motivational Section */}
      <Card className="p-6 bg-gradient-to-r from-primary/5 to-success/5 border-primary/20">
        <div className="flex items-start gap-4">
          <Star className="w-8 h-8 text-warning flex-shrink-0" />
          <div>
            <h3 className="mb-2">Keep going! 💪</h3>
            <p className="text-muted-foreground">
              Du har löst {solvedQuestions} uppgifter och studerat i {Math.floor(totalTime / 60)} timmar. 
              {solvedQuestions < 10 && " Fortsätt så här för att låsa upp din första badge!"}
              {solvedQuestions >= 10 && solvedQuestions < 50 && " Du är på god väg mot 'Dedikerad'-badgen!"}
              {solvedQuestions >= 50 && " Du är en riktigt dedikerad student!"}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
