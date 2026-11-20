import {
  type AgentRef,
  type PluginButtonContentProps,
  useAgent,
  useAgents,
  useRpc,
} from "@getpaseo/plugin/client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { attachAgent } from "../shared/attach";

type AgentPickerProps = Extract<PluginButtonContentProps, { context: "agent" }>;

export function AttachAgentPicker(props: PluginButtonContentProps) {
  if (props.context !== "agent") return null;
  return <AgentPicker key={props.agentId} {...props} />;
}

function AgentPicker({ agentId, workspaceId, host, theme, close }: AgentPickerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const attach = useRpc(attachAgent);
  const mutation = useMutation({ mutationFn: attach });
  const candidates = useAgents({
    hosts: [host.id],
    where: (agent) =>
      agent.workspaceId === workspaceId &&
      agent.id !== agentId &&
      !agent.parentAgentId &&
      !agent.background,
    orderBy: ["lastActivityAt", "desc"],
  });
  const selected = candidates.find((candidate) => candidate.id === selectedId);
  const colors = theme.colors;
  const canAttach = selected !== undefined && !mutation.isPending;

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600" }}>에이전트 연결</Text>
      {mutation.isSuccess ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.foreground }}>
          {mutation.data.title}을(를) 연결했습니다. 이 탭의 Subagents에서 열 수 있습니다.
        </Text>
      ) : (
        <>
          {candidates.length === 0 ? (
            <Text style={{ color: colors.foregroundMuted }}>
              이 워크스페이스에 연결할 독립 에이전트가 없습니다.
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 270 }} contentContainerStyle={{ gap: 6 }}>
              {candidates.map((reference) => (
                <CandidateRow
                  key={reference.key}
                  reference={reference}
                  colors={colors}
                  selected={reference.id === selectedId}
                  disabled={mutation.isPending}
                  onSelect={() => {
                    if (mutation.isError) mutation.reset();
                    setSelectedId(reference.id);
                  }}
                />
              ))}
            </ScrollView>
          )}
          {mutation.isError && (
            <Text accessibilityRole="alert" style={{ color: colors.statusDanger }}>
              {mutation.error.message}
            </Text>
          )}
        </>
      )}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          disabled={mutation.isPending}
          onPress={close}
          style={{ padding: 10, opacity: mutation.isPending ? 0.5 : 1 }}
        >
          <Text style={{ color: colors.foreground }}>{mutation.isSuccess ? "닫기" : "취소"}</Text>
        </Pressable>
        {!mutation.isSuccess && (
          <Pressable
            accessibilityRole="button"
            disabled={!canAttach}
            onPress={() => selected && mutation.mutate({ parentId: agentId, childId: selected.id })}
            style={{ padding: 10, borderRadius: 6, backgroundColor: colors.accent, opacity: canAttach ? 1 : 0.5 }}
          >
            <Text style={{ color: colors.accentForeground }}>
              {mutation.isPending ? "연결 중…" : "연결"}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function CandidateRow({ reference, colors, selected, disabled, onSelect }: {
  reference: AgentRef;
  colors: AgentPickerProps["theme"]["colors"];
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const agent = useAgent(reference, ({ title, provider, model, cwd }) => ({ title, provider, model, cwd }));
  if (!agent) return null;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onSelect}
      style={{
        padding: 10,
        gap: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: colors.surface1,
      }}
    >
      <Text numberOfLines={1} style={{ color: colors.foreground, fontWeight: "600" }}>
        {agent.title ?? agent.provider}
      </Text>
      <Text numberOfLines={1} style={{ color: colors.foregroundMuted }}>
        {agent.provider}{agent.model ? ` · ${agent.model}` : ""}
      </Text>
      <Text numberOfLines={1} style={{ color: colors.foregroundMuted }}>
        {agent.cwd}
      </Text>
    </Pressable>
  );
}
