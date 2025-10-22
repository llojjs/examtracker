import React, { useState, useMemo } from 'react';
import { ArrowLeft, FileText, ChevronRight, Clock, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { Progress } from './ui/progress';
import { QuestionDetail } from './QuestionDetail';
import { Exam, Question } from '../types/exam';

interface ExamDetailProps {
  exam: Exam;
  onBack: () => void;
  onUpdateQuestion: (questionId: string, updates: Partial<Question>) => void;
  onAddQuestion: (partial?: Partial<Question>) => void;
}

const statusColors: Record<string, string> = {
  'not-started': 'bg-gray-500',
  'in-progress': 'bg-info',
  'solved': 'bg-success',
  'review': 'bg-warning',
};

const statusLabels: Record<string, string> = {
  'not-started': 'Ej påbörjad',
  'in-progress': 'Pågår',
  'solved': 'Löst',
  'review': 'Repetera',
};

export function ExamDetailView({ exam, onBack, onUpdateQuestion, onAddQuestion }: ExamDetailProps) {
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);

  const formatDate = (date?: Date) => {
    if (!date) return 'Okänt datum';
    return new Date(date).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const totalTimeSpent = useMemo(
    () => exam.questions.reduce((sum, q) => sum + (q.timeSpent || 0), 0),
    [exam.questions]
  );
  const solvedCount = useMemo(
    () => exam.questions.filter((q) => q.status === 'solved').length,
    [exam.questions]
  );
  const progressPercent = useMemo(
    () => (exam.questions.length > 0 ? (solvedCount / exam.questions.length) * 100 : 0),
    [solvedCount, exam.questions.length]
  );

  const formatTotalTime = (minutes: number) => {
    if (minutes === 0) return '0 min';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} min`;
    return `${hours}h ${mins}min`;
  };

  const handleQuestionUpdate = (updates: Partial<Question>) => {
    if (selectedQuestion) {
      onUpdateQuestion(selectedQuestion.id, updates);
      setSelectedQuestion({ ...selectedQuestion, ...updates });
    }
  };

  const handleCheckboxToggle = (questionId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'solved' ? 'not-started' : 'solved';
    onUpdateQuestion(questionId, { status: newStatus });
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Tillbaka till kursens tentor
        </Button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1>
              {exam.courseCode} - {exam.courseName}
            </h1>
            <p className="text-muted-foreground mt-2">{formatDate(exam.examDate)}</p>

            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">
                  <span className="text-success">{solvedCount}</span> / {exam.questions.length} uppgifter klara
                </span>
                {totalTimeSpent > 0 && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <span className="text-muted-foreground">{formatTotalTime(totalTimeSpent)}</span>
                    </div>
                  </>
                )}
              </div>
              <Progress value={progressPercent} className="h-2 w-full max-w-md" />
            </div>
          </div>

          {typeof exam.totalPoints === 'number' && (
            <Badge variant="secondary" className="text-lg px-4 py-2 flex-shrink-0">
              {exam.totalPoints} poäng
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PDF Viewer */}
        <Card className="p-0 overflow-hidden h-[75vh] min-h-[520px]">
          {exam.fileUrl ? (
            <object
              data={exam.fileUrl}
              type="application/pdf"
              className="block w-full h-full"
            >
              <div className="p-6 text-center text-sm text-muted-foreground">
                Kunde inte bädda in PDF:en.
                <a
                  className="text-primary underline ml-1"
                  href={exam.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Öppna i ny flik
                </a>
              </div>
            </object>
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-muted">
              <div className="text-center p-6">
                <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Ingen PDF tillgänglig</p>
                <p className="text-sm text-muted-foreground mt-2">{exam.fileName}</p>
              </div>
            </div>
          )}
        </Card>

        {/* Questions List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3>Uppgifter ({exam.questions.length})</h3>
            <Button size="sm" onClick={() => onAddQuestion()}>
              <Plus className="w-4 h-4 mr-2" /> Lägg till uppgift
            </Button>
          </div>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-3">
              {exam.questions.length === 0 && (
                <Card className="p-4 text-sm text-muted-foreground">
                  Inga uppgifter hittades automatiskt. Använd knappen "Lägg till uppgift" för att lägga till manuellt.
                </Card>
              )}
              {exam.questions.map((question) => (
                <Card key={question.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 pt-1">
                      <Checkbox
                        checked={question.status === 'solved'}
                        onCheckedChange={() => handleCheckboxToggle(question.id, question.status)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedQuestion(question)}>
                      <div className="flex items-center gap-2 mb-2">
                        <h4>Uppgift {question.number}</h4>
                        <Badge className={`${statusColors[question.status]} text-white`} variant="secondary">
                          {statusLabels[question.status]}
                        </Badge>
                        <Badge variant="outline">{question.points}p</Badge>
                      </div>
                      {question.theme.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {question.theme.map((theme, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {theme}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {question.notes && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{question.notes}</p>
                      )}
                      {question.comments.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {question.comments.length} {question.comments.length === 1 ? 'kommentar' : 'kommentarer'}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 cursor-pointer" onClick={() => setSelectedQuestion(question)} />
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Question Detail Dialog */}
      <Dialog open={selectedQuestion !== null} onOpenChange={(open) => !open && setSelectedQuestion(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Uppgift {selectedQuestion?.number} - {exam.courseCode}</DialogTitle>
          </DialogHeader>
          {selectedQuestion && (
            <QuestionDetail question={selectedQuestion} onUpdate={handleQuestionUpdate} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
