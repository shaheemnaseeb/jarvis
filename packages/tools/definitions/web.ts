import { getNews, getWeather, playSong, spotifyConnect } from "../../actions/web";
import type { PlaySongArgs, WeatherArgs } from "../../shared/types";
import type { ToolDefinition } from "../types";
import { requireStringField } from "../validation";

export const playSongTool: ToolDefinition<PlaySongArgs> = {
  name: "play_song",
  description:
    "Play a specific song or artist. Plays in the Spotify app when it is " +
    "installed and connected; otherwise finds the song on YouTube and " +
    "opens it in the browser.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Song and artist to play, e.g. 'Highway to Hell AC/DC'.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  parseArgs: (raw) => ({
    query: requireStringField(raw, "query", "play_song"),
  }),
  execute: ({ query }) => playSong(query),
};

export const getWeatherTool: ToolDefinition<WeatherArgs> = {
  name: "get_weather",
  description:
    "Get the current weather: condition, temperature, wind, and humidity.",
  parameters: {
    type: "object",
    properties: {
      city: {
        type: "string",
        description:
          "City name, e.g. 'London', or 'here' for the user's current location.",
      },
    },
    required: ["city"],
    additionalProperties: false,
  },
  parseArgs: (raw) => ({
    city: requireStringField(raw, "city", "get_weather"),
  }),
  execute: ({ city }) => getWeather(city),
};

export const getNewsTool: ToolDefinition<Record<string, never>> = {
  name: "get_news",
  description: "Get the latest top news headlines.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
  parseArgs: () => ({}),
  execute: () => getNews(),
};

export const spotifyConnectTool: ToolDefinition<Record<string, never>> = {
  name: "spotify_connect",
  description:
    "Connect the user's Spotify account so songs play in the Spotify app. " +
    "Opens a browser window where the user approves access; only needed " +
    "once. Use when the user asks to connect, link, or log in to Spotify.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
  parseArgs: () => ({}),
  execute: () => spotifyConnect(),
};
