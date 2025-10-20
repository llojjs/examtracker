import React, { useState } from 'react';
import { ChevronRight, ChevronDown, FolderOpen, Folder } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ExamCard } from './ExamCard';
import { Exam } from '../types/exam';

interface CourseFolderProps {
  courseCode: string;
  courseName: string;
  exams: Exam[];
  onExamClick: (exam: Exam) => void;
  compact?: boolean;
}

export function CourseFolder({ courseCode, courseName, exams, onExamClick, compact = false }: CourseFolderProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const totalQuestions = exams.reduce((sum, exam) => sum + exam.questions.length, 0);
  const solvedQuestions = exams.reduce((sum, exam) => 
    sum + exam.questions.filter(q => q.status === 'solved').length, 0
  );
  const progressPercent = totalQuestions > 0 ? (solvedQuestions / totalQuestions) * 100 : 0;

  return (
    <div className="space-y-2">
      <Card 
        className="p-4 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            )}
          </div>

          <div className="flex-shrink-0">
            {isExpanded ? (
              <FolderOpen className="w-6 h-6 text-primary" />
            ) : (
              <Folder className="w-6 h-6 text-primary" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4>{courseCode}</h4>
              <Badge variant="secondary">{exams.length} {exams.length === 1 ? 'tenta' : 'tentor'}</Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {courseName}
            </p>
          </div>

          <div className="flex-shrink-0 text-right">
            <div className="text-sm">
              <span className="text-success">{solvedQuestions}</span>
              <span className="text-muted-foreground">/{totalQuestions}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round(progressPercent)}% klart
            </p>
          </div>
        </div>
      </Card>

      {isExpanded && (
        <div className="ml-12 space-y-3">
          {exams.map(exam => (
            <ExamCard
              key={exam.id}
              exam={exam}
              onClick={() => onExamClick(exam)}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
}
