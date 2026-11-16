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

module.exports = { filterTracks, parseTags };
