import {
  appendFile,
  copyFile,
  createFolder,
  deletePath,
  listFolder,
  moveFile,
  openPath,
  readFile,
  searchFiles,
  writeFile,
} from "../../actions/files";
import type {
  PathArgs,
  SearchFilesArgs,
  TransferArgs,
  WriteFileArgs,
} from "../../shared/types";
import type { ToolDefinition, ToolParameterSchema } from "../types";
import { requireStringField } from "../validation";

function parseTransferArgs(raw: unknown, tool: string): TransferArgs {
  return {
    from: requireStringField(raw, "from", tool),
    to: requireStringField(raw, "to", tool),
  };
}

function transferParameters(verb: string): ToolParameterSchema {
  return {
    type: "object",
    properties: {
      from: {
        type: "string",
        description: `Full or home-relative path of the file to ${verb}.`,
      },
      to: {
        type: "string",
        description:
          "Destination folder or full destination path (inside the home directory).",
      },
    },
    required: ["from", "to"],
    additionalProperties: false,
  };
}

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

export const moveFileTool: ToolDefinition<TransferArgs> = {
  name: "move_file",
  description:
    "Move a file or folder to a new location inside the home directory. " +
    "Never overwrites; the user is asked to confirm first.",
  parameters: transferParameters("move"),
  parseArgs: (raw) => parseTransferArgs(raw, "move_file"),
  execute: ({ from, to }) => moveFile(from, to),
  confirmQuestion: ({ from, to }) => `Move ${from} to ${to} — yes or no?`,
};

export const copyFileTool: ToolDefinition<TransferArgs> = {
  name: "copy_file",
  description:
    "Copy a file to a new location inside the home directory. Never overwrites.",
  parameters: transferParameters("copy"),
  parseArgs: (raw) => parseTransferArgs(raw, "copy_file"),
  execute: ({ from, to }) => copyFile(from, to),
};

export const deletePathTool: ToolDefinition<PathArgs> = {
  name: "delete_path",
  description:
    "Delete a file or folder by moving it to the recycle bin (recoverable). " +
    "The user is asked to confirm first.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Full or home-relative path of the file or folder to delete.",
      },
    },
    required: ["path"],
    additionalProperties: false,
  },
  parseArgs: (raw) => ({
    path: requireStringField(raw, "path", "delete_path"),
  }),
  execute: ({ path }) => deletePath(path),
  confirmQuestion: ({ path }) =>
    `Move ${path} to the recycle bin — yes or no?`,
};

export const readFileTool: ToolDefinition<PathArgs> = {
  name: "read_file",
  description:
    "Read the text content of a file inside the home directory (truncated " +
    "for large files). Use to answer questions about a file's contents.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Full or home-relative path of the text file to read.",
      },
    },
    required: ["path"],
    additionalProperties: false,
  },
  parseArgs: (raw) => ({ path: requireStringField(raw, "path", "read_file") }),
  execute: ({ path }) => readFile(path),
};

export const writeFileTool: ToolDefinition<WriteFileArgs> = {
  name: "write_file",
  description:
    "Create a new text file inside the home directory with the given " +
    "content, e.g. saving a note or a list the user dictated. Never " +
    "overwrites an existing file.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Home-relative or absolute path of the new file, e.g. 'Documents/note.txt'.",
      },
      content: {
        type: "string",
        description: "The text content to write into the file.",
      },
    },
    required: ["path", "content"],
    additionalProperties: false,
  },
  parseArgs: (raw) => ({
    path: requireStringField(raw, "path", "write_file"),
    content: requireStringField(raw, "content", "write_file"),
  }),
  execute: ({ path, content }) => writeFile(path, content),
};

export const appendFileTool: ToolDefinition<WriteFileArgs> = {
  name: "append_file",
  description:
    "Append a line of text to a file, creating the file if it does not " +
    "exist. Use for adding to the user's notes without touching existing " +
    "content.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Home-relative or absolute path of the file, e.g. 'Documents/jarvis-notes.txt'.",
      },
      content: {
        type: "string",
        description: "The text to append as a new line.",
      },
    },
    required: ["path", "content"],
    additionalProperties: false,
  },
  parseArgs: (raw) => ({
    path: requireStringField(raw, "path", "append_file"),
    content: requireStringField(raw, "content", "append_file"),
  }),
  execute: ({ path, content }) => appendFile(path, content),
};

export const listFolderTool: ToolDefinition<PathArgs> = {
  name: "list_folder",
  description:
    "List the files and subfolders inside a folder in the home directory. " +
    "Folder names end with '/'. Use to answer questions like 'what is in " +
    "my Downloads folder'.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Full or home-relative path of the folder, e.g. 'Downloads'.",
      },
    },
    required: ["path"],
    additionalProperties: false,
  },
  parseArgs: (raw) => ({
    path: requireStringField(raw, "path", "list_folder"),
  }),
  execute: async ({ path }) => {
    const entries = await listFolder(path);

    if (entries.length === 0) {
      return `The folder "${path}" is empty.`;
    }

    return `Contents of ${path} (${entries.length} entries):\n${entries.join("\n")}`;
  },
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
