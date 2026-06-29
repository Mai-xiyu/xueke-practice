from __future__ import annotations

import html
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "modern_history_practice.html"

SOURCE = "2026年中国近代史期末试题A卷.docx"
CHAPTER = "2026 A卷"
TAG = "modern-history-2026-a"


QUESTIONS_2026_A = [
    {
        "id": "mh-2026a-single-001",
        "type": "single",
        "stem": "卢沟桥事变爆发后，中国进入全民族抗战阶段，并开辟了世界反法西斯战争的东方主战场。",
        "options": {"A": "九一八事变", "B": "卢沟桥事变", "C": "西安事变", "D": "福建事变"},
        "correct": ["B"],
        "analysis": "1937年卢沟桥事变爆发后，中国抗日战争进入全民族抗战阶段，中国战场成为世界反法西斯战争的东方主战场。",
    },
    {
        "id": "mh-2026a-single-002",
        "type": "single",
        "stem": "洋务派从19世纪70到90年代建立的四支水师中，（）是海军主力。",
        "options": {"A": "福建水师", "B": "广东水师", "C": "南洋水师", "D": "北洋水师"},
        "correct": ["D"],
        "analysis": "洋务派建立的福建、广东、南洋、北洋四支水师中，北洋水师规模最大，是清政府海军主力。",
    },
    {
        "id": "mh-2026a-single-003",
        "type": "single",
        "stem": "党在社会主义初级阶段的基本路线是：领导和团结全国各族人民，以（）为中心，坚持四项基本原则，坚持改革开放，自力更生，艰苦创业，为把我国建设成为富强、民主、文明的社会主义现代化国家而奋斗。",
        "options": {"A": "政治改革", "B": "经济建设", "C": "丰富文化", "D": "发展军事"},
        "correct": ["B"],
        "analysis": "社会主义初级阶段基本路线的核心表述是“一个中心、两个基本点”，其中“一个中心”就是以经济建设为中心。",
    },
    {
        "id": "mh-2026a-single-004",
        "type": "single",
        "stem": "1895年，（）强迫清政府签订《马关条约》，割去中国台湾全岛及所有附属各岛屿和澎湖列岛。",
        "options": {"A": "日本", "B": "英国", "C": "法国", "D": "美国"},
        "correct": ["A"],
        "analysis": "甲午战争失败后，1895年日本强迫清政府签订《马关条约》，割占台湾全岛及附属岛屿、澎湖列岛。",
    },
    {
        "id": "mh-2026a-single-005",
        "type": "single",
        "stem": "标志着以“自强”“求富”为目标的洋务运动的失败。",
        "options": {"A": "林则徐被贬新疆伊犁", "B": "英法军队攻占北京", "C": "北洋海军全军覆没", "D": "《辛丑条约》签订"},
        "correct": ["C"],
        "analysis": "甲午战争中北洋海军全军覆没，集中暴露了洋务运动“中体西用”道路的局限，标志洋务运动失败。",
    },
    {
        "id": "mh-2026a-single-006",
        "type": "single",
        "stem": "1920年8月，（）翻译的《共产党宣言》中文全译本公开出版。这是《共产党宣言》第一个中文全译本。",
        "options": {"A": "李汉俊", "B": "蔡和森", "C": "陈望道", "D": "周恩来"},
        "correct": ["C"],
        "analysis": "1920年8月，陈望道翻译的《共产党宣言》中文全译本出版，对马克思主义在中国传播产生重要影响。",
    },
    {
        "id": "mh-2026a-single-007",
        "type": "single",
        "stem": "清政府于1901年宣布实行“新政”以后，又于1906年宣布“预备仿行宪政”，于1908年颁布《钦定宪法大纲》，制定了预备立宪期为9年的君主立宪方案。清政府改革的根本目的在于（）。",
        "options": {"A": "延续清王朝的反动统治", "B": "发展资本主义", "C": "缓和阶级矛盾", "D": "挽救民族危机"},
        "correct": ["A"],
        "analysis": "清末新政和预备立宪没有触动封建专制统治根基，其根本目的在于挽救并延续清王朝统治。",
    },
    {
        "id": "mh-2026a-single-008",
        "type": "single",
        "stem": "“无量头颅无量血，可怜购得假共和”。辛亥革命之所以失败，从根本上说，是因为（）。",
        "options": {
            "A": "没有提出彻底的反帝反封建的革命纲领",
            "B": "不能充分发动和依靠人民群众",
            "C": "不能建立坚强的革命政党，作为团结一切革命力量的强有力的核心",
            "D": "在帝国主义时代，在半殖民地半封建的中国，资本主义的建国方案行不通",
        },
        "correct": ["D"],
        "analysis": "辛亥革命失败的根本原因在于半殖民地半封建中国不具备资产阶级共和国方案成功的社会条件。",
    },
    {
        "id": "mh-2026a-single-009",
        "type": "single",
        "stem": "中国历史上第一部具有资产阶级共和国宪法性质的法典是（）。",
        "options": {"A": "《中华民国临时约法》", "B": "《钦定宪法大纲》", "C": "《中华民国约法》", "D": "《中华民国宪法》"},
        "correct": ["A"],
        "analysis": "1912年颁布的《中华民国临时约法》是中国历史上第一部具有资产阶级共和国宪法性质的法典。",
    },
    {
        "id": "mh-2026a-single-010",
        "type": "single",
        "stem": "十月革命一声炮响，给中国送来了（）。",
        "options": {"A": "无政府主义", "B": "新黑格尔主义", "C": "新康德主义", "D": "马克思列宁主义"},
        "correct": ["D"],
        "analysis": "俄国十月革命推动马克思列宁主义在中国传播，为中国先进分子探索救国道路提供了新的思想武器。",
    },
    {
        "id": "mh-2026a-single-011",
        "type": "single",
        "stem": "中国工人阶级政党最早的组织，是在中国工人阶级最密集的中心城市（）建立的。",
        "options": {"A": "上海", "B": "广州", "C": "武汉", "D": "南京"},
        "correct": ["A"],
        "analysis": "1920年陈独秀等在上海建立中国共产党早期组织，上海是近代中国工人阶级较为集中的中心城市。",
    },
    {
        "id": "mh-2026a-single-012",
        "type": "single",
        "stem": "五四运动时期，中国（）开始以独立的姿态登上政治舞台。",
        "options": {"A": "小资产阶级知识分子", "B": "封建军阀势力", "C": "工人阶级", "D": "农民阶级"},
        "correct": ["C"],
        "analysis": "五四运动中，中国工人阶级以独立政治力量登上历史舞台，显示出新的革命领导力量。",
    },
    {
        "id": "mh-2026a-single-013",
        "type": "single",
        "stem": "“须知政权是由枪杆子中取得的。”是毛泽东在（）提出的。",
        "options": {"A": "中共五大", "B": "八七会议", "C": "古田会议", "D": "赣南会议"},
        "correct": ["B"],
        "analysis": "1927年八七会议上，毛泽东提出“须知政权是由枪杆子中取得的”重要论断。",
    },
    {
        "id": "mh-2026a-single-014",
        "type": "single",
        "stem": "1870年代，中亚浩罕汗国将领阿古柏在英、俄支持下侵占新疆。（）受命率兵展开收复新疆的军事行动，捍卫了国家领土和主权完整。",
        "options": {"A": "李鸿章", "B": "左宗棠", "C": "张之洞", "D": "奕䜣"},
        "correct": ["B"],
        "analysis": "左宗棠率军收复新疆，维护了国家领土主权完整，是近代中国反分裂斗争的重要事件。",
    },
    {
        "id": "mh-2026a-single-015",
        "type": "single",
        "stem": "1927年8月1日，在以周恩来为书记的前敌委员会领导下，贺龙、叶挺、朱德、刘伯承等率领共产党掌握和影响的军队2万多人，在（）打响了武装反抗国民党反动派的第一枪。",
        "options": {"A": "广州", "B": "南昌", "C": "长沙", "D": "井冈山"},
        "correct": ["B"],
        "analysis": "南昌起义打响了武装反抗国民党反动派的第一枪，是中国共产党独立领导革命战争、创建人民军队的开端。",
    },
    {
        "id": "mh-2026a-single-016",
        "type": "single",
        "stem": "宣告中国人民当家作主时代的到来，中华民族以崭新的姿态屹立于世界民族之林的是（）。",
        "options": {"A": "抗日战争的胜利", "B": "中华人民共和国的成立", "C": "社会主义制度的建立", "D": "社会主义改造的完成"},
        "correct": ["B"],
        "analysis": "中华人民共和国成立，标志中国人民从此站起来了，中国人民当家作主的时代到来。",
    },
    {
        "id": "mh-2026a-single-017",
        "type": "single",
        "stem": "甲午战争后，严复翻译《天演论》所宣传的重要思想是（）。",
        "options": {"A": "师夷长技以制夷", "B": "中学为体，西学为用", "C": "物竞天择，适者生存", "D": "天下兴亡，匹夫有责"},
        "correct": ["C"],
        "analysis": "严复翻译《天演论》，传播“物竞天择，适者生存”等进化论思想，对近代思想启蒙影响很大。",
    },
    {
        "id": "mh-2026a-single-018",
        "type": "single",
        "stem": "1945年（），日本天皇裕仁发布《终战诏书》，日本无条件投降。",
        "options": {"A": "8月9日", "B": "8月15日", "C": "9月3日", "D": "10月25日"},
        "correct": ["B"],
        "analysis": "1945年8月15日，日本天皇发布《终战诏书》，宣布无条件投降。",
    },
    {
        "id": "mh-2026a-single-019",
        "type": "single",
        "stem": "（）的和平解决成为时局转换的枢纽，十年内战局面基本结束，国内和平初步实现。",
        "options": {"A": "华北事变", "B": "西安事变", "C": "一·二八事变", "D": "皖南事变"},
        "correct": ["B"],
        "analysis": "西安事变和平解决成为时局转换的枢纽，推动抗日民族统一战线初步形成。",
    },
    {
        "id": "mh-2026a-single-020",
        "type": "single",
        "stem": "1947年10月10日，中国人民解放军总部发表宣言，提出（）的口号，极大鼓舞了解放军全体指战员和全国人民的斗志。",
        "options": {"A": "打倒蒋介石，解放全中国", "B": "停止内战，一致对外", "C": "反对华北自治", "D": "避敌主力、打其虚弱"},
        "correct": ["A"],
        "analysis": "1947年10月10日，中国人民解放军总部发表宣言，提出“打倒蒋介石，解放全中国”的口号。",
    },
    {
        "id": "mh-2026a-single-021",
        "type": "single",
        "stem": "1947年7月至9月，中国共产党制定的（），明确规定“废除封建性及半封建性剥削的土地制度”。",
        "options": {"A": "《中国土地法大纲》", "B": "《井冈山土地法》", "C": "《中华人民共和国土地法》", "D": "《关于土地问题的指示》"},
        "correct": ["A"],
        "analysis": "《中国土地法大纲》规定废除封建性及半封建性剥削的土地制度，实行耕者有其田。",
    },
    {
        "id": "mh-2026a-single-022",
        "type": "single",
        "stem": "解放区进行的土地制度改革使农民进一步认识到（）是他们自身利益的坚决维护者。",
        "options": {"A": "中国国民党", "B": "中国共产党", "C": "民族资产阶级", "D": "小资产阶级知识分子"},
        "correct": ["B"],
        "analysis": "解放区土地改革满足农民土地要求，使农民认识到中国共产党代表并维护人民利益。",
    },
    {
        "id": "mh-2026a-single-023",
        "type": "single",
        "stem": "《论十大关系》提出，在共产党和民主党派的关系上实行（）的方针，确认中国共产党领导的统一战线和多党合作要继续存在、发挥作用。",
        "options": {"A": "长期共存，互相监督", "B": "发展进步势力、争取中间势力、反对顽固势力", "C": "以斗争求团结", "D": "关门主义"},
        "correct": ["A"],
        "analysis": "毛泽东在《论十大关系》中提出共产党同民主党派实行“长期共存，互相监督”的方针。",
    },
    {
        "id": "mh-2026a-single-024",
        "type": "single",
        "stem": "1973年，以袁隆平为代表的农业科学家在世界上首次培育成功强优势的（）。",
        "options": {"A": "海水稻", "B": "籼型杂交水稻", "C": "杂交燕麦", "D": "杂交玉米"},
        "correct": ["B"],
        "analysis": "1973年，以袁隆平为代表的科研团队在世界上首次培育成功强优势的籼型杂交水稻。",
    },
    {
        "id": "mh-2026a-multiple-001",
        "type": "multiple",
        "stem": "资本帝国主义列强对中国的侵略方式有（）。",
        "options": {"A": "军事侵略", "B": "政治控制", "C": "经济掠夺", "D": "文化渗透"},
        "correct": ["A", "B", "C", "D"],
        "analysis": "资本帝国主义对中国的侵略包括军事侵略、政治控制、经济掠夺和文化渗透等方面。",
    },
    {
        "id": "mh-2026a-multiple-002",
        "type": "multiple",
        "stem": "以下关于太平天国农民起义的历史意义，正确的有（）。",
        "options": {
            "A": "太平天国起义沉重打击了封建统治阶级，强烈撼动了清政府的统治根基",
            "B": "太平天国起义作为亚洲民族解放运动之一，冲击了西方殖民主义者在亚洲的统治",
            "C": "太平天国起义在一定程度上削弱了封建统治的精神支柱",
            "D": "太平天国起义有力地打击了外国侵略势力",
        },
        "correct": ["A", "B", "C", "D"],
        "analysis": "太平天国起义既沉重打击清王朝封建统治，也冲击外国侵略势力，并对封建正统思想产生冲击。",
    },
    {
        "id": "mh-2026a-multiple-003",
        "type": "multiple",
        "stem": "戊戌维新运动是一次爱国救亡运动，维新派在民族危亡的关键时刻（）。",
        "options": {
            "A": "高举救亡图存的旗帜",
            "B": "要求通过变法，发展资本主义，使中国走上富强的道路",
            "C": "成功地建立起存在百日的君主立宪制度",
            "D": "其政治实践和思想理论，贯穿着强烈的爱国主义精神，推动了中华民族的觉醒",
        },
        "correct": ["A", "B", "D"],
        "analysis": "戊戌维新运动具有爱国救亡和思想启蒙意义，但并未成功建立君主立宪制度。",
    },
    {
        "id": "mh-2026a-multiple-004",
        "type": "multiple",
        "stem": "在中外反动派的严重压迫下，20世纪初，各阶层人民的斗争风起云涌、遍及全国，包括（）。",
        "options": {
            "A": "各阶层人民的反洋教斗争",
            "B": "拒俄、拒法、抵制美货等爱国运动",
            "C": "农民、手工业者的抗租、抗捐、抗税斗争",
            "D": "工人罢工，商人罢市",
        },
        "correct": ["A", "B", "C", "D"],
        "analysis": "20世纪初民族危机和社会矛盾加深，反洋教、抵制外货、抗租抗税、罢工罢市等斗争广泛出现。",
    },
    {
        "id": "mh-2026a-multiple-005",
        "type": "multiple",
        "stem": "五四运动孕育了以（）为主要内容的伟大五四精神。",
        "options": {"A": "爱国", "B": "进步", "C": "民主", "D": "科学"},
        "correct": ["A", "B", "C", "D"],
        "analysis": "五四精神的主要内容是爱国、进步、民主、科学，核心是爱国主义。",
    },
    {
        "id": "mh-2026a-multiple-006",
        "type": "multiple",
        "stem": "中国早期马克思主义者的队伍中，（）属于先驱者和擎旗人，毛泽东等五四运动的左翼骨干则是其主体部分。",
        "options": {"A": "李大钊", "B": "蔡元培", "C": "陈独秀", "D": "杨昌济"},
        "correct": ["A", "C"],
        "analysis": "中国早期马克思主义者中，李大钊、陈独秀是先驱者和擎旗人。",
    },
    {
        "id": "mh-2026a-judge-001",
        "type": "judge",
        "stem": "新兴的工人阶级是近代中国最革命的阶级。",
        "options": {"A": "对", "B": "错"},
        "correct": ["A"],
        "analysis": "中国工人阶级受帝国主义、封建势力和资产阶级三重压迫，组织性纪律性强，是近代中国最革命的阶级。",
    },
    {
        "id": "mh-2026a-judge-002",
        "type": "judge",
        "stem": "由于近代中国处于资本-帝国主义列强的争夺和间接统治之下，以及在地方性的农业经济的基础上形成的地方割据势力的存在，近代中国各地区经济、政治和文化的发展是极不平衡的。",
        "options": {"A": "对", "B": "错"},
        "correct": ["A"],
        "analysis": "近代中国半殖民地半封建社会受外部列强和内部割据共同影响，地区发展极不平衡。",
    },
    {
        "id": "mh-2026a-judge-003",
        "type": "judge",
        "stem": "戊戌维新运动的失败，说明在半殖民地半封建的中国，企图通过统治者自上而下的改良道路，是根本行不通的。",
        "options": {"A": "对", "B": "错"},
        "correct": ["A"],
        "analysis": "戊戌维新依赖没有实权的皇帝和少数官僚，脱离广大群众，失败说明改良道路在当时中国行不通。",
    },
    {
        "id": "mh-2026a-judge-004",
        "type": "judge",
        "stem": "五四运动的直接斗争目标并没有得以实现。",
        "options": {"A": "对", "B": "错"},
        "correct": ["B"],
        "analysis": "五四运动的直接斗争目标基本实现，包括释放被捕学生、罢免卖国贼职务、中国代表拒绝在和约上签字。",
    },
    {
        "id": "mh-2026a-short-001",
        "type": "short",
        "stem": "请简述五四运动的历史意义。",
        "options": {},
        "answer": "五四运动是中国旧民主主义革命走向新民主主义革命的转折点，促进了马克思主义在中国的传播，促进了马克思主义同中国工人运动的结合，为中国共产党的成立做了思想上和干部上的准备。五四运动孕育了以爱国、进步、民主、科学为主要内容的伟大五四精神，其核心是爱国主义。五四运动以全民族的行动激发了追求真理、追求进步的伟大觉醒，并以全民族的搏击培育了永久奋斗的伟大传统。",
        "analysis": "主观题按参考答案自评，答题时要写出转折点、马克思主义传播、建党准备、五四精神等关键词。",
    },
    {
        "id": "mh-2026a-short-002",
        "type": "short",
        "stem": "简述抗日战争取得胜利的原因。",
        "options": {},
        "answer": "第一，以爱国主义为核心的民族精神是决定因素。第二，中国共产党的中流砥柱作用是关键。第三，全民族抗战是重要法宝。第四，同世界所有爱好和平和正义的国家和人民、国际组织以及各种反法西斯力量的同情和支持分不开。",
        "analysis": "主观题按参考答案自评，建议从民族精神、中国共产党作用、全民族抗战、国际支持四个角度分点作答。",
    },
    {
        "id": "mh-2026a-essay-001",
        "type": "essay",
        "stem": "结合史实论述为什么说“没有共产党，就没有新中国”？",
        "options": {},
        "answer": "中国共产党是用马克思主义科学理论武装起来、以马克思主义中国化理论成果作为行动指南的工人阶级政党，不仅代表中国工人阶级的利益，而且代表整个中华民族和全中国人民的利益，能够制定适合中国情况、符合中国人民利益的路线方针政策，为中国人民斗争指明正确方向。中国共产党人始终坚持初心使命，为中国人民的解放事业作出巨大贡献。中国共产党从诞生之日起，就把为中国人民谋幸福、为中华民族谋复兴确立为自己的初心使命，找到夺取革命胜利的道路，把中国人民团结成为不可战胜的力量。无数中国共产党人前赴后继、不懈奋斗，作出了巨大牺牲。历史证明，“没有共产党，就没有新中国”是中国人民从切身体验中确认的客观真理。",
        "analysis": "论述题按参考答案自评，结构上可从党的性质和理论、路线方针、初心使命、革命贡献、历史结论等方面展开。",
    },
]


