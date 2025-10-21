import React, { useMemo, useState } from 'react';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Question, Exam, ExamStatus, QuestionDifficulty } from '../types/exam';

interface ProblemsViewProps {
  exams: Exam[];
  onOpenExam: (exam: Exam) => void;
}

export function ProblemsView({ exams, onOpenExam }: ProblemsViewProps) {
  const [searchText, setSearchText] = useState('');
  const [topicText, setTopicText] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExamStatus | 'all'>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<QuestionDifficulty | 'all'>('all');

  const allRows = useMemo(() => {
    const rows: Array<{ exam: Exam; question: Question }> = [];
    exams.forEach(exam => {
      exam.questions.forEach(q => rows.push({ exam, question: q }));
    });
    return rows;
  }, [exams]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const t = topicText.trim().toLowerCase();

    return allRows.filter(({ exam, question }) => {
      if (statusFilter !== 'all' && question.status !== statusFilter) return false;
      if (difficultyFilter !== 'all' && question.difficulty !== difficultyFilter) return false;
      if (q) {
        const inFile = (exam.fileName || '').toLowerCase().includes(q);
        const inCourse = (exam.courseCode || '').toLowerCase().includes(q) || (exam.courseName || '').toLowerCase().includes(q);
        if (!inFile && !inCourse) return false;
      }
      if (t) {
        const inThemes = (question.theme || []).some(th => th.toLowerCase().includes(t));
        const inTags = (question.tags || []).some(tag => tag.toLowerCase().includes(t));
        if (!inThemes && !inTags) return false;
      }
      return true;
    });
  }, [allRows, searchText, topicText, statusFilter, difficultyFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <Input placeholder="Sök filnamn eller kurskod" value={searchText} onChange={(e) => setSearchText(e.target.value)} className="flex-1" />
        <Input placeholder="Sök topic (tema/tagg)" value={topicText} onChange={(e) => setTopicText(e.target.value)} className="flex-1" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="rounded-md border px-3 py-2">
          <option value="all">Alla statusar</option>
          <option value="not-started">Ej påbörjad</option>
          <option value="in-progress">Pågår</option>
          <option value="solved">Löst</option>
          <option value="review">Repetera</option>
        </select>
        <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value as any)} className="rounded-md border px-3 py-2">
          <option value="all">Alla svårigheter</option>
          <option value="easy">Lätt</option>
          <option value="medium">Medel</option>
          <option value="hard">Svår</option>
          <option value="very-hard">Mycket svår</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(({ exam, question }) => (
          <Card key={`${exam.id}-${question.id}`} className="p-3">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="truncate font-medium">{exam.courseCode} • {exam.fileName}</h4>
                  <Badge className="text-xs">{question.number}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1 truncate">{(question.theme || []).join(', ')}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span>Status: <strong className="ml-1">{question.status}</strong></span>
                  <span> • </span>
                  <span>Svårighet: <strong className="ml-1">{question.difficulty || '—'}</strong></span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Button onClick={() => onOpenExam(exam)} size="sm">Öppna tenta</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-muted-foreground">Inga uppgifter matchar filtren.</div>
      )}
    </div>
  );
}

export default ProblemsView;
