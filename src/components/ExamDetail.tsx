import React, { useState, useMemo } from 'react';
import { ArrowLeft, FileText, ChevronRight, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { QuestionDetail } from './QuestionDetail';
import { Exam, Question } from '../types/exam';

interface ExamDetailProps {
  exam: Exam;
  onBack: () => void;
  onUpdateQuestion: (questionId: string, updates: Partial<Question>) => void;
}

const statusColors: Record<string, string> = {
  'not-started': 'bg-gray-500',
  'in-progress': 'bg-info',
  'solved': 'bg-success',
  'review': 'bg-warning'
};

const statusLabels: Record<string, string> = {
  'not-started': 'Ej påbörjad',
  'in-progress': 'Pågår',
  'solved': 'Löst',
  'review': 'Repetera'
};

export function ExamDetail({ exam, onBack, onUpdateQuestion }: ExamDetailProps) {
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);

  const formatDate = (date?: Date) => {
    if (!date) return 'Okänt datum';
    return new Date(date).toLocaleDateString('sv-SE', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const totalTimeSpent = useMemo(() => {
    return exam.questions.reduce((sum, q) => sum + (q.timeSpent || 0), 0);
  }, [exam.questions]);

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
      // Update local state
      setSelectedQuestion({ ...selectedQuestion, ...updates });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Tillbaka till biblioteket
        </Button>
        
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1>{exam.courseCode} - {exam.courseName}</h1>
            <p className="text-muted-foreground mt-2">
              {formatDate(exam.examDate)}
            </p>
            {totalTimeSpent > 0 && (
              <div className="flex items-center gap-2 mt-3 text-sm">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Total tid:</span>
                <Badge variant="outline" className="gap-1">
                  {formatTotalTime(totalTimeSpent)}
                </Badge>
              </div>
            )}
          </div>
          
          {exam.totalPoints && (
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {exam.totalPoints} poäng
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PDF Viewer (Mock) */}
        <Card className="p-6">
          <div className="aspect-[8.5/11] bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border">
            <div className="text-center">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">PDF-visning</p>
              <p className="text-sm text-muted-foreground mt-2">
                {exam.fileName}
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                I en fullständig implementation skulle PDF:en visas här
              </p>
            </div>
          </div>
        </Card>

        {/* Questions List */}
        <div className="space-y-4">
          <h3>Uppgifter ({exam.questions.length})</h3>
          
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-3">
              {exam.questions.map((question) => (
                <Card
                  key={question.id}
                  className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedQuestion(question)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4>Uppgift {question.number}</h4>
                        <Badge 
                          className={`${statusColors[question.status]} text-white`}
                          variant="secondary"
                        >
                          {statusLabels[question.status]}
                        </Badge>
                        <Badge variant="outline">
                          {question.points}p
                        </Badge>
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
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          📝 {question.notes}
                        </p>
                      )}
                      
                      {question.comments.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          💬 {question.comments.length} {question.comments.length === 1 ? 'kommentar' : 'kommentarer'}
                        </p>
                      )}
                    </div>
                    
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
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
            <DialogTitle>
              Uppgift {selectedQuestion?.number} - {exam.courseCode}
            </DialogTitle>
          </DialogHeader>
          
          {selectedQuestion && (
            <QuestionDetail
              question={selectedQuestion}
              onUpdate={handleQuestionUpdate}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
