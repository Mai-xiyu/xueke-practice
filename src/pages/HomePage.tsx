import type { Subject, SubjectDirectory } from "../lib/types";

interface HomePageProps {
  directory: SubjectDirectory;
}

export function HomePage({ directory }: HomePageProps) {
  const byCollege = new Map<string, Subject[]>();
  directory.subjects.forEach((subject) => {
    const list = byCollege.get(subject.college) || [];
    list.push(subject);
    byCollege.set(subject.college, list);
  });

  return (
    <main className="home-layout">
      <section className="home-head">
        <h1>学科练习系统</h1>
        <p>按学院组织科目，题库统一 JSON 管理，支持学习模式、模拟考试、错题本、收藏和题库浏览。</p>
      </section>
      <section className="home-summary">
        <div><span>学院</span><b>{directory.colleges.length}</b></div>
        <div><span>科目</span><b>{directory.subjects.length}</b></div>
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
                </a>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
