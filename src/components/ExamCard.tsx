import React from 'react';
import { FileText, Calendar, Award, CheckCircle2, Clock } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Exam } from '../types/exam';

interface ExamCardProps {
  exam: Exam;
  onClick: () => void;
  compact?: boolean;
  actions?: React.ReactNode;
}

export function ExamCard({ exam, onClick, compact = false, actions }: ExamCardProps) {
  const solvedCount = exam.questions.filter(q => q.status === 'solved').length;
  const totalCount = exam.questions.length;
  const progressPercent = totalCount > 0 ? (solvedCount / totalCount) * 100 : 0;
  
  const totalTimeSpent = exam.questions.reduce((sum, q) => sum + (q.timeSpent || 0), 0);

  const formatDate = (date?: Date) => {
    if (!date) return 'Okänt datum';
    return new Date(date).toLocaleDateString('sv-SE', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (minutes: number) => {
    if (minutes === 0) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}min`;
    return `${hours}h ${mins}min`;
  };

  return (
    <Card 
      className="p-4 hover:shadow-md transition-shadow cursor-pointer relative"
      onClick={onClick}
    >
      {actions && (
        <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-success" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h4 className="truncate">{exam.courseCode}</h4>
              <p className="text-sm text-muted-foreground truncate">
                {exam.courseName}
              </p>
            </div>
            
            {exam.totalPoints && (
              <Badge variant="secondary" className="flex-shrink-0">
                <Award className="w-3 h-3 mr-1" />
                {exam.totalPoints}p
              </Badge>
            )}
          </div>

          {!compact && (
            <>
              <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground mb-3">
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="whitespace-nowrap">{formatDate(exam.examDate)}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="whitespace-nowrap">{solvedCount}/{totalCount} uppgifter</span>
                </div>
                {totalTimeSpent > 0 && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span className="whitespace-nowrap">{formatTime(totalTimeSpent)}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Framsteg</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <Progress value={progressPercent} className="h-1.5" />
              </div>

              {exam.tags && exam.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {exam.tags.slice(0, 3).map((tag, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {exam.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{exam.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
