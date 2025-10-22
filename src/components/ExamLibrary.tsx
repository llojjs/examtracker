import React, { useState, useMemo, useEffect } from 'react';
import { Search, SlidersHorizontal, ArrowUpDown, Grid3x3, List, Folder, ChevronRight, ArrowLeft, MoreVertical, Edit2, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from './ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ExamCard } from './ExamCard';
import { CourseChecklist } from './CourseChecklist';
import { Exam, ExamStatus, Task, CourseChecklist as CourseChecklistType } from '../types/exam';
import { toast } from 'sonner';

interface ExamLibraryProps {
  exams: Exam[];
  onExamClick: (exam: Exam) => void;
  onUpdateExams: (exams: Exam[]) => void;
  courseTasks: CourseChecklistType[];
  onUpdateCourseTasks: (tasks: CourseChecklistType[]) => void;
  initialSelectedCourse?: string | null;
}

type SortOption = 'date-desc' | 'date-asc' | 'course' | 'progress' | 'points';

export function ExamLibrary({ exams, onExamClick, onUpdateExams, courseTasks, onUpdateCourseTasks, initialSelectedCourse }: ExamLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  
  // Auto-select or change selected course when parent hints a focus course
  useEffect(() => {
    if (initialSelectedCourse) {
      setSelectedCourse(initialSelectedCourse);
    }
  }, [initialSelectedCourse]);

  // Filters
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<ExamStatus[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  
  // Course management
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);
  const [courseToEdit, setCourseToEdit] = useState<{ code: string; name: string } | null>(null);
  const [editCourseName, setEditCourseName] = useState('');
  const [editCourseCode, setEditCourseCode] = useState('');

  // Get unique values for filters
  const courseCodes = useMemo(() => 
    Array.from(new Set(exams.map(e => e.courseCode))).sort(),
    [exams]
  );

  const years = useMemo(() => 
    Array.from(new Set(exams.map(e => e.year).filter(Boolean))).sort((a, b) => (b || 0) - (a || 0)),
    [exams]
  );

  // Group exams by course
  const examsByCourse = useMemo(() => {
    const grouped = new Map<string, { courseName: string; exams: Exam[] }>();
    
    exams.forEach(exam => {
      const existing = grouped.get(exam.courseCode);
      if (existing) {
        existing.exams.push(exam);
      } else {
        grouped.set(exam.courseCode, {
          courseName: exam.courseName,
          exams: [exam]
        });
      }
    });
    
    return grouped;
  }, [exams]);

  // Filter and sort exams
  const filteredExams = useMemo(() => {
    let filtered = exams;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(exam => 
        exam.courseName.toLowerCase().includes(query) ||
        exam.courseCode.toLowerCase().includes(query) ||
        exam.fileName.toLowerCase().includes(query) ||
        exam.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Course filter (for filter panel)
    if (selectedCourses.length > 0) {
      filtered = filtered.filter(exam => selectedCourses.includes(exam.courseCode));
    }

    // Year filter
    if (selectedYears.length > 0) {
      filtered = filtered.filter(exam => exam.year && selectedYears.includes(exam.year));
    }

    // Status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(exam => {
        const examStatuses = exam.questions.map(q => q.status);
        return selectedStatuses.some(status => examStatuses.includes(status));
      });
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return (b.examDate?.getTime() || 0) - (a.examDate?.getTime() || 0);
        case 'date-asc':
          return (a.examDate?.getTime() || 0) - (b.examDate?.getTime() || 0);
        case 'course':
          return a.courseCode.localeCompare(b.courseCode);
        case 'progress': {
          const progressA = a.questions.filter(q => q.status === 'solved').length / a.questions.length;
          const progressB = b.questions.filter(q => q.status === 'solved').length / b.questions.length;
          return progressB - progressA;
        }
        case 'points':
          return (b.totalPoints || 0) - (a.totalPoints || 0);
        default:
          return 0;
      }
    });

    return sorted;
  }, [exams, searchQuery, selectedCourses, selectedYears, selectedStatuses, sortBy]);

  const toggleCourse = (course: string) => {
    setSelectedCourses(prev => 
      prev.includes(course) 
        ? prev.filter(c => c !== course)
        : [...prev, course]
    );
  };

  const toggleYear = (year: number) => {
    setSelectedYears(prev => 
      prev.includes(year) 
        ? prev.filter(y => y !== year)
        : [...prev, year]
    );
  };

  const toggleStatus = (status: ExamStatus) => {
    setSelectedStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const clearFilters = () => {
    setSelectedCourses([]);
    setSelectedYears([]);
    setSelectedStatuses([]);
    setSearchQuery('');
  };

  const activeFilterCount = selectedCourses.length + selectedYears.length + selectedStatuses.length;

  // Get exams for current view (either all courses or specific course)
  const currentExams = selectedCourse 
    ? filteredExams.filter(e => e.courseCode === selectedCourse && (showArchived ? e.archived : !e.archived))
    : filteredExams.filter(e => showArchived ? e.archived : !e.archived);

  const currentCourseData = selectedCourse ? examsByCourse.get(selectedCourse) : null;

  // Course management functions
  const handleDeleteCourse = (courseCode: string) => {
    setCourseToDelete(courseCode);
  };

  const confirmDeleteCourse = () => {
    if (!courseToDelete) return;
    
    const updatedExams = exams.filter(e => e.courseCode !== courseToDelete);
    onUpdateExams(updatedExams);
    
    // Also remove tasks for this course
    const updatedCourseTasks = courseTasks.filter(ct => ct.courseCode !== courseToDelete);
    onUpdateCourseTasks(updatedCourseTasks);
    
    toast.success(`Kursen ${courseToDelete} har tagits bort`);
    setCourseToDelete(null);
    if (selectedCourse === courseToDelete) {
      setSelectedCourse(null);
    }
  };

  const handleArchiveCourse = (courseCode: string, archive: boolean) => {
    const updatedExams = exams.map(e => 
      e.courseCode === courseCode ? { ...e, archived: archive } : e
    );
    onUpdateExams(updatedExams);
    toast.success(`Kursen ${courseCode} har ${archive ? 'arkiverats' : 'återställts'}`);
  };

  const handleEditCourse = (courseCode: string, courseName: string) => {
    setCourseToEdit({ code: courseCode, name: courseName });
    setEditCourseCode(courseCode);
    setEditCourseName(courseName);
  };

  const confirmEditCourse = () => {
    if (!courseToEdit || !editCourseCode.trim() || !editCourseName.trim()) return;
    
    const updatedExams = exams.map(e => 
      e.courseCode === courseToEdit.code 
        ? { ...e, courseCode: editCourseCode, courseName: editCourseName }
        : e
    );
    onUpdateExams(updatedExams);
    
    // Update tasks as well
    const updatedCourseTasks = courseTasks.map(ct =>
      ct.courseCode === courseToEdit.code
        ? { ...ct, courseCode: editCourseCode }
        : ct
    );
    onUpdateCourseTasks(updatedCourseTasks);
    
    toast.success('Kursen har uppdaterats');
    setCourseToEdit(null);
    if (selectedCourse === courseToEdit.code) {
      setSelectedCourse(editCourseCode);
    }
  };

  const getCourseTasks = (courseCode: string): Task[] => {
    const checklist = courseTasks.find(ct => ct.courseCode === courseCode);
    return checklist?.tasks || [];
  };

  const updateCourseTasks = (courseCode: string, tasks: Task[]) => {
    const existingIndex = courseTasks.findIndex(ct => ct.courseCode === courseCode);
    let updatedCourseTasks: CourseChecklistType[];
    
    if (existingIndex >= 0) {
      updatedCourseTasks = courseTasks.map((ct, idx) =>
        idx === existingIndex ? { ...ct, tasks } : ct
      );
    } else {
      updatedCourseTasks = [...courseTasks, { courseCode, tasks }];
    }
    
    onUpdateCourseTasks(updatedCourseTasks);
  };

  return (
    <div className="space-y-6">
      <div>
        {selectedCourse ? (
          <div>
            <Button variant="ghost" onClick={() => setSelectedCourse(null)} className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Tillbaka till alla kurser
            </Button>
            <h2>{selectedCourse} - {currentCourseData?.courseName}</h2>
            <p className="text-muted-foreground mt-2">
              {currentExams.length} {currentExams.length === 1 ? 'tenta' : 'tentor'}
            </p>
          </div>
        ) : (
          <div>
            <h2>Tentabibliotek</h2>
            <p className="text-muted-foreground mt-2">
              {courseCodes.length} {courseCodes.length === 1 ? 'kurs' : 'kurser'} • {filteredExams.length} {filteredExams.length === 1 ? 'tenta' : 'tentor'}
            </p>
          </div>
        )}
      </div>

      {/* Search and controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={selectedCourse ? "Sök tentor..." : "Sök kurser, tentor, ämnen..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-[180px]">
              <ArrowUpDown className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Senaste datum</SelectItem>
              <SelectItem value="date-asc">Äldsta datum</SelectItem>
              <SelectItem value="course">Kurskod</SelectItem>
              <SelectItem value="progress">Framsteg</SelectItem>
              <SelectItem value="points">Poäng</SelectItem>
            </SelectContent>
          </Select>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="relative">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filtrera tentor</SheetTitle>
                <SheetDescription>
                  Välj kriterier för att filtrera tentabiblioteket
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Course filter */}
                <div className="space-y-3">
                  <Label>Kurskod</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {courseCodes.map(course => (
                      <div key={course} className="flex items-center space-x-2">
                        <Checkbox
                          id={`course-${course}`}
                          checked={selectedCourses.includes(course)}
                          onCheckedChange={() => toggleCourse(course)}
                        />
                        <label
                          htmlFor={`course-${course}`}
                          className="text-sm cursor-pointer"
                        >
                          {course}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Year filter */}
                {years.length > 0 && (
                  <div className="space-y-3">
                    <Label>År</Label>
                    <div className="space-y-2">
                      {years.map(year => year && (
                        <div key={year} className="flex items-center space-x-2">
                          <Checkbox
                            id={`year-${year}`}
                            checked={selectedYears.includes(year)}
                            onCheckedChange={() => toggleYear(year)}
                          />
                          <label
                            htmlFor={`year-${year}`}
                            className="text-sm cursor-pointer"
                          >
                            {year}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status filter */}
                <div className="space-y-3">
                  <Label>Status</Label>
                  <div className="space-y-2">
                    {[
                      { value: 'not-started' as ExamStatus, label: 'Ej påbörjad' },
                      { value: 'in-progress' as ExamStatus, label: 'Pågår' },
                      { value: 'solved' as ExamStatus, label: 'Löst' },
                      { value: 'review' as ExamStatus, label: 'Repetera' }
                    ].map(({ value, label }) => (
                      <div key={value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`status-${value}`}
                          checked={selectedStatuses.includes(value)}
                          onCheckedChange={() => toggleStatus(value)}
                        />
                        <label
                          htmlFor={`status-${value}`}
                          className="text-sm cursor-pointer"
                        >
                          {label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <Button variant="outline" onClick={clearFilters} className="w-full">
                  Rensa alla filter
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {selectedCourse && (
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <Grid3x3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Archive Toggle */}
      {!selectedCourse && (
        <div className="flex justify-end">
          <Button
            variant={showArchived ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? <ArchiveRestore className="w-4 h-4 mr-2" /> : <Archive className="w-4 h-4 mr-2" />}
            {showArchived ? 'Visa aktiva kurser' : 'Visa arkiverade'}
          </Button>
        </div>
      )}

      {/* Content */}
      {selectedCourse ? (
        // Show course detail with tabs
        <Tabs defaultValue="exams" className="space-y-4">
          <TabsList>
            <TabsTrigger value="exams">
              Tentor ({currentExams.length})
            </TabsTrigger>
            <TabsTrigger value="planning">
              Planering
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exams">
            {currentExams.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Inga tentor hittades</p>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
                {currentExams.map(exam => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    onClick={() => onExamClick(exam)}
                    compact={viewMode === 'list'}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="planning">
            <CourseChecklist
              courseCode={selectedCourse}
              tasks={getCourseTasks(selectedCourse)}
              onUpdateTasks={(tasks) => updateCourseTasks(selectedCourse, tasks)}
            />
          </TabsContent>
        </Tabs>
      ) : (
        // Show course folders
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from(examsByCourse.entries())
            .filter(([courseCode]) => {
              // Filter courses that have exams matching the current filters
              const courseExams = examsByCourse.get(courseCode)?.exams || [];
              return courseExams.some(exam => filteredExams.includes(exam));
            })
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([courseCode, { courseName, exams: courseExams }]) => {
              // Only count exams that match the filters
              const visibleExams = courseExams.filter(exam => filteredExams.includes(exam));
              const totalQuestions = visibleExams.reduce((sum, e) => sum + e.questions.length, 0);
              const solvedQuestions = visibleExams.reduce((sum, e) => 
                sum + e.questions.filter(q => q.status === 'solved').length, 0
              );
              const progress = totalQuestions > 0 ? (solvedQuestions / totalQuestions) * 100 : 0;

              const isArchived = courseExams.some(e => e.archived);
              
              return (
                <Card
                  key={courseCode}
                  className="p-6 hover:shadow-lg transition-all border-2 hover:border-primary/50 relative group"
                >
                  <div 
                    className="flex items-start gap-4 cursor-pointer"
                    onClick={() => setSelectedCourse(courseCode)}
                  >
                    <div className={`p-3 rounded-lg ${isArchived ? 'bg-muted' : 'bg-primary/10'}`}>
                      {isArchived ? (
                        <Archive className="w-8 h-8 text-muted-foreground" />
                      ) : (
                        <Folder className="w-8 h-8 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="truncate">{courseCode}</h3>
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {courseName}
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <Badge variant="secondary">
                          {visibleExams.length} {visibleExams.length === 1 ? 'tenta' : 'tentor'}
                        </Badge>
                        <Badge variant="outline">
                          {totalQuestions} uppgifter
                        </Badge>
                        {isArchived && (
                          <Badge variant="outline" className="bg-muted">
                            Arkiverad
                          </Badge>
                        )}
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>Framsteg</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Right side icons stacked vertically */}
                    <div className="flex flex-col items-center gap-2 flex-shrink-0">
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              handleEditCourse(courseCode, courseName);
                            }}>
                              <Edit2 className="w-4 h-4 mr-2" />
                              Redigera kurs
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              handleArchiveCourse(courseCode, !isArchived);
                            }}>
                              {isArchived ? (
                                <>
                                  <ArchiveRestore className="w-4 h-4 mr-2" />
                                  Återställ kurs
                                </>
                              ) : (
                                <>
                                  <Archive className="w-4 h-4 mr-2" />
                                  Arkivera kurs
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                handleDeleteCourse(courseCode);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Ta bort kurs
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
        </div>
      )}

      {/* Delete Course Dialog */}
      <AlertDialog open={courseToDelete !== null} onOpenChange={(open) => !open && setCourseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort kurs?</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort kursen {courseToDelete}? 
              Alla tentor och uppgifter för denna kurs kommer att raderas permanent. 
              Denna åtgärd kan inte ångras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCourse} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Course Dialog */}
      <Dialog open={courseToEdit !== null} onOpenChange={(open) => !open && setCourseToEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redigera kurs</DialogTitle>
            <DialogDescription>
              Ändra kursens namn och kod. Detta kommer att uppdatera alla relaterade tentor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="courseCode">Kurskod</Label>
              <Input
                id="courseCode"
                value={editCourseCode}
                onChange={(e) => setEditCourseCode(e.target.value)}
                placeholder="t.ex. TDA417"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="courseName">Kursnamn</Label>
              <Input
                id="courseName"
                value={editCourseName}
                onChange={(e) => setEditCourseName(e.target.value)}
                placeholder="t.ex. Datastrukturer"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseToEdit(null)}>
              Avbryt
            </Button>
            <Button onClick={confirmEditCourse}>
              Spara ändringar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
