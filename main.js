const fs = require("uxp").storage.localFileSystem;
const { filterTracks, parseTags } = require("./library");

const audioPlayer = document.getElementById("audio-player");
const addTracksButton = document.getElementById("add-tracks");
const nowPlaying = document.getElementById("now-playing");
const resultCount = document.getElementById("result-count");
const searchInput = document.getElementById("tag-search");
const statusMessage = document.getElementById("status");
const trackList = document.getElementById("track-list");

let dataFolder;
let tracks = [];

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function saveLibrary() {
  const file = await dataFolder.createFile("library.json", { overwrite: true });
  const savedTracks = tracks.map(({ id, name, path, token, tags }) => ({
    id,
    name,
    path,
    token,
    tags
  }));
  await file.write(JSON.stringify(savedTracks));
}

function createTrackCard(track) {
  const card = document.createElement("li");
  card.className = "track-card";

  const header = document.createElement("div");
  header.className = "track-header";

  const name = document.createElement("span");
  name.className = "track-name";
  name.textContent = track.name;
  name.title = track.name;
  header.append(name);
  let unavailableNote;
  if (track.restoreError) {
    unavailableNote = document.createElement("p");
    unavailableNote.className = "file-warning";
    unavailableNote.textContent = `音源を開けません: ${track.restoreError}`;
  }

  const tagSection = document.createElement("div");
  tagSection.className = "track-tags";

  const tagLabel = document.createElement("label");
  tagLabel.textContent = "タグ（カンマまたはスペース区切り）";

  const tagInput = document.createElement("input");
  tagInput.className = "tag-input";
  tagInput.type = "text";
  tagInput.value = track.tags.join(", ");
  tagInput.setAttribute("aria-label", `${track.name}のタグ`);
  tagLabel.append(tagInput);
  tagSection.append(tagLabel);

  const actions = document.createElement("div");
  actions.className = "track-actions";

  const previewButton = document.createElement("button");
  previewButton.type = "button";
  previewButton.textContent = "プレビュー";
  previewButton.disabled = !track.entry;
  previewButton.addEventListener("click", async () => {
    if (!track.entry) {
      showStatus("この音源にアクセスできません。音源を再登録してください。", true);
      return;
    }

    audioPlayer.src = track.entry.url;
    nowPlaying.textContent = `再生中: ${track.name}`;
    try {
      await audioPlayer.play();
      showStatus("");
    } catch (error) {
      showStatus(`音源を再生できませんでした: ${getErrorMessage(error)}`, true);
    }
  });

  const saveTagsButton = document.createElement("button");
  saveTagsButton.type = "button";
  saveTagsButton.textContent = "タグを保存";
  saveTagsButton.addEventListener("click", async () => {
    const previousTags = track.tags;
    track.tags = parseTags(tagInput.value);
    try {
      await saveLibrary();
      renderTracks();
      showStatus("タグを保存しました。");
    } catch (error) {
      track.tags = previousTags;
      showStatus(`タグを保存できませんでした: ${getErrorMessage(error)}`, true);
    }
  });

  const removeButton = document.createElement("button");
  removeButton.className = "remove-button";
  removeButton.type = "button";
  removeButton.textContent = "削除";
  removeButton.addEventListener("click", async () => {
    const previousTracks = tracks;
    tracks = tracks.filter((item) => item.id !== track.id);
    try {
      await saveLibrary();
      if (audioPlayer.src === track.entry?.url) {
        audioPlayer.pause();
        audioPlayer.removeAttribute("src");
        audioPlayer.load();
        nowPlaying.textContent = "プレビューする音源を選択してください";
      }
      renderTracks();
      showStatus("音源をライブラリから削除しました。");
    } catch (error) {
      tracks = previousTracks;
      showStatus(`音源を削除できませんでした: ${getErrorMessage(error)}`, true);
    }
  });

  actions.append(previewButton, saveTagsButton, removeButton);
  card.append(header);
  if (unavailableNote) {
    card.append(unavailableNote);
  }
  card.append(tagSection, actions);
  return card;
}

