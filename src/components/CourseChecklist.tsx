import React, { useState } from 'react';
import { Plus, Check, Trash2, Calendar, Flag, FileDown } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Progress } from './ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar as CalendarComponent } from './ui/calendar';
import { Task, TaskPriority } from '../types/exam';

interface CourseChecklistProps {
  courseCode: string;
  tasks: Task[];
  onUpdateTasks: (tasks: Task[]) => void;
}

const priorityLabels: Record<TaskPriority, string> = {
  low: 'Låg',
  medium: 'Medel',
  high: 'Hög'
};

const priorityColors: Record<TaskPriority, string> = {
  low: 'bg-info/10 text-info border-info/30',
  medium: 'bg-warning/10 text-warning border-warning/30',
  high: 'bg-danger/10 text-danger border-danger/30'
};

export function CourseChecklist({ courseCode, tasks, onUpdateTasks }: CourseChecklistProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskDeadline, setNewTaskDeadline] = useState<Date | undefined>(undefined);

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const addTask = () => {
    if (!newTaskTitle.trim()) return;

    const newTask: Task = {
      id: `task-${Date.now()}`,
      courseCode,
      title: newTaskTitle,
      completed: false,
      priority: newTaskPriority,
      deadline: newTaskDeadline,
      createdAt: new Date()
    };

    onUpdateTasks([...tasks, newTask]);
    setNewTaskTitle('');
    setNewTaskPriority('medium');
    setNewTaskDeadline(undefined);
  };

  const toggleTask = (taskId: string) => {
    onUpdateTasks(
      tasks.map(task =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const deleteTask = (taskId: string) => {
    onUpdateTasks(tasks.filter(task => task.id !== taskId));
  };

  const formatDeadline = (date?: Date) => {
    if (!date) return null;
    const now = new Date();
    const deadline = new Date(date);
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return <span className="text-danger">Försenad</span>;
    } else if (diffDays === 0) {
      return <span className="text-warning">Idag</span>;
    } else if (diffDays === 1) {
      return <span>Imorgon</span>;
    } else if (diffDays <= 7) {
      return <span className="text-warning">{diffDays} dagar kvar</span>;
    }
    
    return deadline.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
  };

  const exportToPDF = () => {
    // Placeholder function
    alert('Export till PDF - funktion kommer snart! 📄');
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3>Planering & Checklista</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Organisera dina studiemål och uppgifter
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportToPDF}>
            <FileDown className="w-4 h-4 mr-2" />
            Exportera PDF
          </Button>
        </div>

        {/* Progress */}
        {totalCount > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Framsteg</span>
              <span className="font-medium">
                {completedCount}/{totalCount} uppgifter
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {/* Add new task */}
        <div className="space-y-3">
          <Input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Lägg till ny uppgift (t.ex. 'Repetera kapitel 5')..."
            onKeyPress={(e) => e.key === 'Enter' && addTask()}
          />
          
          <div className="flex gap-2">
            <Select value={newTaskPriority} onValueChange={(value) => setNewTaskPriority(value as TaskPriority)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(priorityLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex items-center gap-2">
                      <Flag className="w-3 h-3" />
                      {label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Calendar className="w-4 h-4 mr-2" />
                  {newTaskDeadline ? newTaskDeadline.toLocaleDateString('sv-SE') : 'Deadline'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={newTaskDeadline}
                  onSelect={setNewTaskDeadline}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Button onClick={addTask} className="ml-auto">
              <Plus className="w-4 h-4 mr-2" />
              Lägg till
            </Button>
          </div>
        </div>

        {/* Tasks list */}
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Inga uppgifter än. Lägg till din första uppgift ovan!</p>
            </div>
          ) : (
            <>
              {tasks
                .sort((a, b) => {
                  if (a.completed !== b.completed) return a.completed ? 1 : -1;
                  if (a.deadline && b.deadline) return a.deadline.getTime() - b.deadline.getTime();
                  if (a.deadline) return -1;
                  if (b.deadline) return 1;
                  return 0;
                })
                .map(task => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      task.completed
                        ? 'bg-muted/50 opacity-60'
                        : 'bg-background hover:bg-muted/30'
                    }`}
                  >
                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={() => toggleTask(task.id)}
                    />
                    
                    <div className="flex-1 min-w-0">
                      <p className={`${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {task.priority && (
                          <Badge variant="outline" className={`text-xs ${priorityColors[task.priority]}`}>
                            <Flag className="w-3 h-3 mr-1" />
                            {priorityLabels[task.priority]}
                          </Badge>
                        )}
                        {task.deadline && (
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="w-3 h-3 mr-1" />
                            {formatDeadline(task.deadline)}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteTask(task.id)}
                      className="flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
            </>
          )}
        </div>

        {/* Study sessions placeholder */}
        <div className="border-t pt-6">
          <h4 className="mb-3">Study Sessions (Kommer snart)</h4>
          <div className="grid grid-cols-7 gap-2">
            {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map((day, idx) => (
              <div key={idx} className="text-center">
                <p className="text-xs text-muted-foreground mb-2">{day}</p>
                <div className="h-16 border-2 border-dashed rounded-lg flex items-center justify-center text-xs text-muted-foreground">
                  <Plus className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Planera dina pluggtillfällen genom att lägga till studiesessioner i kalendern.
          </p>
        </div>
      </div>
    </Card>
  );
}
