import { createFolder, openPath, searchFiles } from "../../actions/files";
import type { PathArgs, SearchFilesArgs } from "../../shared/types";
import type { ToolDefinition } from "../types";
import { requireStringField } from "../validation";

export const searchFilesTool: ToolDefinition<SearchFilesArgs> = {
  name: "search_files",
  description:
    "Search for files and folders by name inside the user's home directory. " +
    "Returns matching full paths (max 20). Use open_path to open a result.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Part of the file or folder name to look for, e.g. 'resume'.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  parseArgs: (raw) => ({
    query: requireStringField(raw, "query", "search_files"),
  }),
  execute: async ({ query }) => {
    const paths = await searchFiles(query);

    if (paths.length === 0) {
      return `No files matching "${query}" were found.`;
    }

    return `Found ${paths.length} matches:\n${paths.join("\n")}`;
  },
};

export const openPathTool: ToolDefinition<PathArgs> = {
  name: "open_path",
  description:
    "Open a file or folder with its default application. The path must be " +
    "inside the user's home directory; relative paths are resolved from it. " +
    "Common folders like Downloads, Documents, or Desktop work directly.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Full or home-relative path, e.g. 'Downloads' or a result from search_files.",
      },
    },
    required: ["path"],
    additionalProperties: false,
  },
  parseArgs: (raw) => ({ path: requireStringField(raw, "path", "open_path") }),
  execute: ({ path }) => openPath(path),
};

export const createFolderTool: ToolDefinition<PathArgs> = {
  name: "create_folder",
  description:
    "Create a new folder inside the user's home directory. Relative paths " +
    "are resolved from the home directory, e.g. 'Documents/Projects/jarvis'.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Home-relative or absolute path of the folder to create.",
      },
    },
    required: ["path"],
    additionalProperties: false,
  },
  parseArgs: (raw) => ({
    path: requireStringField(raw, "path", "create_folder"),
  }),
  execute: ({ path }) => createFolder(path),
};
