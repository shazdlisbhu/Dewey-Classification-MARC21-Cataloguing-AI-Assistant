export interface BookMetadata {
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  publishYear?: string;
  publishPlace?: string;
  pages?: string;
  edition?: string;
  series?: string;
  language?: string;
  coverUrl?: string | null;
}

export interface DdcLevel {
  level: string;
  code: string;
  name: string;
}

export interface DdcClassification {
  number: string;
  certainty: number;
  classTitle: string;
  breakdown: DdcLevel[];
  explanation: string;
}

export interface SubjectHeadings {
  lcsh: string[];
  sears: string[];
  mesh: string[];
}

export interface MarcField {
  tag: string;
  ind1: string;
  ind2: string;
  value: string;
  description: string;
}

export interface CatalogCardData {
  mainEntry: string;
  body: string;
  tracings: string[];
}

export interface ClassificationResult {
  source: string;
  foundInDatabase: boolean;
  metadata: BookMetadata;
  ddc: DdcClassification;
  subjectHeadings: SubjectHeadings;
  marc21: MarcField[];
  aacr2Card: CatalogCardData;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  query: string;
  type: "isbn" | "title";
  result: ClassificationResult;
}
