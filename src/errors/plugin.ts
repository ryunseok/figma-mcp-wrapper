import { FigmaMcpError } from "./base.js";

export class PluginTimeoutError extends FigmaMcpError {
  constructor(command: string, timeoutMs: number) {
    super(
      `Figma Plugin이 ${command}에 ${timeoutMs / 1000}초 내 응답하지 않음`,
      "PLUGIN_TIMEOUT",
      true,
    );
  }
}

export class PluginDisconnectedError extends FigmaMcpError {
  constructor() {
    super(
      "Figma Plugin이 연결되지 않음. join_channel을 먼저 실행하세요",
      "PLUGIN_DISCONNECTED",
      false,
    );
  }
}
