import { useEffect, useMemo, useState } from "react";
import { uniqueSorted } from "../lib/questions";
import { loadQuestions } from "../lib/registry";
import type { Subject, SubjectDirectory } from "../lib/types";

interface HomePageProps {
  directory: SubjectDirectory;
}

export function HomePage({ directory }: HomePageProps) {
  const [subjectStats, setSubjectStats] = useState<Record<string, { total: number; types: number }>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(directory.subjects.map(async (subject) => {
      const questions = await loadQuestions(subject);
      return [subject.id, { total: questions.length, types: uniqueSorted(questions.map((question) => question.type)).length }] as const;
    })).then((entries) => {
      if (!cancelled) setSubjectStats(Object.fromEntries(entries));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [directory.subjects]);

  const byCollege = useMemo(() => {
    const map = new Map<string, Subject[]>();
    directory.subjects.forEach((subject) => {
      const list = map.get(subject.college) || [];
      list.push(subject);
      map.set(subject.college, list);
    });
    return map;
  }, [directory.subjects]);

  const totalQuestionCount = Object.values(subjectStats).reduce((sum, item) => sum + item.total, 0);

  return (
    <main className="home-layout">
      <section className="home-head">
        <h1>学科练习系统</h1>
        <p>按学院组织科目，题库统一 JSON 管理，支持学习模式、模拟考试、错题本、收藏和题库浏览。</p>
      </section>
      <section className="home-summary">
        <div><span>学院</span><b>{directory.colleges.length}</b></div>
        <div><span>科目</span><b>{directory.subjects.length}</b></div>
        <div><span>全站题量</span><b>{totalQuestionCount || "加载中"}</b></div>
        <div><span>部署</span><b>Docker / Pages</b></div>
      </section>
      {directory.colleges.map((college) => {
        const subjects = byCollege.get(college.id) || [];
        if (!subjects.length) return null;
        return (
          <section className="college-section" key={college.id}>
            <div className="section-title">
              <h2>{college.title}</h2>
              <span>{subjects.length} 门科目</span>
            </div>
            <div className="subject-grid">
              {subjects.map((subject) => (
                <a className="subject-card" href={subject.href} key={subject.id}>
                  <span>{subject.mark}</span>
                  <h3>{subject.title}</h3>
                  <p>{subject.description}</p>
                  <small>{subjectStats[subject.id]?.total ?? "加载中"} 题 · {subjectStats[subject.id]?.types ?? "-"} 类题型</small>
                </a>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
