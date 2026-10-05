import { DEFAULT_SOURCES } from "../services/storage/defaults";
import { SYNC_KEY, writeSourcesNow } from "../services/storage/StorageService";
import { MENU_ID, buildResultsUrl } from "./contextMenu";

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    const stored = await chrome.storage.sync.get(SYNC_KEY.sources);
    const sources = (stored as Record<string, unknown>)[SYNC_KEY.sources];
    if (!Array.isArray(sources) || sources.length === 0) {
      await writeSourcesNow(DEFAULT_SOURCES);
    }

    if (details.reason === "install") {
      await chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
    }
  })();
});

// `removeAll()` must precede every `create()`: MV3 workers restart freely and
// would otherwise throw or duplicate the item on each wake. The callback form
// is used because it is the one shape every @types/chrome version accepts.
function createContextMenu(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Search in MySearch Hub",
      contexts: ["selection"],
    });
  });
}

createContextMenu();

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID) return;
  const relative = buildResultsUrl(info.selectionText ?? "");
  if (relative === null) return;
  void chrome.tabs.create({ url: chrome.runtime.getURL(relative) });
});
