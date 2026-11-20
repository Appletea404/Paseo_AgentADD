import type { PaseoApi } from "@getpaseo/client";
import type { RpcInput } from "@getpaseo/plugin";
import { execCommand } from "@getpaseo/plugin/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { attachAgent } from "../shared/attach";

const parentAgentLabel = "paseo.parent-agent-id";
const parentServerLabel = "paseo.parent-server-id";

export async function attachExistingAgent(
  { parentId, childId }: RpcInput<typeof attachAgent>,
  paseo: PaseoApi,
) {
  if (parentId === childId) {
    throw new Error("현재 에이전트를 자기 자신의 Subagent로 연결할 수 없습니다.");
  }
  const parentHandle = paseo.agents.ref(parentId);
  const target = paseo.agents.ref(childId);
  const [parentResult, childResult] = await Promise.all([parentHandle.refresh(), target.refresh()]);
  const parent = parentResult?.agent;
  const child = childResult?.agent;
  if (!parent || parent.archivedAt) {
    throw new Error("부모로 사용할 에이전트를 찾을 수 없습니다.");
  }
  if (!child || child.archivedAt || child.background) {
    throw new Error("연결할 에이전트를 찾을 수 없습니다.");
  }

  const serverId = parentHandle.address.serverId;
  const currentParent = child.labels[parentAgentLabel];
  const currentParentHost = child.labels[parentServerLabel] || serverId;
  const title = child.title ?? child.provider;
  if (currentParent === parentId && currentParentHost === serverId) return { title };
  if (currentParent) {
    throw new Error("이미 다른 에이전트에 연결되어 있습니다.");
  }

  const seen = new Set([parentId]);
  let ancestor = parent;
  while (ancestor.labels[parentAgentLabel]) {
    const ancestorId = ancestor.labels[parentAgentLabel];
    if (ancestorId === childId || seen.has(ancestorId)) {
      throw new Error("상위 에이전트를 다시 연결할 수 없습니다.");
    }
    const ancestorHost = ancestor.labels[parentServerLabel];
    if (ancestorHost && ancestorHost !== serverId) {
      throw new Error("다른 호스트에 연결된 상위 에이전트 관계를 확인할 수 없습니다.");
    }
    seen.add(ancestorId);
    const result = await paseo.agents.ref(ancestorId).refresh();
    if (!result) break;
    ancestor = result.agent;
  }

  const bundledCli = process.platform === "win32" && process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, "Programs", "Paseo", "resources", "bin", "paseo.cmd")
    : undefined;
  const pathCli = process.platform === "win32" ? "paseo.cmd" : "paseo";
  const cli = process.env.PASEO_CLI || (bundledCli && existsSync(bundledCli) ? bundledCli : pathCli);
  const home = process.env.PASEO_HOME;
  await execCommand(cli, [
    "agent", "update", "--json",
    ...(home ? ["--home", home] : []),
    "--label", `${parentAgentLabel}=${parentId}`,
    "--label", `${parentServerLabel}=${serverId}`,
    "--", childId,
  ], { timeout: 15_000, env: { ...process.env, PASEO_HOST: undefined, PASEO_AGENT_ID: undefined } });

  const updated = (await target.refresh())?.agent;
  if (updated?.labels[parentAgentLabel] !== parentId || updated.labels[parentServerLabel] !== serverId) {
    throw new Error("에이전트의 부모 연결을 다시 확인할 수 없습니다.");
  }
  return { title };
}
