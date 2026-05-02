export type ToolCall =
  | {
      tool: "open_app";
      args: {
        app: string;
      };
    }
  | {
      tool: "open_url";
      args: {
        url: string;
      };
    };
