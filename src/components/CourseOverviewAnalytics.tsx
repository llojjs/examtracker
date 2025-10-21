import React, { useMemo } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BookOpen, Trophy, Clock, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Exam, CourseStats } from '../types/exam';

interface CourseOverviewAnalyticsProps {
  exams: Exam[];
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))'
];

export function CourseOverviewAnalytics({ exams }: CourseOverviewAnalyticsProps) {
  const courseStats = useMemo(() => {
    const statsByCode = new Map<string, CourseStats>();

    exams.forEach(exam => {
      const existing = statsByCode.get(exam.courseCode);
      
      if (existing) {
        existing.totalExams++;
        existing.totalQuestions += exam.questions.length;
        existing.solvedQuestions += exam.questions.filter(q => q.status === 'solved').length;
        
        // Aggregate themes
        exam.questions.forEach(q => {
          q.theme.forEach(theme => {
            const themeEntry = existing.commonThemes.find(t => t.theme === theme);
            if (themeEntry) {
              themeEntry.count++;
            } else {
              existing.commonThemes.push({ theme, count: 1 });
            }
          });
        });

        // Calculate time
        const timeSpent = exam.questions.reduce((sum, q) => sum + (q.timeSpent || 0), 0);
        existing.totalTimeSpent += timeSpent;
      } else {
        const themes = new Map<string, number>();
        exam.questions.forEach(q => {
          q.theme.forEach(theme => {
            themes.set(theme, (themes.get(theme) || 0) + 1);
          });
        });

        const commonThemes = Array.from(themes.entries()).map(([theme, count]) => ({ theme, count }));
        const timeSpent = exam.questions.reduce((sum, q) => sum + (q.timeSpent || 0), 0);

        statsByCode.set(exam.courseCode, {
          courseCode: exam.courseCode,
          courseName: exam.courseName,
          totalExams: 1,
          totalQuestions: exam.questions.length,
          solvedQuestions: exam.questions.filter(q => q.status === 'solved').length,
          commonThemes,
          averageDifficulty: 0,
          totalTimeSpent: timeSpent
        });
      }
    });

    // Sort themes by count
    statsByCode.forEach(stats => {
      stats.commonThemes.sort((a, b) => b.count - a.count);
    });

    return Array.from(statsByCode.values()).sort((a, b) => 
      b.totalExams - a.totalExams
    );
  }, [exams]);

  // Generate course-specific analytics data
  const getCourseAnalytics = (courseCode: string) => {
    const courseExams = exams.filter(exam => exam.courseCode === courseCode);

    // Status data
    const statusData = (() => {
      const counts = {
        'not-started': 0,
        'in-progress': 0,
        'solved': 0,
        'review': 0
      };

      courseExams.forEach(exam => {
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
    })();

    // Difficulty data
    const difficultyData = (() => {
      const counts = {
        'easy': 0,
        'medium': 0,
        'hard': 0,
        'very-hard': 0
      };

      courseExams.forEach(exam => {
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
    })();

    // Theme data (top 10)
    const themeData = (() => {
      const themeCounts = new Map<string, number>();

      courseExams.forEach(exam => {
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
    })();

    // Progress over time
    const progressOverTime = (() => {
      const monthlyData = new Map<string, { total: number; solved: number }>();

      courseExams.forEach(exam => {
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
    })();

    return { statusData, difficultyData, themeData, progressOverTime };
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins > 0 ? `${mins}min` : ''}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2>Kursöversikt & Statistik</h2>
        <p className="text-muted-foreground mt-2">
          Detaljerad statistik och framsteg för varje kurs
        </p>
      </div>

      {courseStats.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            Inga kurser ännu. Ladda upp tentor för att börja!
          </p>
        </Card>
      ) : (
        <Tabs defaultValue={courseStats[0]?.courseCode}>
          <TabsList className="flex-wrap h-auto">
            {courseStats.map(stats => (
              <TabsTrigger key={stats.courseCode} value={stats.courseCode}>
                {stats.courseCode}
              </TabsTrigger>
            ))}
          </TabsList>

          {courseStats.map(stats => {
            const progress = stats.totalQuestions > 0 
              ? (stats.solvedQuestions / stats.totalQuestions) * 100 
              : 0;
            
            const analytics = getCourseAnalytics(stats.courseCode);

            return (
              <TabsContent key={stats.courseCode} value={stats.courseCode} className="space-y-6">
                {/* Header */}
                <div>
                  <h3>{stats.courseName}</h3>
                  <p className="text-muted-foreground mt-1">
                    {stats.courseCode}
                  </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-success" />
                      </div>
                      <div>
                        <p className="text-2xl">{stats.totalExams}</p>
                        <p className="text-sm text-muted-foreground">Tentor</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-success" />
                      </div>
                      <div>
                        <p className="text-2xl">{stats.solvedQuestions}/{stats.totalQuestions}</p>
                        <p className="text-sm text-muted-foreground">Lösta uppgifter</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-info" />
                      </div>
                      <div>
                        <p className="text-2xl">{formatTime(stats.totalTimeSpent)}</p>
                        <p className="text-sm text-muted-foreground">Total tid</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl">{Math.round(progress)}%</p>
                        <p className="text-sm text-muted-foreground">Framsteg</p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Progress Bar */}
                <Card className="p-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h4>Övergripande framsteg</h4>
                      <span className="text-sm text-muted-foreground">
                        {stats.solvedQuestions} av {stats.totalQuestions} uppgifter lösta
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                </Card>

                {/* Analytics Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Status Distribution */}
                  <Card className="p-6">
                    <h4 className="mb-6">Uppgiftsfördelning per status</h4>
                    {analytics.statusData.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">Ingen data tillgänglig</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={analytics.statusData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {analytics.statusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </Card>

                  {/* Difficulty Distribution */}
                  <Card className="p-6">
                    <h4 className="mb-6">Fördelning per svårighetsgrad</h4>
                    {analytics.difficultyData.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">Ingen data tillgänglig</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={analytics.difficultyData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {analytics.difficultyData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </Card>
                </div>

                {/* Theme Bar Chart */}
                {analytics.themeData.length > 0 && (
                  <Card className="p-6">
                    <h4 className="mb-6">Vanligaste ämnen</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.themeData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill={COLORS[0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                )}

                {/* Progress Over Time */}
                {analytics.progressOverTime.length > 0 && (
                  <Card className="p-6">
                    <h4 className="mb-6">Framsteg över tid</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={analytics.progressOverTime}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="Lösta uppgifter" stroke={COLORS[1]} strokeWidth={2} />
                        <Line type="monotone" dataKey="Totalt uppgifter" stroke={COLORS[0]} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                )}

                {/* Common Themes Detail */}
                <Card className="p-6">
                  <h4 className="mb-4">Ämnesfördelning i detalj</h4>
                  
                  {stats.commonThemes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Inga ämnen identifierade än</p>
                  ) : (
                    <div className="space-y-3">
                      {stats.commonThemes.slice(0, 10).map(({ theme, count }) => {
                        const percentage = (count / stats.totalQuestions) * 100;
                        return (
                          <div key={theme}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm">{theme}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                  {count} {count === 1 ? 'gång' : 'gånger'}
                                </span>
                                <Badge variant="secondary" className="text-xs">
                                  {Math.round(percentage)}%
                                </Badge>
                              </div>
                            </div>
                            <Progress value={percentage} className="h-1.5" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

                {/* Study Recommendations */}
                <Card className="p-6 bg-primary/5 border-primary/20">
                  <div className="flex gap-3">
                    <Trophy className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="mb-2">Rekommendationer</h4>
                      <ul className="space-y-2 text-sm">
                        {stats.solvedQuestions < stats.totalQuestions / 2 && (
                          <li>• Du är halvvägs! Fortsätt öva på de återstående uppgifterna.</li>
                        )}
                        {stats.commonThemes.length > 0 && (
                          <li>• Fokusera på <strong>{stats.commonThemes[0].theme}</strong> - det är det vanligaste ämnet.</li>
                        )}
                        {stats.totalTimeSpent > 0 && stats.solvedQuestions > 0 && (
                          <li>
                            • Genomsnittlig tid per uppgift: {formatTime(Math.round(stats.totalTimeSpent / stats.solvedQuestions))}
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
