import { FigmaMcpError } from "./base.js";

export class AuthError extends FigmaMcpError {
  constructor(message = "FIGMA_ACCESS_TOKEN이 설정되지 않았거나 만료됨") {
    super(message, "AUTH_ERROR", false);
  }
}
