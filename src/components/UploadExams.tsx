import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Calendar, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { parsePdf } from '../utils/parsePdf';
import { loadExamsAsync, saveExamsAsync } from '../utils/storage';
import { Exam } from '../types/exam';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface UploadExamsProps {
  onExamsUploaded: (exams: Exam[]) => void;
  exams: Exam[];
  onViewAllExams: () => void;
}

interface UploadFile {
  file: File;
  status: 'pending' | 'processing' | 'complete' | 'error';
  progress: number;
  extractedData?: Partial<Exam>;
  error?: string;
}

export function UploadExams({ onExamsUploaded, exams, onViewAllExams }: UploadExamsProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Prompt for missing course info
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [courseDialogData, setCourseDialogData] = useState<{ fileName: string; courseCode: string; courseName: string }>({ fileName: '', courseCode: '', courseName: '' });
  const courseDialogResolveRef = useRef<(value: { courseCode: string; courseName: string } | null) => void>();

  const promptForCourseInfo = (fileName: string, suggestedCode: string = '', suggestedName: string = ''): Promise<{ courseCode: string; courseName: string } | null> => {
    setCourseDialogData({ fileName, courseCode: suggestedCode, courseName: suggestedName });
    setCourseDialogOpen(true);
    return new Promise((resolve) => {
      courseDialogResolveRef.current = resolve;
    });
  };

  // Get 5 most recently uploaded exams
  const recentExams = useMemo(() => {
    return [...exams]
      .sort((a, b) => {
        const dateA = a.uploadDate?.getTime() || 0;
        const dateB = b.uploadDate?.getTime() || 0;
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [exams]);

  const formatDate = (date?: Date) => {
    if (!date) return 'Okänt datum';
    return new Date(date).toLocaleDateString('sv-SE', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFiles = async (files: File[]) => {
    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    
    if (pdfFiles.length === 0) {
      return;
    }

    const uploadFiles: UploadFile[] = pdfFiles.map(file => ({
      file,
      status: 'pending',
      progress: 0
    }));

    setUploadFiles(uploadFiles);
    setIsProcessing(true);

    // Process files sequentially
    const createdExams: Exam[] = [];
    for (let i = 0; i < uploadFiles.length; i++) {
      setUploadFiles(prev => prev.map((uf, idx) => 
        idx === i ? { ...uf, status: 'processing', progress: 30 } : uf
      ));

      try {
        let extractedData = await parsePdf(uploadFiles[i].file);

        // Fallback prompt when courseCode or courseName is missing
        if (!extractedData.courseCode || !extractedData.courseName) {
          const promptResult = await promptForCourseInfo(
            uploadFiles[i].file.name,
            (extractedData.courseCode || '').toString(),
            (extractedData.courseName || '').toString()
          );

          if (!promptResult) {
            // Treat as canceled; mark as error and skip
            setUploadFiles(prev => prev.map((uf, idx) =>
              idx === i ? { ...uf, status: 'error', error: 'Kursinformation saknas' } : uf
            ));
            continue;
          }

          extractedData = {
            ...extractedData,
            courseCode: promptResult.courseCode.trim().toUpperCase(),
            courseName: promptResult.courseName.trim() || `${promptResult.courseCode.trim().toUpperCase()} - okänd kurs`,
          } as Partial<Exam>;
        }
        
        setUploadFiles(prev => prev.map((uf, idx) => 
          idx === i ? { ...uf, status: 'processing', progress: 80, extractedData } : uf
        ));

        // Simulate final processing
        await new Promise(resolve => setTimeout(resolve, 500));

        // Mark UI state as complete
        setUploadFiles(prev => prev.map((uf, idx) => 
          idx === i ? { ...uf, status: 'complete', progress: 100, extractedData } : uf
        ));

        // Create exam object and collect for persistence and parent update
        const newExam: Exam = {
          id: `exam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          uploadDate: new Date(),
          fileUrl: URL.createObjectURL(uploadFiles[i].file),
          ...(extractedData as any),
        } as Exam;
        createdExams.push(newExam);
      } catch (error) {
        setUploadFiles(prev => prev.map((uf, idx) => 
          idx === i ? { ...uf, status: 'error', error: 'Kunde inte bearbeta filen' } : uf
        ));
      }
    }

    setIsProcessing(false);

    // Persist exams and notify parent
    const completedExams: Exam[] = createdExams;

    if (completedExams.length > 0) {
      // Persist combined exams list into IndexedDB (merge with existing)
      try {
        const existing = await loadExamsAsync();
        const merged = [...existing, ...completedExams];
        await saveExamsAsync(merged);
      } catch (err) {
        console.warn('Failed to persist uploaded exams to IndexedDB:', err);
      }

      // Notify parent with newly uploaded exams
      onExamsUploaded(completedExams);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  }, []);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      await processFiles(files);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2>Ladda upp tentor</h2>
        <p className="text-muted-foreground mt-2">
          Dra och släpp PDF-filer här eller välj filer från din enhet
        </p>
      </div>

      <Card
        className={`border-2 border-dashed transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-border'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="p-12 flex flex-col items-center justify-center text-center">
          <div className={`rounded-full p-4 mb-4 ${
            isDragging ? 'bg-primary/10' : 'bg-muted'
          }`}>
            <Upload className={`w-8 h-8 ${
              isDragging ? 'text-primary' : 'text-muted-foreground'
            }`} />
          </div>
          
          <h3 className="mb-2">Dra PDF-filer hit</h3>
          <p className="text-muted-foreground mb-4">
            eller
          </p>
          
          <Button asChild>
            <label className="cursor-pointer">
              Välj filer
              <input
                type="file"
                multiple
                accept="application/pdf"
                className="hidden"
                onChange={handleFileInput}
                disabled={isProcessing}
              />
            </label>
          </Button>
        </div>
      </Card>

      {uploadFiles.length > 0 && (
        <div className="space-y-3">
          <h3>Uppladdade filer ({uploadFiles.length})</h3>
          
          {uploadFiles.map((uploadFile, idx) => (
            <Card key={idx} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {uploadFile.status === 'pending' && (
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  )}
                  {uploadFile.status === 'processing' && (
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  )}
                  {uploadFile.status === 'complete' && (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  )}
                  {uploadFile.status === 'error' && (
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="truncate mb-1">
                    {uploadFile.file.name}
                  </p>
                  
                  {uploadFile.status === 'processing' && (
                    <div className="space-y-2">
                      <Progress value={uploadFile.progress} className="h-1.5" />
                      <p className="text-sm text-muted-foreground">
                        Extraherar metadata med OCR...
                      </p>
                    </div>
                  )}
                  
                  {uploadFile.status === 'complete' && uploadFile.extractedData && (
                    <div className="text-sm text-muted-foreground">
                      {uploadFile.extractedData.courseCode} - {uploadFile.extractedData.courseName}
                      {uploadFile.extractedData.questions && (
                        <span> • {uploadFile.extractedData.questions.length} uppgifter</span>
                      )}
                    </div>
                  )}
                  
                  {uploadFile.status === 'error' && (
                    <p className="text-sm text-destructive">
                      {uploadFile.error}
                    </p>
                  )}
                </div>
                
                <div className="text-sm text-muted-foreground flex-shrink-0">
                  {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Recently Uploaded Exams */}
      {recentExams.length > 0 && (
        <>
          <Separator className="my-8" />
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3>Nyligen uppladdade tentor</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Dina {recentExams.length} senaste uppladdningar
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentExams.map((exam) => (
                <Card key={exam.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="truncate">{exam.courseCode}</h4>
                        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {exam.courseName}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(exam.uploadDate)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {exam.questions.length} uppgifter
                      </Badge>
                      {exam.totalPoints && (
                        <Badge variant="outline" className="text-xs">
                          {exam.totalPoints}p
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={onViewAllExams} className="group">
                Visa alla tentor
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Course Info Prompt Dialog */}
      <Dialog 
        open={courseDialogOpen} 
        onOpenChange={(open) => {
          setCourseDialogOpen(open);
          if (!open && courseDialogResolveRef.current) {
            // Resolve as canceled if closed without submitting
            courseDialogResolveRef.current(null);
            courseDialogResolveRef.current = undefined;
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ange kursinformation</DialogTitle>
            <DialogDescription>
              Vi kunde inte identifiera kurskod från filen "{courseDialogData.fileName}". Fyll i kurskod och kursnamn.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="courseCode">Kurskod</Label>
              <Input
                id="courseCode"
                value={courseDialogData.courseCode}
                onChange={(e) => setCourseDialogData(d => ({ ...d, courseCode: e.target.value }))}
                placeholder="t.ex. TDA417"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="courseName">Kursnamn</Label>
              <Input
                id="courseName"
                value={courseDialogData.courseName}
                onChange={(e) => setCourseDialogData(d => ({ ...d, courseName: e.target.value }))}
                placeholder="t.ex. Datastrukturer och algoritmer"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                const resolver = courseDialogResolveRef.current;
                courseDialogResolveRef.current = undefined;
                setCourseDialogOpen(false);
                resolver?.(null);
              }}
            >
              Avbryt
            </Button>
            <Button 
              onClick={() => {
                const code = courseDialogData.courseCode.trim().toUpperCase();
                if (!code) return; // require code
                const name = courseDialogData.courseName.trim();
                const resolver = courseDialogResolveRef.current;
                courseDialogResolveRef.current = undefined;
                setCourseDialogOpen(false);
                resolver?.({ courseCode: code, courseName: name });
              }}
            >
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
