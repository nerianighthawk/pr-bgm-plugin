const fs = require("uxp").storage.localFileSystem;
const premiere = require("premierepro");
const {
  fileNameFromPath,
  filterTracks,
  isAudioFileName,
  normalizeLibrary,
  parseTags,
  setFileTags
} = require("./library");

const audioPlayer = document.getElementById("audio-player");
const refreshProjectButton = document.getElementById("refresh-project");
const nowPlaying = document.getElementById("now-playing");
const resultCount = document.getElementById("result-count");
const searchInput = document.getElementById("tag-search");
const statusMessage = document.getElementById("status");
const trackList = document.getElementById("track-list");

let dataFolder;
let library = { version: 1, tracks: [] };
let projectTracks = [];

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function saveLibrary() {
  const file = await dataFolder.createFile("library.json", { overwrite: true });
  await file.write(JSON.stringify(library));
}

function toFileUrl(path) {
  const normalizedPath = path.replace(/\\/g, "/");
  const encodedPath = normalizedPath.split("/").map((segment) => (
    /^[a-zA-Z]:$/.test(segment) ? segment : encodeURIComponent(segment)
  )).join("/");
  return `file:${encodedPath.startsWith("/") ? encodedPath : `/${encodedPath}`}`;
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

  if (track.restoreError) {
    const unavailableNote = document.createElement("p");
    unavailableNote.className = "file-warning";
    unavailableNote.textContent = `素材のパスを取得できません: ${track.restoreError}`;
    card.append(unavailableNote);
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
  previewButton.disabled = !track.path;
  previewButton.addEventListener("click", async () => {
    if (!track.path) {
      showStatus("この素材のパスにアクセスできません。", true);
      return;
    }

    try {
      const entry = await fs.getEntryWithUrl(toFileUrl(track.path));
      audioPlayer.src = entry.url;
      nowPlaying.textContent = `再生中: ${track.name}`;
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
    const previousLibrary = library;
    library = setFileTags(library, track.fileName, parseTags(tagInput.value));
    try {
      await saveLibrary();
      renderTracks();
      showStatus("タグを保存しました。");
    } catch (error) {
      library = previousLibrary;
      showStatus(`タグを保存できませんでした: ${getErrorMessage(error)}`, true);
    }
  });

  actions.append(previewButton, saveTagsButton);
  card.append(header, tagSection, actions);
  return card;
}

function renderTracks() {
  const visibleTracks = filterTracks(projectTracks, searchInput.value);
  trackList.replaceChildren();
  resultCount.textContent = `${visibleTracks.length}曲`;

  if (visibleTracks.length === 0) {
    const emptyState = document.createElement("li");
    emptyState.className = "empty-state";
    emptyState.textContent = projectTracks.length === 0
      ? "開いているプロジェクトに音源がありません。"
      : "条件に一致する音源はありません。";
    trackList.append(emptyState);
    return;
  }

  visibleTracks.forEach((track) => trackList.append(createTrackCard(track)));
}

async function collectProjectAudioItems(folder, collectedTracks) {
  await collectProjectItems(await folder.getItems(), collectedTracks);
}

async function collectProjectItems(items, collectedTracks) {
  for (const item of items) {
    const itemType = item.type;
    const projectItemTypes = premiere.Constants.ProjectItemType;
    let childItems;
    let folderCastError;

    if (
      projectItemTypes
      && (itemType === projectItemTypes.ROOT || itemType === projectItemTypes.BIN)
    ) {
      childItems = await premiere.FolderItem.cast(item).getItems();
    } else if (!itemType) {
      try {
        childItems = await premiere.FolderItem.cast(item).getItems();
      } catch (error) {
        folderCastError = error;
      }
    }

    if (childItems !== undefined) {
      await collectProjectItems(childItems, collectedTracks);
      continue;
    }

    let contentType;
    try {
      contentType = await premiere.ClipProjectItem.cast(item).getContentType();
    } catch (error) {
      if (folderCastError) {
        throw new Error(
          `プロジェクト項目をフォルダーまたは素材として判定できませんでした: ${
            getErrorMessage(folderCastError)
          }; ${getErrorMessage(error)}`
        );
      }
      throw error;
    }

    if (contentType === premiere.Constants.ContentType.MEDIA) {
      let path = "";
      let restoreError = null;
      try {
        path = await premiere.ClipProjectItem.cast(item).getMediaFilePath();
        if (!path) {
          restoreError = "Premiere Proからファイルパスが返されませんでした。";
        }
      } catch (error) {
        restoreError = getErrorMessage(error);
      }

      const fileName = fileNameFromPath(path || item.name);
      if (!isAudioFileName(fileName)) {
        continue;
      }

      collectedTracks.push({
        id: item.getId(),
        name: item.name || fileName,
        fileName,
        path,
        tags: library.tracks.find(
          (entry) => entry.fileName.toLowerCase() === fileName.toLowerCase()
        )?.tags ?? [],
        restoreError
      });
    }
  }
}

async function refreshProject() {
  refreshProjectButton.disabled = true;
  showStatus("現在のプロジェクトから音源を検索しています。");
  try {
    const project = await premiere.Project.getActiveProject();
    if (!project) {
      throw new Error("開いているプロジェクトがありません。");
    }

    const root = await project.getRootItem();
    const updatedTracks = [];
    await collectProjectAudioItems(root, updatedTracks);
    projectTracks = updatedTracks;
    renderTracks();

    const unavailableCount = projectTracks.filter((track) => track.restoreError).length;
    const suffix = unavailableCount > 0
      ? `（${unavailableCount}件の素材パスを取得できませんでした）`
      : "";
    showStatus(`プロジェクト内の音源を${projectTracks.length}件読み込みました。${suffix}`, unavailableCount > 0);
  } catch (error) {
    projectTracks = [];
    renderTracks();
    showStatus(`プロジェクト内の音源を検索できませんでした: ${getErrorMessage(error)}`, true);
  } finally {
    refreshProjectButton.disabled = false;
  }
}

async function loadLibrary() {
  dataFolder = await fs.getDataFolder();
  const entries = await dataFolder.getEntries();
  const libraryFile = entries.find((entry) => entry.isFile && entry.name === "library.json");
  if (libraryFile) {
    const storedLibrary = JSON.parse(await libraryFile.read());
    library = normalizeLibrary(storedLibrary);
    if (Array.isArray(storedLibrary)) {
      await saveLibrary();
    }
  }

  await refreshProject();
}

refreshProjectButton.addEventListener("click", refreshProject);
searchInput.addEventListener("input", renderTracks);
audioPlayer.addEventListener("error", () => {
  showStatus("音源を再生できません。ファイルの場所と形式を確認してください。", true);
});

loadLibrary().catch((error) => {
  showStatus(`タグ情報を読み込めませんでした: ${getErrorMessage(error)}`, true);
});
