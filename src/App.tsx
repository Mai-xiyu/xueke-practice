import { useEffect, useState } from "react";
import { TopNav } from "./components/TopNav";
import { touchRemoteSession } from "./lib/progress";
import { loadDirectory, subjectFromPage } from "./lib/registry";
import type { Subject, SubjectDirectory } from "./lib/types";
import { HomePage } from "./pages/HomePage";
import { PracticePage } from "./pages/PracticePage";

const EMPTY_DIRECTORY: SubjectDirectory = { colleges: [], subjects: [] };

export function App() {
  const [directory, setDirectory] = useState<SubjectDirectory>(EMPTY_DIRECTORY);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const root = document.getElementById("root");
    const subjectId = root?.dataset.subjectId || null;
    loadDirectory()
      .then((data) => {
        const current = subjectFromPage(data, subjectId);
        setDirectory(data);
        setSubject(current);
        document.title = current ? `${current.title}练习系统` : "学科练习系统";
      })
      .catch((err) => setError(err.message || String(err)));
  }, []);

  useEffect(() => {
    const app = subject?.id || "home";
    void touchRemoteSession(app);
    const timer = window.setInterval(() => {
      void touchRemoteSession(app);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [subject?.id]);

  if (error) {
    return (
      <main className="app-shell">
        <section className="empty-state">系统加载失败：{error}</section>
      </main>
    );
  }

  return (
    <>
      <TopNav directory={directory} activeSubject={subject} />
      {subject ? <PracticePage directory={directory} subject={subject} /> : <HomePage directory={directory} />}
    </>
  );
}
