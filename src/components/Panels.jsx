import { memo, useEffect, useState } from "react";
import { FaTimes, FaCopy, FaExternalLinkAlt, FaPen, FaTrash } from "react-icons/fa";
import { gmapsLink, copyText } from "../utils/maps";
import { loadGovernorates, govOf } from "../utils/governorates";

const shortGov = (n) => (n ? n.replace(" Governorate", "") : "");

// Uses the shared (cached) governorate data: no second download, no duplicate polygon code
function GovernorateName({ loc }) {
  const [name, setName] = useState("");

  useEffect(() => {
    let on = true;
    loadGovernorates()
      .then(() => {
        if (!on) return;
        setName(
          shortGov(
            govOf({
              governorate: loc.governorate,
              longitude: +loc.longitude,
              latitude: +loc.latitude,
            })
          )
        );
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, [loc.governorate, loc.latitude, loc.longitude]);

  return name ? <small className="governorate-name">{name}</small> : null;
}

export function DetailCard({ loc, onClose, onEdit, onDelete, onToast }) {
  const link = gmapsLink(loc.latitude, loc.longitude);

  return (
    <div className="card glass">
      <div className="cardHead">
        <div className="cardTitle">
          <h2>{loc.title}</h2>
          <GovernorateName loc={loc} />
        </div>
        <button className="x" onClick={onClose} aria-label="Close">
          <FaTimes />
        </button>
      </div>

      {loc.description && <p className="desc">{loc.description}</p>}

      <div className="actions">
        <a className="btn primary" href={link} target="_blank" rel="noreferrer">
          <FaExternalLinkAlt /> Open in Maps
        </a>
        <button
          className="btn"
          aria-label="Copy link"
          onClick={async () => onToast((await copyText(link)) ? "Link copied" : "Copy failed")}
        >
          <FaCopy />
        </button>
        <button className="btn" onClick={() => onEdit(loc)} aria-label="Edit">
          <FaPen />
        </button>
        <button className="btn danger" onClick={() => onDelete(loc._id)} aria-label="Delete">
          <FaTrash />
        </button>
      </div>
    </div>
  );
}

const Row = memo(function Row({ l, onPick }) {
  return (
    <button className="result" onClick={() => onPick(l._id)}>
      <strong>{l.title}</strong>
      <GovernorateName loc={l} />
      {l.description && <small>{l.description}</small>}
    </button>
  );
});

export function ListPanel({ locations, onPick }) {
  return (
    <div className="panel glass">
      <h3>{locations.length} locations</h3>
      {locations.length === 0 && <p className="desc" style={{ padding: "0 14px 12px" }}>Nothing saved yet.</p>}
      {locations.map((l) => (
        <Row key={l._id} l={l} onPick={onPick} />
      ))}
    </div>
  );
}