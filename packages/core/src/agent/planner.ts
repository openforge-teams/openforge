import type { AgentMode, Message } from '../types.js';

export interface PlanResult {
  goal: string;
  steps: string[];
  risks: string[];
  raw: string;
}

export function buildPlanningPrompt(userGoal: string, mode: AgentMode): Message[] {
  const systemContent =
    mode === 'plan'
      ? 'Create a detailed implementation plan. Do not execute changes. Output sections: Goal, Steps (numbered), Risks.'
      : 'Analyze the task and decide whether planning is needed. If so, outline steps before tool use.';

  return [
    {
      id: 'plan-system',
      role: 'system',
      content: systemContent,
      createdAt: Date.now(),
    },
    {
      id: 'plan-user',
      role: 'user',
      content: userGoal,
      createdAt: Date.now(),
    },
  ];
}

export function parsePlanResponse(content: string): PlanResult {
  const lines = content.split('\n');
  const steps: string[] = [];
  const risks: string[] = [];
  let goal = '';
  let section: 'goal' | 'steps' | 'risks' | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();

    if (lower.startsWith('goal')) {
      section = 'goal';
      goal = trimmed.replace(/^goal:?\s*/i, '');
      continue;
    }
    if (lower.startsWith('steps')) {
      section = 'steps';
      continue;
    }
    if (lower.startsWith('risks')) {
      section = 'risks';
      continue;
    }

    if (section === 'goal' && trimmed) {
      goal += (goal ? ' ' : '') + trimmed;
    } else if (section === 'steps' && trimmed) {
      steps.push(trimmed.replace(/^\d+[\).\s]+/, ''));
    } else if (section === 'risks' && trimmed) {
      risks.push(trimmed.replace(/^[-*]\s*/, ''));
    }
  }

  if (!goal && steps.length === 0) {
    goal = content.slice(0, 200);
    steps.push(...lines.filter((l) => /^\d+[\).\s]/.test(l.trim())).map((l) => l.trim()));
  }

  return { goal, steps, risks, raw: content };
}

export function planToUserMessage(plan: PlanResult): Message {
  const body = [
    plan.goal ? `Goal: ${plan.goal}` : '',
    plan.steps.length ? `Steps:\n${plan.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : '',
    plan.risks.length ? `Risks:\n${plan.risks.map((r) => `- ${r}`).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    id: `plan-${Date.now()}`,
    role: 'assistant',
    content: body || plan.raw,
    createdAt: Date.now(),
  };
}
