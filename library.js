const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "aiff", "flac", "ogg"]);
const LIBRARY_VERSION = 1;

function parseTags(value) {
  const seen = new Set();
  return String(value)
    .split(/[,\uFF0C\s]+/)
    .map((tag) => tag.trim())
    .filter((tag) => {
      const normalized = tag.toLowerCase();
      if (!tag || seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
}

function fileNameFromPath(value) {
  const normalizedPath = String(value).replace(/\\/g, "/");
  return normalizedPath.slice(normalizedPath.lastIndexOf("/") + 1);
}

function isAudioFileName(fileName) {
  const extension = fileNameFromPath(fileName).split(".").pop().toLowerCase();
  return AUDIO_EXTENSIONS.has(extension);
}

function normalizeLibrary(data) {
  const storedTracks = Array.isArray(data)
    ? data.map((track) => ({ fileName: track.name, tags: track.tags }))
    : data && data.version === LIBRARY_VERSION && Array.isArray(data.tracks)
      ? data.tracks
      : null;

  if (!storedTracks || storedTracks.some((track) => (
    !track
    || typeof track.fileName !== "string"
    || !track.fileName
    || !Array.isArray(track.tags)
    || track.tags.some((tag) => typeof tag !== "string")
  ))) {
    throw new Error("タグ情報の保存データが不正です。");
  }

  const tracksByName = new Map();
  storedTracks.forEach((track) => {
    tracksByName.set(track.fileName.toLowerCase(), {
      fileName: fileNameFromPath(track.fileName),
      tags: parseTags(track.tags.join(" "))
    });
  });

  return { version: LIBRARY_VERSION, tracks: [...tracksByName.values()] };
}

function setFileTags(library, fileName, tags) {
  const key = fileNameFromPath(fileName).toLowerCase();
  const updatedTracks = library.tracks.filter(
    (track) => track.fileName.toLowerCase() !== key
  );
  updatedTracks.push({ fileName: fileNameFromPath(fileName), tags: parseTags(tags.join(" ")) });
  return { version: LIBRARY_VERSION, tracks: updatedTracks };
}

function filterTracks(tracks, query) {
  const requiredTags = parseTags(query).map((tag) => tag.toLowerCase());
  if (requiredTags.length === 0) {
    return tracks;
  }

  return tracks.filter((track) => {
    const trackTags = new Set(track.tags.map((tag) => tag.toLowerCase()));
    return requiredTags.every((tag) => trackTags.has(tag));
  });
}

module.exports = {
  fileNameFromPath,
  filterTracks,
  isAudioFileName,
  normalizeLibrary,
  parseTags,
  setFileTags
};
