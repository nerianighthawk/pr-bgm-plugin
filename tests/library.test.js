const test = require("node:test");
const assert = require("node:assert/strict");
const {
  fileNameFromPath,
  filterTracks,
  isAudioFileName,
  normalizeLibrary,
  parseTags,
  setFileTags
} = require("../library");

const tracks = [
  { name: "morning.mp3", tags: ["明るい", "日常", "一軍"] },
  { name: "quiet.wav", tags: ["日常", "落ち着く"] },
  { name: "bright.wav", tags: ["明るい", "一軍"] }
];

test("parses tags separated by spaces and Japanese or ASCII commas", () => {
  assert.deepEqual(parseTags("明るい 日常, 一軍，明るい"), ["明るい", "日常", "一軍"]);
});

test("matches every requested tag and excludes partial matches", () => {
  assert.deepEqual(
    filterTracks(tracks, "明るい 日常 一軍").map((track) => track.name),
    ["morning.mp3"]
  );
  assert.deepEqual(
    filterTracks(tracks, "明るい 落ち着く"),
    []
  );
});

test("shows all tracks when the search contains no tags", () => {
  assert.equal(filterTracks(tracks, "  ").length, tracks.length);
});

test("normalizes legacy library entries to filename-based tag records", () => {
  assert.deepEqual(
    normalizeLibrary([
      {
        id: "legacy-id",
        name: "morning.mp3",
        path: "/old/location/morning.mp3",
        token: "legacy-token",
        tags: ["明るい", "日常"]
      }
    ]),
    {
      version: 1,
      tracks: [{ fileName: "morning.mp3", tags: ["明るい", "日常"] }]
    }
  );
});

test("updates tags by filename while retaining records from other projects", () => {
  const firstProject = normalizeLibrary({
    version: 1,
    tracks: [
      { fileName: "morning.mp3", tags: ["明るい"] },
      { fileName: "quiet.wav", tags: ["落ち着く"] }
    ]
  });

  assert.deepEqual(
    setFileTags(firstProject, "MORNING.MP3", ["日常"]),
    {
      version: 1,
      tracks: [
        { fileName: "quiet.wav", tags: ["落ち着く"] },
        { fileName: "MORNING.MP3", tags: ["日常"] }
      ]
    }
  );
});

test("extracts project filenames and identifies supported audio formats", () => {
  assert.equal(fileNameFromPath("C:\\Music\\morning.mp3"), "morning.mp3");
  assert.equal(isAudioFileName("morning.mp3"), true);
  assert.equal(isAudioFileName("footage.mp4"), false);
});

test("rejects malformed tag-library data", () => {
  assert.throws(() => normalizeLibrary({ version: 1, tracks: [{ fileName: "broken.mp3", tags: "tag" }] }));
});
