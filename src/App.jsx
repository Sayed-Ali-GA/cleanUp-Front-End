import { lazy, Suspense, useEffect, useState } from "react";
import { FaPlus, FaList, FaTrashAlt } from "react-icons/fa";
import SearchBar from "./components/SearchBar";
import LocationSheet from "./components/LocationSheet";
import { DetailCard, ListPanel } from "./components/Panels";
import {
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} from "./services/locationService";
import { inBahrain } from "./utils/maps";
import "./App.css";

const MapView = lazy(() => import("./components/MapView"));

const CACHE = "cleanup:locations";
const EMPTY = { title: "", description: "" };

const readCache = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE)) || [];
  } catch {
    return [];
  }
};

export default function App() {
  const [locations, setLocations] = useState(readCache);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [toast, setToast] = useState("");

  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const selected = locations.find((l) => l._id === selectedId) || null;
  const locationToDelete = locations.find((l) => l._id === deleteId) || null;

  useEffect(() => {
    getLocations()
      .then((r) => setLocations(r.data || []))
      .catch((e) => setToast(e.response?.data?.message || "Can't reach the server."));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CACHE, JSON.stringify(locations));
    } catch {
      /* ignore */
    }
  }, [locations]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Escape closes whatever is on top
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (deleteId && !deleting) setDeleteId(null);
      else if (picking) {
        setPicking(false);
        setSheetOpen(true);
      } else if (listOpen) setListOpen(false);
      else if (selectedId && !sheetOpen) setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteId, deleting, picking, listOpen, selectedId, sheetOpen]);

  // Map taps only place a pin while "Pick on map" is active (no accidental forms)
  const onMapClick = ({ latitude, longitude }) => {
    setListOpen(false);

    if (selectedId && !draft) {
      setSelectedId(null);
      return;
    }
    if (!picking) return;

    if (!inBahrain(latitude, longitude)) {
      setToast("This spot is outside Bahrain.");
      return;
    }

    setDraft((d) => ({ ...(d || EMPTY), latitude, longitude }));
    setPicking(false);
    setSheetOpen(true);
  };

  const onSelect = (id) => {
    if (sheetOpen || picking) return;
    setSelectedId(id);
    setListOpen(false);
  };

  const openDraft = (d) => {
    setSelectedId(null);
    setListOpen(false);
    setDraft(d);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setDraft(null);
    setPicking(false);
  };

  const save = async (data) => {
    try {
      const res = draft?._id
        ? await updateLocation(draft._id, data)
        : await createLocation(data);

      const loc = res.data;

      setLocations((prev) =>
        draft?._id ? prev.map((l) => (l._id === loc._id ? loc : l)) : [loc, ...prev]
      );

      setSelectedId(loc._id);
      closeSheet();
    } catch (e) {
      setToast(e.response?.data?.message || "Failed to save location.");
    }
  };

  const remove = async () => {
    if (!deleteId || deleting) return;

    try {
      setDeleting(true);
      await deleteLocation(deleteId);
      setLocations((prev) => prev.filter((l) => l._id !== deleteId));
      if (selectedId === deleteId) setSelectedId(null);
      setDeleteId(null);
      setToast("Location deleted.");
    } catch (e) {
      setToast(e.response?.data?.message || "Failed to delete location.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="app">
      <Suspense fallback={null}>
        <MapView
          locations={locations}
          selectedId={selectedId}
          draft={draft}
          pad={sheetOpen ? 320 : selected ? 170 : 0}
          onMapClick={onMapClick}
          onSelect={onSelect}
        />
      </Suspense>

      <div className="top">
     <img
        className="brand"
        src="/logo.png"
        alt="CleanUp Bahrain"
        fetchPriority="high"
        decoding="async"
        draggable="false"
      />

        <SearchBar onSelect={(p) => openDraft(p)} />

        <button
          className="circle glass"
          onClick={() => setListOpen((v) => !v)}
          aria-label="Locations"
        >
          <FaList />
        </button>
      </div>

      {listOpen && (
        <ListPanel
          locations={locations}
          onPick={(id) => {
            setSelectedId(id);
            setListOpen(false);
          }}
        />
      )}

      {picking && (
        <div className="banner glass">
          Tap the map to choose a spot
          <button
            onClick={() => {
              setPicking(false);
              setSheetOpen(true);
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {selected && !sheetOpen && (
        <DetailCard
          loc={selected}
          onClose={() => setSelectedId(null)}
          onEdit={(l) => openDraft({ ...l })}
          onDelete={setDeleteId}
          onToast={setToast}
        />
      )}

      {!sheetOpen && !picking && !selected && (
        <button className="fab" onClick={() => openDraft({ ...EMPTY })} aria-label="Add location">
          <FaPlus />
        </button>
      )}

      <LocationSheet
        open={sheetOpen}
        draft={draft}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        onPick={() => {
          setSheetOpen(false);
          setPicking(true);
        }}
        onSubmit={save}
        onClose={closeSheet}
        onToast={setToast}
      />

      {deleteId && (
        <div className="delete-overlay" onClick={() => !deleting && setDeleteId(null)}>
          <div
            className="delete-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            aria-describedby="delete-description"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="delete-icon">
              <FaTrashAlt />
            </div>

            <h3 id="delete-title">Delete Location</h3>

            <p id="delete-description">
              Are you sure you want to delete{" "}
              <strong>{locationToDelete?.title || "this location"}</strong>? This action cannot be
              undone.
            </p>

            <div className="delete-actions">
              <button className="delete-cancel" onClick={() => setDeleteId(null)} disabled={deleting}>
                Cancel
              </button>
              <button className="delete-confirm" onClick={remove} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast glass">{toast}</div>}
    </main>
  );
}