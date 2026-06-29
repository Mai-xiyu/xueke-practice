import type { Subject, SubjectDirectory } from "../lib/types";

interface TopNavProps {
  directory: SubjectDirectory;
  activeSubject?: Subject | null;
}

export function TopNav({ directory, activeSubject }: TopNavProps) {
  const subjectsByCollege = new Map<string, Subject[]>();
  directory.subjects.forEach((subject) => {
    const list = subjectsByCollege.get(subject.college) || [];
    list.push(subject);
    subjectsByCollege.set(subject.college, list);
  });

  return (
    <nav className="top-nav">
      <div className="top-nav__inner">
        <a className="brand" href="index.html" aria-label="学科练习系统首页">
          <span className="brand__dot" />
          学科练习系统
        </a>
        <div className="top-nav__links">
          <a className={!activeSubject ? "active" : ""} href="index.html">总览</a>
          {directory.colleges.map((college) => {
            const subjects = subjectsByCollege.get(college.id) || [];
            if (!subjects.length) return null;
            const active = activeSubject?.college === college.id;
            return (
              <div className={`nav-menu${active ? " active" : ""}`} key={college.id}>
                <button type="button" className="nav-menu__trigger">{college.title}</button>
                <div className="nav-menu__panel" role="menu">
                  {subjects.map((subject) => (
                    <a
                      key={subject.id}
                      className={activeSubject?.id === subject.id ? "active" : ""}
                      href={subject.href}
                      role="menuitem"
                    >
                      <span>{subject.title}</span>
                      <small>{subject.mark}</small>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
          <span className="sync-badge">本地/局域网</span>
        </div>
      </div>
    </nav>
  );
}
