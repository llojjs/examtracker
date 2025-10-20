import { Exam, Question, ExamStatus, QuestionDifficulty } from '../types/exam';

const themes = [
  'AVL-träd', 'Hashtabell', 'Komplement', 'Sorteringsalgoritmer',
  'Grafteori', 'Dynamisk programmering', 'Komplexitet', 'Rekursion',
  'Binära träd', 'Heaps', 'Backtracking', 'Grådiga algoritmer',
  'Sannolikhet', 'Linjär algebra', 'Derivata', 'Integraler',
  'OOP', 'Funktionell programmering', 'Datastrukturer', 'Reguljära uttryck'
];

const courseData = [
  { code: 'TDA417', name: 'Datastrukturer och algoritmer' },
  { code: 'MVE055', name: 'Matematisk analys' },
  { code: 'TDA357', name: 'Databaser' },
  { code: 'TDA416', name: 'Datastrukturer' },
  { code: 'DAT043', name: 'Matematisk statistik' },
  { code: 'TDA367', name: 'Objektorienterad programmering' }
];

function randomStatus(): ExamStatus {
  const statuses: ExamStatus[] = ['not-started', 'in-progress', 'solved', 'review'];
  return statuses[Math.floor(Math.random() * statuses.length)];
}

function randomDifficulty(): QuestionDifficulty {
  const difficulties: QuestionDifficulty[] = ['easy', 'medium', 'hard', 'very-hard'];
  return difficulties[Math.floor(Math.random() * difficulties.length)];
}

function randomThemes(count: number = 2): string[] {
  const shuffled = [...themes].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function generateQuestions(count: number): Question[] {
  const questions: Question[] = [];
  let questionNumber = 1;
  
  for (let i = 0; i < count; i++) {
    const hasSubQuestions = Math.random() > 0.6;
    
    if (hasSubQuestions) {
      const subCount = Math.floor(Math.random() * 3) + 2; // 2-4 sub-questions
      for (let j = 0; j < subCount; j++) {
        const subLetter = String.fromCharCode(97 + j); // a, b, c, etc.
        questions.push({
          id: `q-${questionNumber}-${subLetter}`,
          number: `${questionNumber}${subLetter}`,
          theme: randomThemes(Math.floor(Math.random() * 2) + 1),
          points: Math.floor(Math.random() * 3) + 1,
          status: randomStatus(),
          difficulty: randomDifficulty(),
          timeSpent: Math.random() > 0.5 ? Math.floor(Math.random() * 30) + 5 : undefined,
          attempts: Math.random() > 0.5 ? Math.floor(Math.random() * 3) + 1 : undefined,
          comments: [],
          page: Math.floor(i / 2) + 1,
          confidence: Math.floor(Math.random() * 20) + 80
        });
      }
      questionNumber++;
    } else {
      questions.push({
        id: `q-${questionNumber}`,
        number: `${questionNumber}`,
        theme: randomThemes(Math.floor(Math.random() * 3) + 1),
        points: Math.floor(Math.random() * 5) + 2,
        status: randomStatus(),
        difficulty: randomDifficulty(),
        timeSpent: Math.random() > 0.5 ? Math.floor(Math.random() * 45) + 10 : undefined,
        attempts: Math.random() > 0.5 ? Math.floor(Math.random() * 4) + 1 : undefined,
        comments: [],
        page: Math.floor(i / 2) + 1,
        confidence: Math.floor(Math.random() * 20) + 80
      });
      questionNumber++;
    }
  }
  
  return questions;
}

export function generateMockExam(index: number): Exam {
  const course = courseData[index % courseData.length];
  const year = 2020 + Math.floor(Math.random() * 5);
  const month = Math.floor(Math.random() * 12);
  const examDate = new Date(year, month, Math.floor(Math.random() * 28) + 1);
  
  const questions = generateQuestions(Math.floor(Math.random() * 3) + 4); // 4-6 main questions
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  
  return {
    id: `exam-${index}`,
    fileName: `${course.code}_tentamen_${year}-${String(month + 1).padStart(2, '0')}.pdf`,
    uploadDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    examDate,
    courseName: course.name,
    courseCode: course.code,
    year,
    totalPoints,
    questions,
    tags: randomThemes(Math.floor(Math.random() * 2) + 1)
  };
}

export function generateMockExams(count: number = 12): Exam[] {
  return Array.from({ length: count }, (_, i) => generateMockExam(i));
}

// Simulate OCR extraction from PDF file
export async function mockOCRExtraction(file: File): Promise<Partial<Exam>> {
  // Simulate delay
  await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1500));
  
  // Try to extract course code from filename
  const fileName = file.name;
  const courseCodeMatch = fileName.match(/([A-Z]{3}\d{3})/);
  const yearMatch = fileName.match(/20(\d{2})/);
  const dateMatch = fileName.match(/(\d{4})-(\d{2})-(\d{2})/);
  
  let courseCode = courseCodeMatch ? courseCodeMatch[1] : courseData[0].code;
  const course = courseData.find(c => c.code === courseCode) || courseData[0];
  
  const year = yearMatch ? parseInt(`20${yearMatch[1]}`) : new Date().getFullYear();
  const examDate = dateMatch 
    ? new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]))
    : new Date(year, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
  
  const questions = generateQuestions(Math.floor(Math.random() * 4) + 4);
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  
  return {
    fileName: file.name,
    examDate,
    courseName: course.name,
    courseCode: course.code,
    year,
    totalPoints,
    questions,
    extractedText: `Simulerad OCR-text från ${file.name}...`,
    tags: randomThemes(2)
  };
}