function renderTracks() {
  const visibleTracks = filterTracks(tracks, searchInput.value);
  trackList.replaceChildren();
  resultCount.textContent = `${visibleTracks.length}曲`;

  if (visibleTracks.length === 0) {
    const emptyState = document.createElement("li");
    emptyState.className = "empty-state";
    emptyState.textContent = tracks.length === 0
      ? "「音源を追加」からBGMを登録してください。"
      : "条件に一致する音源はありません。";
    trackList.append(emptyState);
    return;
  }

  visibleTracks.forEach((track) => trackList.append(createTrackCard(track)));
}

async function addTracks() {
  try {
    const files = await fs.getFileForOpening({
      allowMultiple: true,
      types: ["mp3", "wav", "m4a", "aac", "aiff", "flac", "ogg"]
    });
    if (!files || files.length === 0) {
      return;
    }

    const updatedTracks = [...tracks];
    for (const file of files) {
      const token = await fs.createPersistentToken(file);
      const existingIndex = updatedTracks.findIndex((track) => track.path === file.nativePath);
      if (existingIndex >= 0) {
        updatedTracks[existingIndex] = {
          ...updatedTracks[existingIndex],
          name: file.name,
          path: file.nativePath,
          token,
          entry: file,
          restoreError: null
        };
      } else {
        updatedTracks.push({
          id: `${Date.now()}-${updatedTracks.length}`,
          name: file.name,
          path: file.nativePath,
          token,
          tags: [],
          entry: file
        });
      }
    }

    const previousTracks = tracks;
    tracks = updatedTracks;
    try {
      await saveLibrary();
    } catch (error) {
      tracks = previousTracks;
      throw error;
    }
    renderTracks();
    showStatus(`${files.length}件の音源を登録しました。`);
  } catch (error) {
    showStatus(`音源を追加できませんでした: ${getErrorMessage(error)}`, true);
  }
}

async function loadLibrary() {
  dataFolder = await fs.getDataFolder();
  const entries = await dataFolder.getEntries();
  const libraryFile = entries.find((entry) => entry.isFile && entry.name === "library.json");
  if (!libraryFile) {
    renderTracks();
    showStatus("音源を追加して、曲ごとにタグを設定してください。");
    return;
  }

  const storedTracks = JSON.parse(await libraryFile.read());
  if (!Array.isArray(storedTracks) || storedTracks.some((track) => (
    typeof track.id !== "string"
    || typeof track.name !== "string"
    || typeof track.path !== "string"
    || typeof track.token !== "string"
    || !Array.isArray(track.tags)
    || track.tags.some((tag) => typeof tag !== "string")
  ))) {
    throw new Error("ライブラリの保存データが不正です。");
  }

  const restoreErrors = [];
  tracks = await Promise.all(storedTracks.map(async (track) => {
    try {
      const entry = await fs.getEntryForPersistentToken(track.token);
      return { ...track, entry };
    } catch (error) {
      const restoreError = getErrorMessage(error);
      restoreErrors.push(restoreError);
      return { ...track, entry: null, restoreError };
    }
  }));
  renderTracks();

  if (restoreErrors.length > 0) {
    showStatus(
      `${restoreErrors.length}件の音源にアクセスできません。再登録するか、削除してください。(${restoreErrors[0]})`,
      true
    );
  } else {
    showStatus("ライブラリを読み込みました。");
  }
}

addTracksButton.addEventListener("click", addTracks);
searchInput.addEventListener("input", renderTracks);
audioPlayer.addEventListener("error", () => {
  showStatus("音源を再生できません。ファイルの場所と形式を確認してください。", true);
});

loadLibrary().catch((error) => {
  showStatus(`ライブラリを読み込めませんでした: ${getErrorMessage(error)}`, true);
});
