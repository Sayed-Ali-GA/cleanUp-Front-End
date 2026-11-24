import { useEffect, useState } from "react";
import { FaCopy, FaCrosshairs, FaExternalLinkAlt } from "react-icons/fa";
import { resolveLink } from "../services/locationService";
import { inBahrain, gmapsLink, parseCoords, copyText } from "../utils/maps";

export default function LocationSheet({ open, draft, onChange, onPick, onSubmit, onClose, onToast }) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (!draft) { setLink(""); setError(""); } }, [draft]);
  if (!draft) return null;

  const has = draft.latitude != null && draft.longitude != null;
  const gLink = has ? gmapsLink(draft.latitude, draft.longitude) : "";

  const applyLink = async (text) => {
    const v = (text ?? link).trim();
    if (!v) return;
    setBusy(true); setError("");
    try {
      let c = parseCoords(v);
      if (!c) {
        if (!/^https?:\/\//i.test(v)) throw new Error("Paste a Google Maps link or coordinates.");
        c = (await resolveLink(v)).data;
      }
      if (!inBahrain(c.latitude, c.longitude)) throw new Error("This location is outside Bahrain.");
      onChange({
        latitude: c.latitude,
        longitude: c.longitude,
        ...(c.name && !draft.title?.trim() ? { title: c.name } : {}),
      });
      setLink("");
    } catch (e) {
      setError(e.response?.data?.message || e.message || "Couldn't read this link.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!draft.title?.trim()) return setError("Please enter a title.");
    if (!has || !inBahrain(+draft.latitude, +draft.longitude)) return setError("Choose a location in Bahrain.");
    setSaving(true);
    try {
      await onSubmit({
        title: draft.title.trim(),
        description: (draft.description || "").trim(),
        latitude: +draft.latitude,
        longitude: +draft.longitude,
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={`sheet${open ? " open" : ""}`} onSubmit={submit}>
      <div className="grab" />
      <div className="sheetHead">
        <button type="button" className="textBtn" onClick={onClose}>Cancel</button>
        <h2>{draft._id ? "Edit Location" : "New Location"}</h2>
        <button type="submit" className="textBtn bold" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="group">
        <input
          value={draft.title || ""}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Title"
          maxLength={100}
        />
        <textarea
          value={draft.description || ""}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Description"
          maxLength={500}
          rows={2}
        />
      </div>

      <div className="group">
        <div className="row">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onPaste={(e) => { const t = e.clipboardData.getData("text"); setTimeout(() => applyLink(t), 0); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } }}
            placeholder="Paste any Google Maps link"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
          />
          <button type="button" className="textBtn bold" disabled={busy || !link.trim()} onClick={() => applyLink()}>
            {busy ? "…" : "Use"}
          </button>
        </div>
        <button type="button" className="row tap" onClick={onPick}>
          <FaCrosshairs /> Pick on map
        </button>
      </div>

      {has && (
        <div className="group info">
          <small>{(+draft.latitude).toFixed(6)}, {(+draft.longitude).toFixed(6)}</small>
          <div className="row">
            <span className="mono">{gLink}</span>
            <button type="button" className="x" aria-label="Copy"
              onClick={async () => onToast((await copyText(gLink)) ? "Link copied" : "Copy failed")}>
              <FaCopy />
            </button>
            <a className="x" href={gLink} target="_blank" rel="noreferrer" aria-label="Open"><FaExternalLinkAlt /></a>
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </form>
  );
}