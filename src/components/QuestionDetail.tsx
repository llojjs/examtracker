import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Pin, 
  Trash2, 
  Clock, 
  Trophy, 
  Tag,
  Plus,
  Save,
  Play,
  Pause,
  StopCircle
} from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Question, ExamStatus, QuestionDifficulty, Comment } from '../types/exam';

interface QuestionDetailProps {
  question: Question;
  onUpdate: (updates: Partial<Question>) => void;
}

const statusLabels: Record<ExamStatus, string> = {
  'not-started': 'Ej påbörjad',
  'in-progress': 'Pågår',
  'solved': 'Löst',
  'review': 'Repetera'
};

const difficultyLabels: Record<QuestionDifficulty, string> = {
  'easy': 'Lätt',
  'medium': 'Medel',
  'hard': 'Svår',
  'very-hard': 'Mycket svår'
};

const statusColors: Record<ExamStatus, string> = {
  'not-started': 'bg-gray-500',
  'in-progress': 'bg-info',
  'solved': 'bg-success',
  'review': 'bg-warning'
};

export function QuestionDetail({ question, onUpdate }: QuestionDetailProps) {
  const [notes, setNotes] = useState(question.notes || '');
  const [newComment, setNewComment] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newTheme, setNewTheme] = useState('');
  
  // Timer state
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerIntervalRef = useRef<number | null>(null);
  
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current as number);
      }
    };
  }, []);
  
  const startTimer = () => {
    if (!isTimerRunning) {
      setIsTimerRunning(true);
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
      // TypeScript in DOM expects number for setInterval return
      timerIntervalRef.current = timerIntervalRef.current as unknown as number;
    }
  };
  
  const pauseTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsTimerRunning(false);
  };
  
  const stopTimer = () => {
    pauseTimer();
    if (timerSeconds > 0) {
      const additionalMinutes = Math.ceil(timerSeconds / 60);
      const currentTimeSpent = question.timeSpent || 0;
      onUpdate({ timeSpent: currentTimeSpent + additionalMinutes });
    }
    setTimerSeconds(0);
  };
  
  const formatTimerDisplay = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSaveNotes = () => {
    onUpdate({ notes });
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    
    const comment: Comment = {
      id: `comment-${Date.now()}`,
      text: newComment,
      timestamp: new Date(),
      pinned: false
    };
    
    onUpdate({
      comments: [...question.comments, comment]
    });
    
    setNewComment('');
  };

  const handleTogglePin = (commentId: string) => {
    const updatedComments = question.comments.map(c =>
      c.id === commentId ? { ...c, pinned: !c.pinned } : c
    );
    onUpdate({ comments: updatedComments });
  };

  const handleDeleteComment = (commentId: string) => {
    const updatedComments = question.comments.filter(c => c.id !== commentId);
    onUpdate({ comments: updatedComments });
  };

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    const tags = question.tags || [];
    if (!tags.includes(newTag)) {
      onUpdate({ tags: [...tags, newTag] });
    }
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    const tags = question.tags || [];
    onUpdate({ tags: tags.filter(t => t !== tag) });
  };

  const handleAddTheme = () => {
    if (!newTheme.trim()) return;
    const themes = question.theme || [];
    if (!themes.includes(newTheme)) {
      onUpdate({ theme: [...themes, newTheme] });
    }
    setNewTheme('');
  };

  const handleRemoveTheme = (theme: string) => {
    const themes = question.theme || [];
    onUpdate({ theme: themes.filter(t => t !== theme) });
  };

  const formatTime = (minutes?: number) => {
    if (!minutes) return '-';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2>Uppgift {question.number}</h2>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={`${statusColors[question.status]} text-white`}>
                {statusLabels[question.status]}
              </Badge>
              {question.difficulty && (
                <Badge variant="outline">
                  {difficultyLabels[question.difficulty]}
                </Badge>
              )}
              <Badge variant="secondary">
                <Trophy className="w-3 h-3 mr-1" />
                {question.points}p
              </Badge>
              {question.confidence && (
                <Badge variant="outline">
                  OCR: {question.confidence}%
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Themes - Editable */}
        <Card className="p-4 mb-4">
          <div className="space-y-3">
            <Label>Ämnen/Teman (från OCR eller manuellt)</Label>
            <div className="flex flex-wrap gap-2">
              {question.theme.map((theme, idx) => (
                <Badge key={idx} variant="secondary" className="gap-1">
                  {theme}
                  <button
                    onClick={() => handleRemoveTheme(theme)}
                    className="ml-1 hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTheme}
                onChange={(e) => setNewTheme(e.target.value)}
                placeholder="Lägg till ämne (t.ex. AVL-träd, Hashtabell)..."
                onKeyPress={(e) => e.key === 'Enter' && handleAddTheme()}
              />
              <Button onClick={handleAddTheme} size="icon">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Lägg till eller ta bort ämnen för att kategorisera uppgiften
            </p>
          </div>
        </Card>
      </div>

      {/* Timer */}
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Timer</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Timea dig själv när du arbetar med uppgiften
              </p>
            </div>
            <Clock className="w-5 h-5 text-primary" />
          </div>
          
          <div className="flex items-center justify-center py-4">
            <div className="text-5xl font-mono tabular-nums text-primary">
              {formatTimerDisplay(timerSeconds)}
            </div>
          </div>
          
          <div className="flex gap-2 justify-center">
            {!isTimerRunning && timerSeconds === 0 && (
              <Button onClick={startTimer} className="gap-2">
                <Play className="w-4 h-4" />
                Starta
              </Button>
            )}
            {isTimerRunning && (
              <Button onClick={pauseTimer} variant="outline" className="gap-2">
                <Pause className="w-4 h-4" />
                Pausa
              </Button>
            )}
            {!isTimerRunning && timerSeconds > 0 && (
              <Button onClick={startTimer} className="gap-2">
                <Play className="w-4 h-4" />
                Fortsätt
              </Button>
            )}
            {timerSeconds > 0 && (
              <Button onClick={stopTimer} variant="destructive" className="gap-2">
                <StopCircle className="w-4 h-4" />
                Stoppa & Spara
              </Button>
            )}
          </div>
          
          {timerSeconds > 0 && (
            <p className="text-xs text-center text-muted-foreground">
              Tiden läggs till när du stoppar timern
            </p>
          )}
        </div>
      </Card>

      {/* Metadata */}
      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select 
              value={question.status} 
              onValueChange={(value) => onUpdate({ status: value as ExamStatus })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Svårighetsgrad</Label>
            <Select 
              value={question.difficulty || ''} 
              onValueChange={(value) => onUpdate({ difficulty: value as QuestionDifficulty })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Välj..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(difficultyLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Tid spenderad</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                value={question.timeSpent || ''}
                onChange={(e) => onUpdate({ timeSpent: parseInt(e.target.value) || undefined })}
                placeholder="0"
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground">min</span>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Antal försök</Label>
            <Input
              type="number"
              value={question.attempts || ''}
              onChange={(e) => onUpdate({ attempts: parseInt(e.target.value) || undefined })}
              placeholder="0"
              className="mt-1"
            />
          </div>
        </div>
      </Card>

      {/* Tags */}
      <Card className="p-4">
        <div className="space-y-3">
          <Label>Taggar</Label>
          <div className="flex flex-wrap gap-2">
            {(question.tags || []).map((tag, idx) => (
              <Badge key={idx} variant="outline" className="gap-1">
                <Tag className="w-3 h-3" />
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Lägg till tagg..."
              onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
            />
            <Button onClick={handleAddTag} size="icon">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Notes */}
      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Anteckningar (Markdown-stöd)</Label>
            <Button size="sm" onClick={handleSaveNotes}>
              <Save className="w-4 h-4 mr-2" />
              Spara
            </Button>
          </div>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Skriv dina anteckningar här... Du kan använda markdown för formattering."
            className="min-h-[200px] font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Tips: Använd ** för fetstil, * för kursiv, ` för kod, ``` för kodblock, $ för LaTeX-formler
          </p>
        </div>
      </Card>

      {/* Comments */}
      <Card className="p-4">
        <div className="space-y-4">
          <Label>Kommentarer</Label>
          
          <div className="space-y-3">
            {question.comments
              .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
              .map(comment => (
                <div
                  key={comment.id}
                  className={`p-3 rounded-lg border ${
                    comment.pinned ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex-1 text-sm">{comment.text}</p>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleTogglePin(comment.id)}
                      >
                        <Pin className={`w-3 h-3 ${comment.pinned ? 'fill-current' : ''}`} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleDeleteComment(comment.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {new Date(comment.timestamp).toLocaleString('sv-SE')}
                  </div>
                </div>
              ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Skriv en kommentar..."
              onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
            />
            <Button onClick={handleAddComment}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Lägg till
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
