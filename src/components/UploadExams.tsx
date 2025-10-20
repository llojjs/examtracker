import React, { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Progress } from './ui/progress';
import { mockOCRExtraction } from '../utils/mockData';
import { Exam } from '../types/exam';

interface UploadExamsProps {
  onExamsUploaded: (exams: Exam[]) => void;
}

interface UploadFile {
  file: File;
  status: 'pending' | 'processing' | 'complete' | 'error';
  progress: number;
  extractedData?: Partial<Exam>;
  error?: string;
}

export function UploadExams({ onExamsUploaded }: UploadExamsProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

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
    for (let i = 0; i < uploadFiles.length; i++) {
      setUploadFiles(prev => prev.map((uf, idx) => 
        idx === i ? { ...uf, status: 'processing', progress: 30 } : uf
      ));

      try {
        const extractedData = await mockOCRExtraction(uploadFiles[i].file);
        
        setUploadFiles(prev => prev.map((uf, idx) => 
          idx === i ? { ...uf, status: 'processing', progress: 80, extractedData } : uf
        ));

        // Simulate final processing
        await new Promise(resolve => setTimeout(resolve, 500));

        setUploadFiles(prev => prev.map((uf, idx) => 
          idx === i ? { ...uf, status: 'complete', progress: 100 } : uf
        ));
      } catch (error) {
        setUploadFiles(prev => prev.map((uf, idx) => 
          idx === i ? { ...uf, status: 'error', error: 'Kunde inte bearbeta filen' } : uf
        ));
      }
    }

    setIsProcessing(false);

    // Create exam objects and notify parent
    const completedExams: Exam[] = uploadFiles
      .filter(uf => uf.status === 'complete' && uf.extractedData)
      .map(uf => ({
        id: `exam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        uploadDate: new Date(),
        fileUrl: URL.createObjectURL(uf.file),
        ...uf.extractedData
      } as Exam));

    if (completedExams.length > 0) {
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
    </div>
  );
}
