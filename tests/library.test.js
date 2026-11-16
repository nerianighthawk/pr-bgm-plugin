const test = require("node:test");
const assert = require("node:assert/strict");
const { filterTracks, parseTags } = require("../library");

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
