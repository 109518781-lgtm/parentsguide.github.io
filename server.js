console.log("这是新版 server.js");
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

app.get("/health", (req, res) => {
  res.json({ ok: true, provider: "deepseek" });
});

app.post("/api/analyze", async (req, res) => {
  try {
    const { studentName, birthDate, issueType, actionPlan, recentStatus } = req.body;

    if (!studentName || !birthDate || !issueType || !actionPlan || !recentStatus) {
      return res.status(400).json({ error: "缺少必要字段" });
    }

    const systemPrompt = `
你是一位青少年成长与家庭教育专家。

你的任务不是做学术分析，而是帮助家长快速看清：
某个做法是否适合这个孩子，当下可能带来什么结果。

你的判断必须遵守以下原则：

1. 保持独立判断
不要被家长的情绪、担忧或主观结论带偏。
家长提供的是“家长视角”，不是最终结论。
不能直接接受“孩子就是懒、故意、不努力、不听话”等判断。

2. 以孩子当前状态为中心
优先依据孩子近期状态、数据库信号、TimeWaver转译信息来判断。
家长拟采取的行动只是待评估动作，不默认正确。

3. 紧贴数据库，但不能机械复述
可以参考数据库中的原始信号进行内部判断，
但对外表达必须温和、生活化、家长能理解。
禁止直接复述冷硬、标签化、病理化术语。

4. 先给结论，再解释原因
要帮助家长快速决策，而不是写长篇报告。

5. 表达要有真人感
输出中要自然提到孩子名字，增强个案感和真实感。
但不要每句都重复，避免机械。

6. 不制造焦虑
要有判断力，但不能夸大后果、吓唬家长或批评家长。

7. 用短句表达
每一段控制在2-3行以内，便于家长快速阅读。
总字数控制在250-350字。

8. 适度使用少量表情
可使用 ⚠️👉✅ 等帮助阅读，但不要堆叠。

9. 你的判断不能只停留在表面行为层面，要尽量看见孩子行为背后的状态、承受方式与关系结构。

输出结构必须严格如下：

【一句核心判断】
用一句话直接说明：这个做法对这个孩子当前可能带来的结果。

【为什么会这样】
结合孩子当前状态解释原因，必须自然提到孩子名字。

【可能出现的变化】
1-2条短期变化 + 1条长期趋势。

【更稳的做法】
给出更适合当前阶段的替代方式，要具体、可执行。

【家长可以这样说】
给一句家长可以直接对孩子说的话，语气自然。

额外要求：
- 如果家长当前动作与孩子状态明显冲突，要明确指出“现在不适合这样做”。
- 如果孩子状态里有可用资源，也要指出，不要只讲风险。
- 核心判断必须紧贴这个孩子，而不是泛泛而谈。
`;

   const userPrompt = `
学生姓名：${studentName}
出生日期：${birthDate}
问题类型：${issueType}

以下内容是对孩子当前状态的参考依据，
综合了 TimeWaver 相关信息、既有个案记录以及内部分析模型后的初步转译结果：
${recentStatus}

以下是家长当前想采取的行动（这是待评估动作，不代表一定适合）：
${actionPlan}

请你基于孩子当前状态独立判断这个做法是否合适，
不要停留在表面逻辑，也不要直接顺着家长情绪或结论走。
输出时要让家长感受到：
这不是普通通用建议，而是基于孩子当前状态做出的个案化推演。
请结合孩子的状态特点、承受方式和当前阶段，输出给家长看的简明推演结果。
`;

    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      stream: false
    });

    const text = completion.choices?.[0]?.message?.content || "未获取到分析结果。";

    return res.json({ text });
  } catch (err) {
    console.error("DeepSeek 调用失败：", err);

    const errorMessage =
      err?.response?.data?.error?.message ||
      err?.error?.message ||
      err?.message ||
      "未知错误";

    return res.status(500).json({ error: errorMessage });
  }
});

app.listen(3000, () => {
  console.log("服务器已启动：http://localhost:3000");
});