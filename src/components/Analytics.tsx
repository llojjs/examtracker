import React, { useMemo } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trophy, Award, Lock, Star, Target, Zap, BookOpen, Flame, CheckCircle2 } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Exam, Badge as BadgeType } from '../types/exam';
import { loadProgress } from '../utils/storage';

interface AnalyticsProps {
  exams: Exam[];
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))'
];

export function Analytics({ exams }: AnalyticsProps) {
  const progress = loadProgress();
  
  // Calculate level based on XP (100 XP per level)
  const currentLevel = Math.floor(progress.totalXP / 100);
  const xpForNextLevel = (currentLevel + 1) * 100;
  const xpInCurrentLevel = progress.totalXP % 100;
  const levelProgress = (xpInCurrentLevel / 100) * 100;

  // Define all possible badges
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
      id: 'streak-3',
      name: '3-dagars streak',
      description: 'Studera 3 dagar i rad',
      icon: '🔥',
    },
    {
      id: 'streak-7',
      name: 'Veckostreak',
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
  ], []);

  // Check which badges are unlocked
  const unlockedBadges = useMemo(() => {
    const unlocked: string[] = [];
    const totalQuestions = exams.reduce((sum, exam) => sum + exam.questions.length, 0);
    const solvedQuestions = exams.reduce((sum, exam) => 
      sum + exam.questions.filter(q => q.status === 'solved').length, 0
    );
    const totalTime = exams.reduce((sum, exam) => 
      sum + exam.questions.reduce((qSum, q) => qSum + (q.timeSpent || 0), 0), 0
    );

    if (exams.length > 0) unlocked.push('first-exam');
    if (solvedQuestions > 0) unlocked.push('first-solve');
    if (progress.longestStreak >= 3) unlocked.push('streak-3');
    if (progress.longestStreak >= 7) unlocked.push('streak-7');
    if (progress.longestStreak >= 30) unlocked.push('streak-30');
    if (solvedQuestions >= 10) unlocked.push('solver-10');
    if (solvedQuestions >= 50) unlocked.push('solver-50');
    if (solvedQuestions >= 100) unlocked.push('solver-100');
    if (currentLevel >= 5) unlocked.push('level-5');
    if (currentLevel >= 10) unlocked.push('level-10');
    if (currentLevel >= 20) unlocked.push('level-20');
    if (totalTime >= 600) unlocked.push('time-10h');

    return unlocked;
  }, [exams, progress, currentLevel]);

  const statusData = useMemo(() => {
    const counts = {
      'not-started': 0,
      'in-progress': 0,
      'solved': 0,
      'review': 0
    };

    exams.forEach(exam => {
      exam.questions.forEach(q => {
        counts[q.status]++;
      });
    });

    return [
      { name: 'Ej påbörjad', value: counts['not-started'], color: '#6b7280' },
      { name: 'Pågår', value: counts['in-progress'], color: '#21498A' },
      { name: 'Löst', value: counts['solved'], color: '#22946E' },
      { name: 'Repetera', value: counts['review'], color: '#A87A2A' }
    ].filter(item => item.value > 0);
  }, [exams]);

  const difficultyData = useMemo(() => {
    const counts = {
      'easy': 0,
      'medium': 0,
      'hard': 0,
      'very-hard': 0
    };

    exams.forEach(exam => {
      exam.questions.forEach(q => {
        if (q.difficulty) {
          counts[q.difficulty]++;
        }
      });
    });

    return [
      { name: 'Lätt', value: counts.easy },
      { name: 'Medel', value: counts.medium },
      { name: 'Svår', value: counts.hard },
      { name: 'Mycket svår', value: counts['very-hard'] }
    ].filter(item => item.value > 0);
  }, [exams]);

  const themeData = useMemo(() => {
    const themeCounts = new Map<string, number>();

    exams.forEach(exam => {
      exam.questions.forEach(q => {
        q.theme.forEach(theme => {
          themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
        });
      });
    });

    return Array.from(themeCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [exams]);

  const progressOverTime = useMemo(() => {
    // Group exams by month
    const monthlyData = new Map<string, { total: number; solved: number }>();

    exams.forEach(exam => {
      const date = exam.examDate || exam.uploadDate;
      const monthKey = new Date(date).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short' });
      
      const existing = monthlyData.get(monthKey);
      const solved = exam.questions.filter(q => q.status === 'solved').length;
      
      if (existing) {
        existing.total += exam.questions.length;
        existing.solved += solved;
      } else {
        monthlyData.set(monthKey, {
          total: exam.questions.length,
          solved
        });
      }
    });

    return Array.from(monthlyData.entries())
      .map(([month, data]) => ({
        month,
        'Lösta uppgifter': data.solved,
        'Totalt uppgifter': data.total
      }))
      .slice(-6); // Last 6 months
  }, [exams]);

  const courseDistribution = useMemo(() => {
    const courseCounts = new Map<string, number>();

    exams.forEach(exam => {
      courseCounts.set(exam.courseCode, (courseCounts.get(exam.courseCode) || 0) + 1);
    });

    return Array.from(courseCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [exams]);

  const totalQuestions = exams.reduce((sum, exam) => sum + exam.questions.length, 0);
  const solvedQuestions = exams.reduce((sum, exam) => 
    sum + exam.questions.filter(q => q.status === 'solved').length, 0
  );
  const totalTime = exams.reduce((sum, exam) => 
    sum + exam.questions.reduce((qSum, q) => qSum + (q.timeSpent || 0), 0), 0
  );

  return (
    <div className="space-y-6">
      <div>
        <h2>Analys & Statistik</h2>
        <p className="text-muted-foreground mt-2">
          Översikt över dina studier och framsteg
        </p>
      </div>

      {/* Level & XP Card */}
      <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-6 h-6 text-primary" />
              <h3>Nivå {currentLevel}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {xpInCurrentLevel} / 100 XP till nästa nivå
            </p>
          </div>
          <Badge className="text-lg px-4 py-2 bg-primary">{progress.totalXP} XP</Badge>
        </div>
        <Progress value={levelProgress} className="h-3" />
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="text-center p-3 bg-background/50 rounded-lg">
            <Flame className="w-5 h-5 text-danger mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Nuvarande streak</p>
            <p className="text-xl">{progress.currentStreak} dagar</p>
          </div>
          <div className="text-center p-3 bg-background/50 rounded-lg">
            <Award className="w-5 h-5 text-warning mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Upplåsta badges</p>
            <p className="text-xl">{unlockedBadges.length}/{allBadges.length}</p>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground mb-1">Totalt uppgifter</p>
          <p className="text-3xl">{totalQuestions}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground mb-1">Lösta uppgifter</p>
          <p className="text-3xl text-success">{solvedQuestions}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {totalQuestions > 0 ? Math.round((solvedQuestions / totalQuestions) * 100) : 0}% klart
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground mb-1">Total studietid</p>
          <p className="text-3xl">
            {Math.floor(totalTime / 60)}h {totalTime % 60}min
          </p>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="badges">
        <TabsList>
          <TabsTrigger value="badges">Badges</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="themes">Ämnen</TabsTrigger>
          <TabsTrigger value="difficulty">Svårighetsgrad</TabsTrigger>
          <TabsTrigger value="progress">Framsteg</TabsTrigger>
          <TabsTrigger value="courses">Kurser</TabsTrigger>
        </TabsList>

        <TabsContent value="badges">
          <Card className="p-6">
            <h3 className="mb-6">Achievements & Badges</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {allBadges.map(badge => {
                const isUnlocked = unlockedBadges.includes(badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`p-4 rounded-lg border-2 text-center transition-all ${
                      isUnlocked
                        ? 'bg-primary/5 border-primary/30 hover:border-primary/50'
                        : 'bg-muted/30 border-muted opacity-50'
                    }`}
                  >
                    <div className={`text-4xl mb-2 ${!isUnlocked && 'grayscale'}`}>
                      {isUnlocked ? badge.icon : <Lock className="w-10 h-10 mx-auto text-muted-foreground" />}
                    </div>
                    <p className={`font-medium mb-1 ${!isUnlocked && 'text-muted-foreground'}`}>
                      {badge.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {badge.description}
                    </p>
                    {isUnlocked && (
                      <Badge variant="outline" className="mt-2 text-xs bg-success/10 text-success border-success/30">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Upplåst
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="status">
          <Card className="p-6">
            <h3 className="mb-6">Uppgiftsfördelning per status</h3>
            {statusData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Ingen data tillgänglig</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="themes">
          <Card className="p-6">
            <h3 className="mb-6">Topp 10 vanligaste ämnen</h3>
            {themeData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Ingen data tillgänglig</p>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={themeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill={COLORS[0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="difficulty">
          <Card className="p-6">
            <h3 className="mb-6">Fördelning per svårighetsgrad</h3>
            {difficultyData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Ingen data tillgänglig</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={difficultyData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {difficultyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="progress">
          <Card className="p-6">
            <h3 className="mb-6">Framsteg över tid</h3>
            {progressOverTime.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Ingen data tillgänglig</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={progressOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Lösta uppgifter" stroke={COLORS[1]} strokeWidth={2} />
                  <Line type="monotone" dataKey="Totalt uppgifter" stroke={COLORS[0]} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="courses">
          <Card className="p-6">
            <h3 className="mb-6">Tentafördelning per kurs</h3>
            {courseDistribution.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Ingen data tillgänglig</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={courseDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill={COLORS[2]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
