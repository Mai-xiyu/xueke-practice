from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def replace_array(path: Path, const_name: str, updater) -> int:
    text = path.read_text(encoding="utf-8")
    marker = f"const {const_name} = "
    start = text.index(marker)
    array_start = text.index("[", start)
    depth = 0
    in_string = False
    quote = ""
    escaped = False
    array_end = None
    for index in range(array_start, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                in_string = False
            continue
        if char in "\"'":
            in_string = True
            quote = char
        elif char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                array_end = index
                break
    if array_end is None:
        raise RuntimeError(f"question array end not found: {path}")

    questions = json.loads(text[array_start : array_end + 1])
    questions = updater(questions)
    path.write_text(
        text[:array_start] + json.dumps(questions, ensure_ascii=False, separators=(",", ":")) + text[array_end + 1 :],
        encoding="utf-8",
    )
    return len(questions)


DATA_STRUCTURE_SHORTS = [
    (
        "Dijkstra算法",
        "简述Dijkstra算法求单源最短路径的基本思想，以及它为什么不能处理负权边。",
        "Dijkstra算法从源点出发，维护已确定最短距离的顶点集合和未确定集合。每次选择当前距离最小的未确定顶点，将其加入已确定集合，并用它的出边松弛相邻顶点的距离。它不能处理负权边，因为算法一旦把某顶点的距离确定下来就不会再回退；负权边可能在后续路径中继续降低已经确定的距离，破坏贪心选择的正确性。",
    ),
    (
        "排序",
        "简述排序算法中“内部排序”与“外部排序”的区别。",
        "内部排序指待排序记录能够全部装入内存，排序过程主要在内存中完成。外部排序用于数据量超过内存容量的场景，需要借助磁盘等外存，排序过程涉及分块、归并和外存读写，主要瓶颈通常在I/O。",
    ),
    (
        "树与二叉树",
        "简述二叉排序树的定义、核心特性，以及其在数据查找中的优势。",
        "二叉排序树又称二叉搜索树，或者为空树，或者满足：左子树所有结点关键字小于根结点，右子树所有结点关键字大于根结点，左右子树也分别是二叉排序树。它的中序遍历结果有序，查找时可根据大小关系每次排除一侧子树，平均情况下查找效率较高。",
    ),
    (
        "树与二叉树",
        "简述完全二叉树和满二叉树的区别，以及完全二叉树的存储优势。",
        "满二叉树是除叶子结点外每个结点都有两个孩子，且所有叶子在同一层的二叉树。完全二叉树要求除最后一层外各层都满，最后一层结点从左到右连续排列。完全二叉树适合顺序存储，父子下标关系固定，可减少指针开销，堆通常采用这种存储方式。",
    ),
    (
        "串",
        "简述串的两种基本存储方式（定长顺序存储和堆分配存储）的区别。",
        "定长顺序存储用固定长度数组保存串，结构简单、访问直接，但最大长度受数组容量限制，容易截断或浪费空间。堆分配存储根据实际长度动态申请空间，空间利用更灵活，适合长度变化较大的串，但需要额外的动态内存管理。",
    ),
    (
        "树与二叉树",
        "简述线索二叉树的基本概念，以及引入线索二叉树的目的与应用价值。",
        "线索二叉树是在二叉链表的空指针域中保存遍历序列中前驱或后继信息的二叉树。引入线索的目的是利用空指针、减少遍历时对栈或递归的依赖，使按某种遍历顺序寻找前驱和后继更方便，适合频繁按遍历序列访问结点的场景。",
    ),
    (
        "栈与队列",
        "简述队列的特性、核心操作，并举出两个计算机领域的典型应用场景。",
        "队列是一种先进先出的线性结构，只允许在队尾入队、在队头出队，核心操作包括初始化、入队、出队、取队头、判空等。典型应用包括操作系统中的进程就绪队列、打印任务队列、网络请求排队和广度优先搜索。",
    ),
    (
        "线性表",
        "简述顺序存储结构与链式存储结构的主要区别。",
        "顺序存储用一段连续内存保存元素，逻辑相邻的元素物理位置也相邻，支持随机访问，但插入删除通常需要移动元素。链式存储通过指针或链接域表示元素关系，不要求连续空间，插入删除更灵活，但访问第i个元素通常需要从头遍历。",
    ),
    (
        "树与二叉树",
        "简述二叉树的顺序存储结构与链式存储结构各自的优缺点及适用场景。",
        "顺序存储用数组表示二叉树，适合完全二叉树或接近完全的二叉树，父子下标计算方便、无指针开销，但对稀疏二叉树会浪费空间。链式存储用结点和左右指针表示，适合一般形态二叉树，结构灵活、空间按需分配，但需要额外指针域。",
    ),
    (
        "查找",
        "简述哈希冲突的产生原因，并说明开放定址法解决冲突的核心原理。",
        "哈希冲突是指不同关键字经过哈希函数映射到同一地址。开放定址法在冲突发生时不使用额外链表，而是在哈希表内部按照某种探测序列继续寻找下一个空闲地址；查找时也按同一探测序列进行。",
    ),
    (
        "图",
        "简述关键路径的基本概念及其在工程管理中的实际应用价值。",
        "关键路径是AOE网中从源点到汇点路径长度最大的路径，路径上的活动称为关键活动。关键路径决定整个工程的最短完成时间，关键活动延误会直接导致总工期延误，因此可用于识别工程进度控制重点、安排资源和评估工期风险。",
    ),
    (
        "图",
        "简述图的深度优先遍历（DFS）和广度优先遍历（BFS）的区别。",
        "DFS从某个顶点出发，沿一条路径尽可能深入，无法继续时再回溯，通常借助递归或栈实现。BFS按层次向外扩展，先访问距离起点近的顶点，通常借助队列实现。DFS适合连通性、拓扑和回溯类问题，BFS适合无权图最短路径和层次遍历。",
    ),
    (
        "树与二叉树",
        "简述二叉树的三种遍历方式，并说明各自的应用场景。",
        "二叉树常见遍历有先序、中序和后序。先序按根、左、右访问，适合复制树或输出结构；中序按左、根、右访问，在二叉排序树中可得到有序序列；后序按左、右、根访问，适合释放树、计算表达式树或自底向上处理问题。",
    ),
    (
        "算法",
        "简述递归算法的优缺点，以及栈结构在递归执行过程中的核心作用。",
        "递归算法表达自然，适合具有自相似结构的问题，如树遍历、分治和回溯；缺点是函数调用开销较大，递归层数过深可能导致栈溢出，也可能重复计算。递归执行依赖调用栈保存每一层的参数、局部变量和返回位置，回溯时按后进先出顺序恢复现场。",
    ),
    (
        "排序",
        "简述堆排序的基本思想及其优缺点。",
        "堆排序先把待排序序列建成大根堆或小根堆，再反复将堆顶元素与当前末尾元素交换，并调整剩余元素保持堆性质。优点是时间复杂度稳定为O(nlogn)、空间复杂度O(1)；缺点是不稳定，实际常数和数据局部性通常不如快速排序。",
    ),
    (
        "图",
        "简述最小生成树的概念及其两种经典算法（Prim算法和Kruskal算法）的核心思想。",
        "最小生成树是在连通无向带权图中连接全部顶点且总权值最小的生成树。Prim算法从一个顶点开始，每次选择连接已选顶点集合和未选顶点集合的最小边扩展；Kruskal算法按边权从小到大选择边，只要不形成环就加入，直到选出n-1条边。",
    ),
    (
        "栈与队列",
        "简述栈和队列的区别与联系。",
        "栈和队列都是操作受限的线性表。栈遵循后进先出，只在栈顶插入和删除；队列遵循先进先出，在队尾插入、队头删除。二者都可用顺序存储或链式存储实现，常用于控制处理顺序，如递归调用、表达式求值、任务排队和BFS。",
    ),
    (
        "图",
        "简述AOE网中关键路径的求解思路。",
        "求AOE网关键路径通常先进行拓扑排序，计算各事件的最早发生时间ve；再按逆拓扑序计算各事件的最迟发生时间vl。对每条活动边求活动最早开始时间e和最迟开始时间l，若e等于l，则该活动为关键活动，由关键活动组成的从源点到汇点的路径就是关键路径。",
    ),
    (
        "线性表",
        "简述线性表链式存储结构的优缺点，并说明链式存储为何不支持随机存取？",
        "链式存储的优点是不要求连续空间，插入删除只需修改指针，动态扩展方便；缺点是每个结点需要额外指针域，存储密度较低，查找第i个元素需要遍历。它不支持随机存取，是因为元素物理位置不连续，无法通过下标直接计算地址，只能沿链逐结点访问。",
    ),
    (
        "查找",
        "简述哈希查找中“装填因子”的概念、对查找效率的影响，以及常用的冲突解决方法。",
        "装填因子通常定义为表中已存记录数与哈希表长度之比，反映哈希表的满程度。装填因子越大，冲突概率越高，查找平均长度通常增加。常用冲突解决方法包括开放定址法、链地址法、再哈希法和建立公共溢出区等。",
    ),
    (
        "串",
        "简述串的模式匹配中，KMP算法相对于朴素匹配算法的改进之处。",
        "朴素匹配失败后通常将模式串整体右移一位，主串指针可能反复回退。KMP算法利用模式串自身的前后缀信息构造next数组，匹配失败时根据next值移动模式串，使主串指针不回退，从而避免大量重复比较，时间复杂度可达到O(n+m)。",
    ),
    (
        "图",
        "简述拓扑排序的核心思想与执行步骤，并说明其适用场景。",
        "拓扑排序用于有向无环图。核心思想是不断选择入度为0的顶点输出，并删除该顶点及其出边，更新相关顶点入度，直到所有顶点输出或发现仍有顶点未输出。它适用于课程先修关系、工程任务依赖、编译依赖等需要按先后约束排序的场景。",
    ),
    (
        "查找",
        "简述折半查找的查找过程、前提条件，并说明为什么要求顺序存储且有序。",
        "折半查找每次取查找区间中间元素与目标比较，若相等则成功，若目标较小则在左半区继续，否则在右半区继续。它要求线性表有序，并且采用顺序存储或可随机访问结构，因为算法需要直接定位中间位置；链式结构无法高效按下标访问中点。",
    ),
    (
        "树与二叉树",
        "简述二叉排序树的核心特性及其查找优势（补充）。",
        "二叉排序树的核心特性是左子树关键字小于根，右子树关键字大于根，且左右子树递归满足该性质。查找时从根结点开始比较关键字，小则进入左子树，大则进入右子树，平均情况下可减少比较次数；若树高度接近logn，查找效率较高。",
    ),
    (
        "图",
        "简述图的邻接矩阵和邻接表两种存储结构的优缺点及适用场景。",
        "邻接矩阵用二维数组表示顶点间关系，判断两点是否相邻很快，适合稠密图，但空间复杂度为O(n²)。邻接表为每个顶点保存边表，空间与顶点数和边数相关，适合稀疏图，遍历某顶点邻接点方便，但判断任意两点是否相邻需要扫描边表。",
    ),
    (
        "广义表",
        "简述广义表的定义、表头和表尾的概念，以及广义表的应用价值。",
        "广义表是由零个或多个元素组成的有限序列，元素可以是原子，也可以是子表。非空广义表的第一个元素称为表头，除表头外其余元素组成的表称为表尾，表尾一定是广义表。广义表可表示层次结构、嵌套数据和符号表达式。",
    ),
    (
        "树与二叉树",
        "简述平衡二叉树（AVL树）的定义与平衡调整的基本思想。",
        "AVL树是一种二叉排序树，任一结点左右子树高度差的绝对值不超过1。插入或删除后若破坏平衡，需要通过旋转调整，包括单旋和双旋，使树重新满足平衡条件。保持平衡可以避免二叉排序树退化为链表，提高查找、插入和删除效率。",
    ),
    (
        "树与二叉树",
        "简述二叉树中叶子结点与度为2的结点之间的数量关系（n₀ = n₂ + 1），并说明如何通过实例验证。",
        "在任意非空二叉树中，叶子结点数n0等于度为2的结点数n2加1。可由边数关系证明：总结点数n=n0+n1+n2，边数为n-1；另一方面边数也等于n1+2n2，联立可得n0=n2+1。实例中若某二叉树有3个度为2的结点，则应有4个叶子结点。",
    ),
    (
        "排序",
        "简述简单选择排序的基本思想及其稳定性。",
        "简单选择排序每一趟从未排序区间中选出最小或最大元素，与未排序区间的第一个位置交换，逐步扩大有序区间。它的比较次数固定为O(n²)，移动次数较少。由于交换可能跨过相同关键字元素，简单选择排序通常是不稳定排序。",
    ),
    (
        "排序",
        "简述直接插入排序的基本思想，并用一个实例说明其排序过程。",
        "直接插入排序把序列分为已排序区和未排序区，每次取未排序区第一个元素，在已排序区中从后向前比较并移动元素，为其插入到合适位置。例如序列[3,1,2]：先把1插入到3前得到[1,3,2]，再把2插入到1和3之间得到[1,2,3]。",
    ),
]


DATA_COLLECTION_PPT_QUESTIONS = [
    {
        "id": "DC-PPT2-001",
        "source": "网络数据采集2 PPT",
        "chapter": "HTTP请求头",
        "type": "single",
        "stem": "HTTP 请求头 header 通常用于存放哪类信息？",
        "options": {"A": "页面正文内容", "B": "请求相关的元信息或安全验证信息", "C": "数据库表结构", "D": "图片二进制像素"},
        "correct": ["B"],
        "analysis": "PPT说明 header 一般存放与请求相关的数据，也可能包含 User-Agent、token、cookie 等安全验证信息。",
    },
    {
        "id": "DC-PPT2-002",
        "source": "网络数据采集2 PPT",
        "chapter": "HTTP请求头",
        "type": "fill",
        "stem": "requests 发送请求时，请求头信息通常可以放在 ____ 参数中。",
        "options": {},
        "answers": ["headers"],
        "analysis": "requests 可通过 headers 参数传入请求头。",
    },
    {
        "id": "DC-PPT2-003",
        "source": "网络数据采集2 PPT",
        "chapter": "Cookie与Session",
        "type": "tf",
        "stem": "HTTP 是无状态协议，单独的请求之间默认不会记住用户登录状态。",
        "options": {"A": "对", "B": "错"},
        "correct": ["A"],
        "analysis": "PPT 用“服务器：你是谁啊？”说明 HTTP 默认无记忆能力。",
    },
    {
        "id": "DC-PPT2-004",
        "source": "网络数据采集2 PPT",
        "chapter": "Cookie与Session",
        "type": "single",
        "stem": "在模拟浏览器登录流程中，cookie 的主要作用是（ ）。",
        "options": {"A": "保存数据库索引", "B": "记录登录后的身份状态", "C": "压缩网页源码", "D": "替代 HTML 解析器"},
        "correct": ["B"],
        "analysis": "PPT流程为登录、得到 cookie、带 cookie 请求登录后页面。",
    },
    {
        "id": "DC-PPT2-005",
        "source": "网络数据采集2 PPT",
        "chapter": "Cookie与Session",
        "type": "single",
        "stem": "session 相比单次 HTTP 请求，核心作用是（ ）。",
        "options": {"A": "让会话持续跟踪用户状态", "B": "让网页自动生成 XPath", "C": "把响应转成 CSV", "D": "关闭所有 cookie"},
        "correct": ["A"],
        "analysis": "PPT将 session 描述为“有记忆力，可以看作一连串请求”。",
    },
    {
        "id": "DC-PPT2-006",
        "source": "网络数据采集2 PPT",
        "chapter": "Cookie与Session",
        "type": "short",
        "stem": "简述使用 cookie/session 爬取登录后数据的一般流程。",
        "options": {},
        "answer": "一般流程是：先提交登录请求；登录成功后保存服务器返回的 cookie 或使用 session 保持会话；随后带着 cookie/session 请求需要登录后才能访问的 URL；最后解析响应中的目标数据。",
        "analysis": "来自 PPT 的登录、得到 cookie、带 cookie 请求账户数据流程。",
    },
    {
        "id": "DC-PPT2-007",
        "source": "网络数据采集2 PPT",
        "chapter": "代理IP",
        "type": "single",
        "stem": "爬虫代理 IP 在访问目标网站时主要充当（ ）。",
        "options": {"A": "中间转发节点", "B": "数据库事务管理器", "C": "网页模板引擎", "D": "本地文件压缩器"},
        "correct": ["A"],
        "analysis": "PPT说明代理服务器负责请求转发和数据返回。",
    },
    {
        "id": "DC-PPT2-008",
        "source": "网络数据采集2 PPT",
        "chapter": "代理IP",
        "type": "tf",
        "stem": "使用代理时，程序可以先把请求发给代理服务器，再由代理服务器向目标网站访问。",
        "options": {"A": "对", "B": "错"},
        "correct": ["A"],
        "analysis": "这是 PPT 对代理 IP 工作方式的定义。",
    },
    {
        "id": "DC-PPT2-009",
        "source": "网络数据采集2 PPT",
        "chapter": "Scrapy",
        "type": "single",
        "stem": "Scrapy Engine 的主要职责是（ ）。",
        "options": {"A": "只负责写 CSV", "B": "负责 Spider、Pipeline、Downloader、Scheduler 之间的通信和数据传递", "C": "只负责安装浏览器驱动", "D": "只负责保存 cookie"},
        "correct": ["B"],
        "analysis": "PPT列出 Scrapy Engine 负责各组件之间的通讯、信号和数据传递。",
    },
    {
        "id": "DC-PPT2-010",
        "source": "网络数据采集2 PPT",
        "chapter": "Scrapy",
        "type": "single",
        "stem": "Scrapy Scheduler 的主要职责是（ ）。",
        "options": {"A": "接收、整理并调度 Request 请求", "B": "渲染前端 CSS", "C": "执行 SQL 建表", "D": "识别验证码"},
        "correct": ["A"],
        "analysis": "PPT说明 Scheduler 接收引擎发来的 Request，请求入队并在需要时交还给引擎。",
    },
    {
        "id": "DC-PPT2-011",
        "source": "网络数据采集2 PPT",
        "chapter": "Scrapy",
        "type": "single",
        "stem": "Scrapy Downloader 的主要职责是（ ）。",
        "options": {"A": "下载引擎发送的请求并返回 Response", "B": "定义 Item 字段", "C": "保存项目配置文件", "D": "编写 XPath 表达式"},
        "correct": ["A"],
        "analysis": "PPT说明 Downloader 下载 Requests，并将 Responses 交还给引擎。",
    },
    {
        "id": "DC-PPT2-012",
        "source": "网络数据采集2 PPT",
        "chapter": "Scrapy",
        "type": "single",
        "stem": "Scrapy Spider 的主要职责是（ ）。",
        "options": {"A": "处理 Response、提取数据并提交后续 URL", "B": "启动 MySQL 服务", "C": "压缩日志文件", "D": "安装 Python 解释器"},
        "correct": ["A"],
        "analysis": "PPT说明 Spider 负责处理 Response、提取 Item 字段，并提交需要跟进的 URL。",
    },
    {
        "id": "DC-PPT2-013",
        "source": "网络数据采集2 PPT",
        "chapter": "Scrapy",
        "type": "single",
        "stem": "Scrapy Item Pipeline 的主要职责是（ ）。",
        "options": {"A": "处理 Spider 获取到的 Item，如清洗、过滤、存储", "B": "把浏览器升级到最新版", "C": "替代调度器生成请求", "D": "关闭代理服务器"},
        "correct": ["A"],
        "analysis": "PPT说明 Pipeline 负责 Item 的后期处理。",
    },
    {
        "id": "DC-PPT2-014",
        "source": "网络数据采集2 PPT",
        "chapter": "Scrapy",
        "type": "tf",
        "stem": "Scrapy 调度器中不存在任何 request 后，整个程序才会停止。",
        "options": {"A": "对", "B": "错"},
        "correct": ["A"],
        "analysis": "PPT备注中明确说明该停止条件。",
    },
    {
        "id": "DC-PPT2-015",
        "source": "网络数据采集2 PPT",
        "chapter": "Scrapy",
        "type": "fill",
        "stem": "安装 Scrapy 的常用命令是 ____。",
        "options": {},
        "answers": ["pip install Scrapy", "pip install scrapy"],
        "analysis": "PPT给出的安装命令为 pip install Scrapy。",
    },
    {
        "id": "DC-PPT2-016",
        "source": "网络数据采集2 PPT",
        "chapter": "Scrapy项目",
        "type": "fill",
        "stem": "创建 Scrapy 项目的命令是 ____ mySpider。",
        "options": {},
        "answers": ["scrapy startproject"],
        "analysis": "PPT示例命令为 scrapy startproject mySpider。",
    },
    {
        "id": "DC-PPT2-017",
        "source": "网络数据采集2 PPT",
        "chapter": "Scrapy项目",
        "type": "single",
        "stem": "Scrapy 项目中 items.py 通常用于（ ）。",
        "options": {"A": "定义项目目标字段", "B": "保存浏览器驱动", "C": "编译 CSS", "D": "配置系统用户"},
        "correct": ["A"],
        "analysis": "PPT列出 mySpider/items.py 是项目的目标文件。",
    },
    {
        "id": "DC-PPT2-018",
        "source": "网络数据采集2 PPT",
        "chapter": "Scrapy项目",
        "type": "single",
        "stem": "Scrapy 项目中 settings.py 通常是（ ）。",
        "options": {"A": "项目设置文件", "B": "数据库备份文件", "C": "网页截图文件", "D": "二进制图片文件"},
        "correct": ["A"],
        "analysis": "PPT列出 mySpider/settings.py 是项目的设置文件。",
    },
    {
        "id": "DC-PPT2-019",
        "source": "网络数据采集2 PPT",
        "chapter": "Scrapy项目",
        "type": "fill",
        "stem": "Scrapy 项目中存储爬虫代码的目录通常是 ____。",
        "options": {},
        "answers": ["mySpider/spiders", "spiders", "mySpider/spiders/"],
        "analysis": "PPT列出 mySpider/spiders/ 用于存储爬虫代码。",
    },
    {
        "id": "DC-PPT2-020",
        "source": "网络数据采集2 PPT",
        "chapter": "Scrapy",
        "type": "short",
        "stem": "简述 Scrapy 框架的基本工作流程。",
        "options": {},
        "answer": "典型流程是：Spider 产生初始请求交给 Engine；Engine 将 Request 交给 Scheduler 排队；Scheduler 按规则取出请求交给 Downloader 下载；Downloader 返回 Response 给 Engine；Engine 交给 Spider 解析；Spider 提取 Item 或新 Request；Item 进入 Pipeline 清洗、过滤和存储，新 Request 再回到调度器。",
        "analysis": "根据 PPT 对 Engine、Scheduler、Downloader、Spider、Pipeline 的职责整理。",
    },
    {
        "id": "DC-PPT2-021",
        "source": "网络数据采集2 PPT",
        "chapter": "Selenium",
        "type": "single",
        "stem": "Selenium 在课程 PPT 中被描述为（ ）。",
        "options": {"A": "Web 应用自动化测试工具，需要结合浏览器工具使用", "B": "关系型数据库", "C": "HTTP 状态码", "D": "Redis 函数"},
        "correct": ["A"],
        "analysis": "PPT说明 Selenium 是用于 Web 应用的自动化测试工具，需要结合浏览器工具。",
    },
    {
        "id": "DC-PPT2-022",
        "source": "网络数据采集2 PPT",
        "chapter": "Selenium",
        "type": "fill",
        "stem": "安装 selenium 的常用命令是 ____。",
        "options": {},
        "answers": ["pip install selenium", "pip install selenium --default-timeout=1000"],
        "analysis": "PPT给出 pip install selenium --default-timeout=1000。",
    },
    {
        "id": "DC-PPT2-023",
        "source": "网络数据采集2 PPT",
        "chapter": "Selenium",
        "type": "short",
        "stem": "简述 Selenium 测试案例的一般步骤。",
        "options": {},
        "answer": "一般步骤包括：导入自动化测试模块并启动浏览器驱动；访问测试网页；定位页面元素；执行点击、输入等测试操作；最后关闭浏览器并释放资源。",
        "analysis": "来自 PPT 最后一页“测试案例”的步骤。",
    },
]


def update_data_structure(questions: list[dict]) -> list[dict]:
    questions = [q for q in questions if q.get("type") != "short" and not str(q.get("id", "")).startswith("DS-SHORT-")]
    for index, (chapter, title, answer) in enumerate(DATA_STRUCTURE_SHORTS, 1):
        questions.append(
            {
                "id": f"DS-SHORT-{index:03d}",
                "source": "课堂简答题",
                "chapter": chapter,
                "type": "short",
                "title": title,
                "options": [],
                "answer": answer,
                "explanations": [{"label": "参考答案", "text": answer}],
                "tags": ["简答题", chapter],
                "difficulty": "中等",
            }
        )
    return questions


def update_data_collection(questions: list[dict]) -> list[dict]:
    questions = [
        q
        for q in questions
        if q.get("source") != "网络数据采集2 PPT" and not str(q.get("id", "")).startswith("DC-PPT2-")
    ]
    seen = {re.sub(r"\s+", "", q.get("stem", "")) for q in questions}
    for question in DATA_COLLECTION_PPT_QUESTIONS:
        key = re.sub(r"\s+", "", question["stem"])
        if key in seen:
            continue
        question = {**question, "tags": ["PPT"], "note": question.get("note", "")}
        question.setdefault("explanations", {})
        questions.append(question)
        seen.add(key)
    return questions


def main() -> None:
    result = {
        "data_structure_total": replace_array(ROOT / "data_structure_practice.html", "QUESTIONS", update_data_structure),
        "network_data_collection_total": replace_array(
            ROOT / "network_data_collection_practice.html", "QBANK", update_data_collection
        ),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
