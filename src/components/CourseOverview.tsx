import React, { useMemo } from 'react';
import { BookOpen, Trophy, Clock, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Exam, CourseStats } from '../types/exam';

interface CourseOverviewProps {
  exams: Exam[];
}

export function CourseOverview({ exams }: CourseOverviewProps) {
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
          averageDifficulty: 0, // Could calculate from difficulty values
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

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins > 0 ? `${mins}min` : ''}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2>Kursöversikt</h2>
        <p className="text-muted-foreground mt-2">
          Statistik och framsteg för alla kurser
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

                {/* Common Themes */}
                <Card className="p-6">
                  <h4 className="mb-4">Vanligaste ämnen</h4>
                  
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
