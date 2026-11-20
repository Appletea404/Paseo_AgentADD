import type { PluginButtonRegistration, PluginClientContext } from "@getpaseo/plugin/client";
import { AttachAgentPicker } from "./client/agent-picker";

export default function contribute(client: PluginClientContext) {
  const lifetime = new AbortController();
  const pills = new Map<string, { workspaceId: string; button: PluginButtonRegistration }>();

  function remove(agentId: string) {
    pills.get(agentId)?.button.remove();
    pills.delete(agentId);
  }

  function register(agent: { id: string; workspaceId?: string | null; archivedAt?: string | null }) {
    if (lifetime.signal.aborted) return;
    if (!agent.workspaceId || agent.archivedAt) {
      remove(agent.id);
      return;
    }
    if (pills.get(agent.id)?.workspaceId === agent.workspaceId) return;
    remove(agent.id);
    const button = client.addComposerPill({
      id: "attach-agent",
      workspaceId: agent.workspaceId,
      agentId: agent.id,
      button: {
        title: "기존 에이전트를 Subagents에 연결",
        label: "에이전트 연결",
        icon: "Link2",
        behavior: { kind: "popover", Content: AttachAgentPicker },
      },
    });
    pills.set(agent.id, { workspaceId: agent.workspaceId, button });
  }

  const clear = () => {
    for (const agentId of pills.keys()) remove(agentId);
  };

  void client.paseo.agents.list({
    page: { limit: 200 },
    subscribe: {},
    signal: lifetime.signal,
  }).then(({ subscription }) => {
    subscription?.subscribe({
      snapshot: ({ entries }) => {
        clear();
        for (const { agent } of entries) register(agent);
      },
      update: (message) => {
        if (message.type !== "agent_update") return;
        const update = message.payload;
        if (update.kind === "upsert") register(update.agent);
        else remove(update.agentId);
      },
    });
  }).catch((error) => {
    if (!lifetime.signal.aborted) console.error("에이전트 연결 버튼을 추가할 수 없습니다.", error);
  });

  return () => {
    lifetime.abort();
    clear();
  };
}
