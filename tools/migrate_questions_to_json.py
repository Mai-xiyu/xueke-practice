import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

SUBJECT_FILES = {
    "route-switching": ("network_practice.html", "QUESTIONS"),
    "network-security": ("network_info_security_practice.html", "QUESTIONS"),
    "data-collection": ("network_data_collection_practice.html", "QBANK"),
    "data-structure": ("data_structure_practice.html", "QUESTIONS"),
    "linux-course": ("linux_practice.html", "QUESTIONS"),
    "modern-history": ("modern_history_practice.html", "QUESTIONS"),
    "community": ("community_practice.html", "QUESTIONS"),
    "higher-math-down": ("higher_math_down_practice.html", "QUESTIONS"),
}

BOOT_REPLACEMENTS = {
    "route-switching": (
        "renderAll();",
        'studyHubLoadQuestions("data/route-switching.json", "路由交换").then(data => { QUESTIONS = data; studyList = QUESTIONS.map(q => q.id); studyIndex = Math.max(0, Math.min(state.studyIndex || 0, studyList.length - 1)); renderAll(); });',
    ),
    "network-security": (
        "initControls();applyFilter();renderStats();",
        'studyHubLoadQuestions("data/network-security.json", "网络安全").then(data => { QUESTIONS = data; initControls(); applyFilter(); renderStats(); });',
    ),
    "data-collection": (
        "initSelects(); updatePills(); applyLearn(); startExam(); renderCards(); renderCode(); renderBrowse();",
        'studyHubLoadQuestions("data/data-collection.json", "数据采集").then(data => { QBANK = data; initSelects(); updatePills(); applyLearn(); startExam(); renderCards(); renderCode(); renderBrowse(); });',
    ),
    "linux-course": (
        "init();",
        'studyHubLoadQuestions("data/linux-course.json", "Linux课程").then(data => { QUESTIONS = data; init(); });',
    ),
    "modern-history": (
        "init();",
        'studyHubLoadQuestions("data/modern-history.json", "中国近代史").then(data => { QUESTIONS = data; init(); });',
    ),
}

FULL_BLOCK_REPLACEMENTS = {
    "data-structure": (
        """initFilters();
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); mode=b.dataset.mode; render();});
[chapterFilter,typeFilter,sourceFilter,searchBox].forEach(el=>el.addEventListener('input',()=>{shuffled=false; render();}));
shuffleBtn.onclick=()=>{shuffled=!shuffled; render();};
resetWrongBtn.onclick=()=>{state.wrong=[]; save(); render();};
exportBtn.onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ds-practice-progress.json'; a.click();};
function practiceQuestionType(q){return q.type}
window.studyHubPracticeNav=()=>{
  if(mode!=='study')return null;
  const list=filteredQuestions();
  if(!list.length)return null;
  return {mode:'study',title:'答题卡',current:null,items:list.map((q,i)=>({id:q.id,index:i+1,label:String(i+1),type:practiceQuestionType(q),done:state.answers[q.id]!==undefined,wrong:state.wrong.includes(q.id)})),jump(index){const q=list[index-1];if(!q)return;const card=[...document.querySelectorAll('.q-card')].find(el=>el.dataset.id===q.id);if(card)card.scrollIntoView({behavior:'auto',block:'start'});}};
};
render();""",
        """function bootPractice(){
initFilters();
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); mode=b.dataset.mode; render();});
[chapterFilter,typeFilter,sourceFilter,searchBox].forEach(el=>el.addEventListener('input',()=>{shuffled=false; render();}));
shuffleBtn.onclick=()=>{shuffled=!shuffled; render();};
resetWrongBtn.onclick=()=>{state.wrong=[]; save(); render();};
exportBtn.onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ds-practice-progress.json'; a.click();};
render();
}
function practiceQuestionType(q){return q.type}
window.studyHubPracticeNav=()=>{
  if(mode!=='study')return null;
  const list=filteredQuestions();
  if(!list.length)return null;
  return {mode:'study',title:'答题卡',current:null,items:list.map((q,i)=>({id:q.id,index:i+1,label:String(i+1),type:practiceQuestionType(q),done:state.answers[q.id]!==undefined,wrong:state.wrong.includes(q.id)})),jump(index){const q=list[index-1];if(!q)return;const card=[...document.querySelectorAll('.q-card')].find(el=>el.dataset.id===q.id);if(card)card.scrollIntoView({behavior:'auto',block:'start'});}};
};
studyHubLoadQuestions("data/data-structure.json", "数据结构").then(data => { QUESTIONS = data; bootPractice(); });""",
    ),
    "community": (
        """document.querySelectorAll(".tab").forEach(btn=>btn.onclick=()=>setMode(btn.dataset.mode));
$("applyBtn").onclick=applyFilter;
$("clearBtn").onclick=()=>{if(confirm(UI.confirmClear)){state={answers:{},wrong:{},done:{}};save();renderMode();}};
["sourceFilter","chapterFilter","typeFilter","searchBox"].forEach(id=>$(id).addEventListener("input",applyFilter));
initText();initFilters();applyFilter();""",
        """function bootPractice(){
document.querySelectorAll(".tab").forEach(btn=>btn.onclick=()=>setMode(btn.dataset.mode));
$("applyBtn").onclick=applyFilter;
$("clearBtn").onclick=()=>{if(confirm(UI.confirmClear)){state={answers:{},wrong:{},done:{}};save();renderMode();}};
["sourceFilter","chapterFilter","typeFilter","searchBox"].forEach(id=>$(id).addEventListener("input",applyFilter));
initText();initFilters();applyFilter();
}
studyHubLoadQuestions("data/community.json", "中华民族共同体").then(data => { QUESTIONS = data; studyIds = QUESTIONS.map(q=>q.id); bootPractice(); });""",
    ),
    "higher-math-down": (
        """document.addEventListener("DOMContentLoaded", () => {
  els.chapter = document.getElementById("chapterFilter");
  els.type = document.getElementById("typeFilter");
  els.search = document.getElementById("searchBox");
  els.panel = document.getElementById("questionPanel");
  initFilters();
  document.querySelectorAll(".tabs button").forEach(btn => btn.addEventListener("click", () => setMode(btn.dataset.mode)));
  els.chapter.addEventListener("change", () => { currentIndex = 0; render(); });
  els.type.addEventListener("change", () => { currentIndex = 0; render(); });
  els.search.addEventListener("input", () => { currentIndex = 0; render(); });
  document.getElementById("randomBtn").addEventListener("click", randomQuestion);
  document.getElementById("resetBtn").addEventListener("click", () => {
    if (currentList[currentIndex]) resetQuestion(currentList[currentIndex]);
  });
  render();
});""",
        """document.addEventListener("DOMContentLoaded", () => {
  els.chapter = document.getElementById("chapterFilter");
  els.type = document.getElementById("typeFilter");
  els.search = document.getElementById("searchBox");
  els.panel = document.getElementById("questionPanel");
  studyHubLoadQuestions("data/higher-math-down.json", "高等数学(下)").then(data => {
    QUESTIONS = data;
    initFilters();
    document.querySelectorAll(".tabs button").forEach(btn => btn.addEventListener("click", () => setMode(btn.dataset.mode)));
    els.chapter.addEventListener("change", () => { currentIndex = 0; render(); });
    els.type.addEventListener("change", () => { currentIndex = 0; render(); });
    els.search.addEventListener("input", () => { currentIndex = 0; render(); });
    document.getElementById("randomBtn").addEventListener("click", randomQuestion);
    document.getElementById("resetBtn").addEventListener("click", () => {
      if (currentList[currentIndex]) resetQuestion(currentList[currentIndex]);
    });
    render();
  });
});""",
    ),
}


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8", newline="\n")