def norm_stem(value: str) -> str:
    text = html.unescape(str(value or ""))
    text = re.sub(r"\s+", "", text)
    return re.sub(r"[，。、“”‘’《》：；,.!?？！（）()\[\]【】·\-—_\"']", "", text).lower()


def extract_array(text: str, marker: str) -> tuple[int, int, list]:
    start = text.index(marker) + len(marker)
    array_start = text.index("[", start)
    depth = 0
    in_string = False
    escaped = False
    for index, char in enumerate(text[array_start:], array_start):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                return array_start, index + 1, json.loads(text[array_start : index + 1])
    raise ValueError("array end not found")


def source_question(raw: dict) -> dict:
    question = dict(raw)
    question["source"] = SOURCE
    question["chapter"] = CHAPTER
    question["examTags"] = [TAG]
    question.setdefault("options", {})
    return question


def merge_questions(existing: list[dict]) -> tuple[list[dict], int, int, int]:
    managed_ids = {q["id"] for q in QUESTIONS_2026_A}
    questions = [q for q in existing if q.get("id") not in managed_ids and q.get("source") != SOURCE]
    removed = len(existing) - len(questions)
    seen = {norm_stem(q.get("stem") or q.get("title")): q for q in questions}
    added = 0
    duplicates = 0
    for raw in QUESTIONS_2026_A:
        incoming = source_question(raw)
        key = norm_stem(incoming["stem"])
        target = seen.get(key)
        if target:
            tags = set(target.get("examTags") or [])
            tags.add(TAG)
            target["examTags"] = sorted(tags)
            if not target.get("correct") and incoming.get("correct"):
                target["correct"] = incoming["correct"]
            if not target.get("answer") and incoming.get("answer"):
                target["answer"] = incoming["answer"]
            if not target.get("analysis") and incoming.get("analysis"):
                target["analysis"] = incoming["analysis"]
            duplicates += 1
            continue
        questions.append(incoming)
        seen[key] = incoming
        added += 1
    return questions, added, duplicates, removed


def main() -> None:
    text = HTML.read_text(encoding="utf-8")
    start, end, existing = extract_array(text, "const QUESTIONS = ")
    questions, added, duplicates, removed = merge_questions(existing)
    replacement = json.dumps(questions, ensure_ascii=False, indent=2)
    text = text[:start] + replacement + text[end:]
    text = re.sub(
        r"<p class=\"muted\">.*?</p>",
        "<p class=\"muted\">截图题库、学习通章节测验、2023 B 卷、2026 A 卷与模拟试卷题源；模拟考试采用最新格式：30 单选、15 多选、10 判断、2 简答、1 论述。</p>",
        text,
        count=1,
        flags=re.S,
    )
    HTML.write_text(text, encoding="utf-8")
    print(json.dumps({"added": added, "duplicates": duplicates, "removed_previous": removed, "total": len(questions)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
