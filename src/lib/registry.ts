import type { Question, Subject, SubjectDirectory } from "./types";

export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "./";
  const cleanBase = base.endsWith("/") ? base : `${base}/`;
  return `${cleanBase}${path.replace(/^\//, "")}`;
}

export async function loadDirectory(): Promise<SubjectDirectory> {
  const response = await fetch(assetUrl("subjects.json"), { cache: "no-store" });
  if (!response.ok) throw new Error(`subjects.json ${response.status}`);
  const data = await response.json() as SubjectDirectory;
  return {
    colleges: [...(data.colleges || [])].sort((a, b) => (a.order || 0) - (b.order || 0)),
    subjects: [...(data.subjects || [])].sort((a, b) => (a.order || 0) - (b.order || 0))
  };
}

export async function loadQuestions(subject: Subject): Promise<Question[]> {
  const response = await fetch(assetUrl(subject.dataFile), { cache: "no-store" });
  if (!response.ok) throw new Error(`${subject.dataFile} ${response.status}`);
  return await response.json() as Question[];
}

export function subjectFromPage(directory: SubjectDirectory, subjectId: string | null): Subject | null {
  if (subjectId) return directory.subjects.find((subject) => subject.id === subjectId) || null;
  const page = decodeURIComponent(location.pathname.split("/").pop() || "index.html");
  return directory.subjects.find((subject) => subject.href === page) || null;
}