def extract_array(source: str, name: str):
    match = re.search(rf"\b(?:const|let|var)\s+{re.escape(name)}\s*=\s*\[", source)
    if not match:
        return None
    start = source.index("[", match.start())
    depth = 0
    in_string = False
    quote = ""
    escaped = False
    for i in range(start, len(source)):
        ch = source[i]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                in_string = False
            continue
        if ch in ("'", '"', "`"):
            in_string = True
            quote = ch
            continue
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                end = i + 1
                if end < len(source) and source[end] == ";":
                    end += 1
                return match.start(), end, source[start:i + 1]
    raise RuntimeError(f"{name} array end not found")


def add_loader_script(html: str) -> str:
    if "assets/question-loader.js" in html:
        return html
    marker = '<script src="assets/session-sync.js" defer></script>'
    if marker in html:
        return html.replace(marker, '<script src="assets/question-loader.js"></script>\n' + marker, 1)
    return html.replace("</head>", '<script src="assets/question-loader.js"></script>\n</head>', 1)


def migrate_subject(subject_id: str, html_name: str, var_name: str):
    html_path = ROOT / html_name
    html = read(html_path)
    data_path = DATA_DIR / f"{subject_id}.json"

    extracted = extract_array(html, var_name)
    if extracted:
        start, end, array_text = extracted
        data = json.loads(array_text)
        DATA_DIR.mkdir(exist_ok=True)
        if data or not data_path.exists():
            write(data_path, json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
        html = html[:start] + f"let {var_name} = [];" + html[end:]
    elif not data_path.exists():
        raise RuntimeError(f"{html_name}: no {var_name} array and no {data_path.name}")

    html = add_loader_script(html)

    if subject_id in BOOT_REPLACEMENTS:
        old, new = BOOT_REPLACEMENTS[subject_id]
        if new not in html:
            if old not in html:
                raise RuntimeError(f"{html_name}: boot marker not found")
            html = html.replace(old, new, 1)
    if subject_id in FULL_BLOCK_REPLACEMENTS:
        old, new = FULL_BLOCK_REPLACEMENTS[subject_id]
        if new not in html:
            if old not in html:
                raise RuntimeError(f"{html_name}: full boot block not found")
            html = html.replace(old, new, 1)

    write(html_path, html)


def update_subjects():
    path = ROOT / "subjects.json"
    data = json.loads(read(path))
    data["colleges"] = [
        {"id": "computer-science", "title": "计算机科学技术学院", "order": 10},
        {"id": "marxism", "title": "马克思主义学院", "order": 20},
        {"id": "mathematics", "title": "数学科学学院", "order": 30},
    ]
    college_by_subject = {
        "route-switching": "computer-science",
        "network-security": "computer-science",
        "data-collection": "computer-science",
        "data-structure": "computer-science",
        "linux-course": "computer-science",
        "modern-history": "marxism",
        "community": "marxism",
        "higher-math-down": "mathematics",
    }
    for subject in data["subjects"]:
        sid = subject["id"]
        subject["college"] = college_by_subject.get(sid, "computer-science")
        subject["dataFile"] = f"data/{sid}.json"
    write(path, json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def main():
    for subject_id, (html_name, var_name) in SUBJECT_FILES.items():
        migrate_subject(subject_id, html_name, var_name)
        print(f"migrated {subject_id}")
    update_subjects()


if __name__ == "__main__":
    main()
