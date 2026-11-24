
import { useEffect, useRef, useState } from "react";
import {
  FaSearch,
  FaTimes,
  FaMapMarkerAlt,
  FaSpinner,
} from "react-icons/fa";

const API = "https://photon.komoot.io/api/";

const formatAddress = (p) => {
  const parts = [
    p.street,
    p.district,
    p.suburb,
    p.city,
    p.state,
    p.postcode,
    p.country,
  ];

  return [...new Set(parts.filter(Boolean))].join(", ");
};

export default function SearchBar({ onSelect }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const wrapper = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (!wrapper.current?.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, []);

  useEffect(() => {
    const search = q.trim();

    if (search.length < 2) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError("");

        const url = new URL(API);

        url.search = new URLSearchParams({
          q: search,
          lat: "26.0667",
          lon: "50.586",
          limit: "8",
          lang: "en",
          bbox: "50.2,25.45,50.95,26.5",
        }).toString();

        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Search service unavailable");
        }

        const data = await response.json();

        const places = (data.features || [])
          .filter((item) => {
            const p = item.properties;

            return (
              p.countrycode?.toLowerCase() === "bh" &&
              Array.isArray(item.geometry?.coordinates) &&
              item.geometry.coordinates.length === 2
            );
          })
          .map((item) => {
            const p = item.properties;
            const [longitude, latitude] =
              item.geometry.coordinates;

            return {
              id: item.properties.osm_id
                ? `${p.osm_type}-${p.osm_id}`
                : `${latitude}-${longitude}`,
              title:
                p.name ||
                p.street ||
                p.district ||
                p.city ||
                "Unnamed location",
              description: formatAddress(p) || "Bahrain",
              latitude,
              longitude,
            };
          });

        setResults(places);
        setOpen(true);
      } catch (err) {
        if (err.name !== "AbortError") {
          setResults([]);
          setError("Unable to search. Please try again.");
          setOpen(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const selectPlace = (place) => {
    onSelect({
      title: place.title,
      description: place.description,
      latitude: place.latitude,
      longitude: place.longitude,
    });

    setQ("");
    setResults([]);
    setError("");
    setOpen(false);
  };

  const clearSearch = () => {
    setQ("");
    setResults([]);
    setError("");
    setOpen(false);
  };

  return (
    <div className="place-search" ref={wrapper}>
      <div className="place-search-box">
        <FaSearch className="place-search-icon" />

        <input
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (q.trim().length >= 2) setOpen(true);
          }}
          placeholder="Search places in Bahrain"
          autoComplete="off"
          spellCheck="false"
          aria-label="Search places in Bahrain"
        />

        {loading ? (
          <FaSpinner className="place-search-spinner" />
        ) : q ? (
          <button
            type="button"
            className="place-search-clear"
            onClick={clearSearch}
            aria-label="Clear search"
          >
            <FaTimes />
          </button>
        ) : null}
      </div>

      {open && q.trim().length >= 2 && (
        <div className="place-search-results">
          {loading && results.length === 0 && (
            <div className="place-search-message">
              Searching places...
            </div>
          )}

          {!loading && error && (
            <div className="place-search-message error">
              {error}
            </div>
          )}

          {!loading && !error && results.length === 0 && (
            <div className="place-search-message">
              No places found in Bahrain
            </div>
          )}

          {results.map((place) => (
            <button
              type="button"
              className="place-search-result"
              key={place.id}
              onClick={() => selectPlace(place)}
            >
              <span className="place-result-icon">
                <FaMapMarkerAlt />
              </span>

              <span className="place-result-info">
                <strong>{place.title}</strong>
                <small>{place.description}</small>
              </span>

              <span className="place-result-arrow">
                ›
              </span>
            </button>
          ))}

          <div className="place-search-footer">
            <span>Search results</span>
            <span>OpenStreetMap</span>
          </div>
        </div>
      )}
    </div>
  );
}
