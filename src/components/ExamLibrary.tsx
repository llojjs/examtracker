import React, { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, ArrowUpDown, Grid3x3, List, Folder, ChevronRight, ArrowLeft } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ExamCard } from './ExamCard';
import { Exam, ExamStatus } from '../types/exam';

interface ExamLibraryProps {
  exams: Exam[];
  onExamClick: (exam: Exam) => void;
}

type SortOption = 'date-desc' | 'date-asc' | 'course' | 'progress' | 'points';

export function ExamLibrary({ exams, onExamClick }: ExamLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  
  // Filters
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<ExamStatus[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);

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
    ? filteredExams.filter(e => e.courseCode === selectedCourse)
    : filteredExams;

  const currentCourseData = selectedCourse ? examsByCourse.get(selectedCourse) : null;

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

      {/* Content */}
      {selectedCourse ? (
        // Show exams in selected course
        currentExams.length === 0 ? (
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
        )
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

              return (
                <Card
                  key={courseCode}
                  className="p-6 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary/50"
                  onClick={() => setSelectedCourse(courseCode)}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <Folder className="w-8 h-8 text-primary" />
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
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );
}
