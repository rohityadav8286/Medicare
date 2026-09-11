// src/components/AnimatedDoctorList.responsive.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import {
  Star,
  BadgeIndianRupee,
  Trash2,
  Search,
  Users,
  EyeClosed,
  Pencil,
} from "lucide-react";
import { doctorListStyles } from "../../assets/dummyStyles";
import { adminFetch } from "../../utils/adminFetch";

function formatDateISO(iso) {
  if (!iso || typeof iso !== "string") return iso;
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "June",
    "July",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = String(Number(d));
  const month = monthNames[dateObj.getMonth()] || "";
  return `${day} ${month} ${y}`;
}

/* ---------- New helpers for normalized + sorted schedule keys ---------- */

/**
 * Normalize any date-like string / Date to YYYY-MM-DD or return null if invalid.
 */
function normalizeToDateString(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * Build a normalized schedule map: { 'YYYY-MM-DD': [slot, slot2, ...], ... }
 * - preserves array slots or converts non-arrays to []
 */
function buildScheduleMap(schedule) {
  const map = {};
  if (!schedule || typeof schedule !== "object") return map;
  Object.entries(schedule).forEach(([k, v]) => {
    const nd = normalizeToDateString(k) || String(k);
    map[nd] = Array.isArray(v) ? v.slice() : [];
  });
  return map;
}

/**
 * Given a schedule-like object (or array of date strings), return date keys ordered:
 * - past dates first, nearest past → older past
 * - then today & future, earliest → latest
 */
function getSortedScheduleDates(scheduleLike) {
  // get keys from either a map object or array
  let keys = [];
  if (Array.isArray(scheduleLike)) {
    keys = scheduleLike.map(normalizeToDateString).filter(Boolean);
  } else if (scheduleLike && typeof scheduleLike === "object") {
    keys = Object.keys(scheduleLike).map(normalizeToDateString).filter(Boolean);
  }

  // unique
  keys = Array.from(new Set(keys));

  const parsed = keys.map((ds) => ({ ds, date: new Date(ds) }));

  const dateVal = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

  const today = new Date();
  const todayVal = dateVal(today);

  const past = parsed
    .filter((p) => dateVal(p.date) < todayVal)
    .sort((a, b) => dateVal(b.date) - dateVal(a.date)); // nearest past first

  const future = parsed
    .filter((p) => dateVal(p.date) >= todayVal)
    .sort((a, b) => dateVal(a.date) - dateVal(b.date)); // earliest first (includes today)

  return [...past, ...future].map((p) => p.ds);
}

/* --------------------------------------------------------------------- */

export default function AnimatedDoctorListResponsive({ apiBase }) {
  const API_BASE = apiBase || "http://localhost:4000";
  const { getToken } = useAuth();

  const [doctors, setDoctors] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  // track if we are on a mobile (tailwind "sm" breakpoint is 640px)
  const [isMobileScreen, setIsMobileScreen] = useState(false);
  useEffect(() => {
    function onResize() {
      if (typeof window === "undefined") return;
      setIsMobileScreen(window.innerWidth < 640);
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // fetch doctors from backend (robust to different response shapes)
  async function fetchDoctors() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/doctors`);
      const body = await res.json().catch(() => null);

      if (res.ok && body && body.success) {
        // accept either body.data (new) or body.doctors (older)
        const list = Array.isArray(body.data)
          ? body.data
          : Array.isArray(body.doctors)
          ? body.doctors
          : [];

        // normalize schedule to plain object and ensure keys normalized
        const normalized = list.map((d) => {
          const scheduleMap = buildScheduleMap(d.schedule || {});
          return {
            ...d,
            schedule: scheduleMap,
          };
        });
        setDoctors(normalized);
      } else {
        console.error("Failed to fetch doctors", { status: res.status, body });
        setDoctors([]);
      }
    } catch (err) {
      console.error("Network error fetching doctors", err);
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = doctors;
    if (filterStatus === "available") {
      list = list.filter(
        (d) => (d.availability || "").toString().toLowerCase() === "available"
      );
    } else if (filterStatus === "unavailable") {
      list = list.filter(
        (d) => (d.availability || "").toString().toLowerCase() !== "available"
      );
    }
    if (!q) return list;
    return list.filter((d) => {
      return (
        (d.name || "").toLowerCase().includes(q) ||
        (d.specialization || "").toLowerCase().includes(q)
      );
    });
  }, [doctors, query, filterStatus]);

  const displayed = useMemo(() => {
    if (showAll) return filtered;
    return filtered.slice(0, 6);
  }, [filtered, showAll]);

  function toggle(id) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  // delete doctor (calls backend)
  async function removeDoctor(id) {
    const doc = doctors.find((d) => (d._id || d.id) === id);
    if (!doc) return;
    const ok = window.confirm(`Delete ${doc.name}? This cannot be undone.`);
    if (!ok) return;

    try {
      const res = await adminFetch(`${API_BASE}/api/doctors/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        alert(body?.message || "Failed to delete");
        return;
      }
      // remove locally
      setDoctors((prev) => prev.filter((p) => (p._id || p.id) !== id));
      if (expanded === id) setExpanded(null);
    } catch (err) {
      console.error("delete error", err);
      alert("Network error deleting doctor");
    }
  }

  function startEdit(doc) {
    setEditingDoctor(doc);
    setEditForm({
      name: doc.name || "",
      email: doc.email || "",
      specialization: doc.specialization || "",
      experience: doc.experience ?? "",
      qualifications: doc.qualifications || "",
      location: doc.location || "",
      about: doc.about || "",
      fee: doc.fee ?? "",
      availability: doc.availability || "Available",
      rating: doc.rating ?? "",
    });
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (!editingDoctor) return;

    setSavingEdit(true);
    const id = editingDoctor._id || editingDoctor.id;
    try {
      // Always obtain the active Admin Clerk token at click time. A token from
      // localStorage can be stale after a Clerk session changes.
      const token = await getToken();
      if (!token) {
        throw new Error("Your admin sign-in session has expired. Please sign in again.");
      }

      const res = await adminFetch(`${API_BASE}/api/doctors/${id}/admin`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...editForm,
          experience: String(editForm.experience || "").trim(),
          fee: Number(editForm.fee) || 0,
          rating: Number(editForm.rating) || 0,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || "Failed to update doctor");

      const updated = body?.data || body?.doctor;
      setDoctors((current) =>
        current.map((doctor) =>
          (doctor._id || doctor.id) === id ? { ...doctor, ...updated } : doctor,
        ),
      );
      setEditingDoctor(null);
    } catch (error) {
      alert(error.message || "Unable to update doctor details");
    } finally {
      setSavingEdit(false);
    }
  }

  function applyStatusFilter(status) {
    setFilterStatus((prev) => (prev === status ? "all" : status));
    setExpanded(null);
    setShowAll(false);
  }

  return (
    <div className={doctorListStyles.container}>
      <header className={doctorListStyles.headerContainer}>
        <div className={doctorListStyles.headerTopSection}>
          <div className={doctorListStyles.headerIconContainer}>
            <div className={doctorListStyles.headerIcon}>
              <Users size={20} className={doctorListStyles.headerIconSvg} />
            </div>
            <div>
              <h1 className={doctorListStyles.headerTitle}>Find a Doctor</h1>
              <p className={doctorListStyles.headerSubtitle}>
                Search by name or specialization
              </p>
            </div>
          </div>

          <div className={doctorListStyles.headerSearchContainer}>
            <div className={doctorListStyles.searchBox}>
              <Search size={16} className={doctorListStyles.searchIcon} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search doctors, specialization"
                className={doctorListStyles.searchInput}
              />
            </div>

            <button
              onClick={() => {
                setQuery("");
                setExpanded(null);
                setShowAll(false);
                setFilterStatus("all");
              }}
              className={doctorListStyles.clearButton}
            >
              Clear
            </button>
          </div>
        </div>

        <div className={doctorListStyles.filterContainer}>
          <button
            onClick={() => applyStatusFilter("available")}
            aria-pressed={filterStatus === "available"}
            className={doctorListStyles.filterButton(
              filterStatus === "available",
              "emerald"
            )}
          >
            Available
          </button>

          <button
            onClick={() => applyStatusFilter("unavailable")}
            aria-pressed={filterStatus === "unavailable"}
            className={doctorListStyles.filterButton(
              filterStatus === "unavailable",
              "red"
            )}
          >
            Unavailable
          </button>
        </div>
      </header>

      <main className={doctorListStyles.gridContainer}>
        {loading && (
          <div className={doctorListStyles.loadingContainer}>
            Loading doctors...
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className={doctorListStyles.noResultsContainer}>
            No doctors match your search.
          </div>
        )}

        {displayed.map((doc) => {
          const id = doc._id || doc.id;
          const isOpen = expanded === id;
          const isAvailable = doc.availability === "Available";

          // build normalized schedule map and sorted date keys
          const scheduleMap = buildScheduleMap(doc.schedule || {});
          const sortedDates = getSortedScheduleDates(scheduleMap);

          return (
            <article key={id} className={doctorListStyles.article}>
              <div className={doctorListStyles.articleContent}>
                <img
                  src={doc.imageUrl || doc.image || ""}
                  alt={doc.name}
                  className={doctorListStyles.doctorImage}
                />

                <div className={doctorListStyles.doctorInfoContainer}>
                  <div className={doctorListStyles.doctorHeader}>
                    <div className="min-w-0 w-full">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={doctorListStyles.doctorName}>
                          {doc.name}
                        </h3>

                        <span
                          className={doctorListStyles.availabilityBadge(
                            isAvailable
                          )}
                        >
                          <span
                            className={doctorListStyles.availabilityDot(
                              isAvailable
                            )}
                          />
                          {isAvailable ? "Available" : "Unavailable"}
                        </span>
                      </div>

                      <div className={doctorListStyles.doctorDetails}>
                        {doc.specialization} • {doc.experience} years
                      </div>
                    </div>

                    <div className={doctorListStyles.ratingContainer}>
                      <div className={doctorListStyles.rating}>
                        <Star size={14} /> {doc.rating}
                      </div>
                      <button
                        onClick={() => toggle(id)}
                        aria-expanded={isOpen}
                        className={doctorListStyles.toggleButton(isOpen)}
                      >
                        <EyeClosed size={18} />
                      </button>
                    </div>
                  </div>

                  <div className={doctorListStyles.statsContainer}>
                    <div className={doctorListStyles.statsLabel}>Patients</div>
                    <div className={doctorListStyles.statsValue}>
                      <Users size={14} /> {doc.patients}
                    </div>

                    <div className={doctorListStyles.actionContainer}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(doc)}
                          title={`Edit ${doc.name}`}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          onClick={() => removeDoctor(id)}
                          title={`Delete ${doc.name}`}
                          className={doctorListStyles.deleteButton}
                        >
                          <Trash2 size={14} /> Delete
                        </button>

                        <div className={doctorListStyles.feesLabel}>Fees :</div>
                        <div className={doctorListStyles.feesValue}>
                          <BadgeIndianRupee /> {doc.fee}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={doctorListStyles.expandableContent}
                style={{
                  maxHeight: isOpen ? (isMobileScreen ? 320 : 600) : 0,
                  transition:
                    "max-height 420ms cubic-bezier(.2,.9,.2,1), padding 220ms ease",
                  paddingTop: isOpen ? 16 : 0,
                  paddingBottom: isOpen ? 16 : 0,
                }}
              >
                {isOpen && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div className={doctorListStyles.aboutSection}>
                      <h4 className={doctorListStyles.aboutHeading}>About</h4>
                      <p className={doctorListStyles.aboutText}>{doc.about}</p>

                      <div className="mt-4">
                        <div className={doctorListStyles.qualificationsHeading}>
                          Qualifications
                        </div>
                        <div className={doctorListStyles.qualificationsText}>
                          {doc.qualifications}
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className={doctorListStyles.scheduleHeading}>
                          Schedule
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {sortedDates.map((date) => {
                            const slots = scheduleMap[date] || [];
                            return (
                              <div key={date} className="min-w-full md:min-w-0">
                                <div className={doctorListStyles.scheduleDate}>
                                  {formatDateISO(date)}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2">
                                  {slots.map((s, i) => (
                                    <span
                                      key={i}
                                      className={doctorListStyles.scheduleSlot}
                                    >
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <aside className={doctorListStyles.statsSidebar}>
                      <div className={doctorListStyles.statsItemHeading}>
                        Success
                      </div>
                      <div className={doctorListStyles.statsItemValue}>
                        {doc.success}%
                      </div>

                      <div className={doctorListStyles.statsItemHeading}>
                        Patients
                      </div>
                      <div className={doctorListStyles.statsItemValue}>
                        {doc.patients}
                      </div>

                      <div className={doctorListStyles.statsItemHeading}>
                        Location
                      </div>
                      <div className={doctorListStyles.locationValue}>
                        {doc.location}
                      </div>
                    </aside>
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {filtered.length > 6 && (
          <div className={doctorListStyles.showMoreContainer}>
            <button
              onClick={() => setShowAll((s) => !s)}
              className={doctorListStyles.showMoreButton}
            >
              {showAll ? "Show less" : `Show more (${filtered.length - 4})`}
            </button>
          </div>
        )}
      </main>

      {editingDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form onSubmit={saveEdit} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-900">Edit doctor</h2>
              <button type="button" onClick={() => setEditingDoctor(null)} className="text-sm font-medium text-slate-500 hover:text-slate-800">Cancel</button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                ["name", "Name"], ["email", "Email"], ["specialization", "Specialization"],
                ["experience", "Experience (for example: 5+ years)"], ["qualifications", "Qualifications"],
                ["location", "Location"], ["fee", "Fee", "number"], ["rating", "Rating", "number"],
              ].map(([field, label, type = "text"]) => (
                <label key={field} className="text-sm font-medium text-slate-700">
                  {label}
                  <input type={type} value={editForm[field] ?? ""} onChange={(event) => setEditForm((current) => ({ ...current, [field]: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600" required={field === "name" || field === "email"} />
                </label>
              ))}
              <label className="text-sm font-medium text-slate-700">
                Availability
                <select value={editForm.availability} onChange={(event) => setEditForm((current) => ({ ...current, availability: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600">
                  <option>Available</option><option>Unavailable</option>
                </select>
              </label>
            </div>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              About
              <textarea value={editForm.about ?? ""} onChange={(event) => setEditForm((current) => ({ ...current, about: event.target.value }))} rows="4" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600" />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingDoctor(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
              <button disabled={savingEdit} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{savingEdit ? "Saving..." : "Save changes"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
