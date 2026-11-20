import type { PluginServerContext } from "@getpaseo/plugin/server";
import { attachAgent } from "./shared/attach";
import { attachExistingAgent } from "./server/attach-existing";

export default function contribute(server: PluginServerContext) {
  let attaching = false;
  server.handle(attachAgent, async (input, { paseo }) => {
    if (attaching) {
      throw new Error("다른 에이전트를 연결하는 중입니다. 완료된 후 다시 선택해 주세요.");
    }
    attaching = true;
    try {
      return await attachExistingAgent(input, paseo);
    } finally {
      attaching = false;
    }
  });
  return () => { attaching = false; };
}
