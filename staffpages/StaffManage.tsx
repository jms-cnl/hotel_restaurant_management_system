
import { useMemo, useState, type FormEvent } from 'react';
import '../App.css';

type ReservationType = 'Hotel' | 'Restaurant' | 'Combined Stay';
type ReservationStatus = 'Confirmed' | 'Pending' | 'Cancelled' | 'Completed';

type Reservation = {
  id: number;
  type: ReservationType;
  guest: string;
  property: string;
  room: string;
  date: string;
  checkOut: string;
  time: string;
  guests: number;
  total: number;
  status: ReservationStatus;
};

const initialReservations: Reservation[] = [
  {
    id: 1001,
    type: 'Hotel',
    guest: 'Alex Santos',
    property: 'Serenity Garden Hotel',
    room: 'Deluxe Room',
    date: '2026-11-05',
    checkOut: '2026-11-07',
    time: '14:00',
    guests: 2,
    total: 7000,
    status: 'Confirmed',
  },
  {
    id: 1002,
    type: 'Restaurant',
    guest: 'Jamie Reyes',
    property: 'The Garden Table',
    room: 'Table for 4',
    date: '2026-11-06',
    checkOut: '',
    time: '18:00',
    guests: 4,
    total: 3200,
    status: 'Pending',
  },
  {
    id: 1003,
    type: 'Combined Stay',
    guest: 'Taylor Cruz',
    property: 'Serenity Garden Hotel + The Garden Table',
    room: 'Deluxe Room + Table for 2',
    date: '2026-11-08',
    checkOut: '2026-11-10',
    time: '19:00',
    guests: 2,
    total: 8600,
    status: 'Confirmed',
  },
];

const tabs: { label: string; type: 'All' | ReservationType }[] = [
  { label: 'Hotel Reservations', type: 'Hotel' },
  { label: 'Table Reservations', type: 'Restaurant' },
  { label: 'Combined Stays', type: 'Combined Stay' },
];

export default function StaffManage() {
  const [reservations, setReservations] =
    useState<Reservation[]>(initialReservations);
  const [activeType, setActiveType] =
    useState<'All' | ReservationType>('Hotel');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [editing, setEditing] = useState<Reservation | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return reservations.filter((item) => {
      const matchesType = activeType === 'All' || item.type === activeType;
      const matchesSearch =
        !query ||
        String(item.id).includes(query) ||
        item.guest.toLowerCase().includes(query) ||
        item.property.toLowerCase().includes(query);

      return matchesType && matchesSearch;
    });
  }, [reservations, activeType, search]);

  function deleteReservation(id: number) {
    const confirmed = window.confirm(
      `Delete reservation #${id}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setReservations((current) => current.filter((item) => item.id !== id));
    if (selected?.id === id) setSelected(null);
    if (editing?.id === id) setEditing(null);
  }

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    setReservations((current) =>
      current.map((item) => (item.id === editing.id ? editing : item))
    );
    setEditing(null);
  }

  function updateStatus(id: number, status: ReservationStatus) {
    setReservations((current) =>
      current.map((item) => (item.id === id ? { ...item, status } : item))
    );
  }

  const hotelCount = reservations.filter((item) => item.type === 'Hotel').length;
  const tableCount = reservations.filter(
    (item) => item.type === 'Restaurant'
  ).length;
  const combinedCount = reservations.filter(
    (item) => item.type === 'Combined Stay'
  ).length;

  return (
    <section className="listing-section staff-manage-page">
      <p className="eyebrow">STAFF WORKSPACE</p>
      <h1>Manage Reservations</h1>
      <p className="staff-manage-description">
        View booking details and manage hotel, table, and combined reservations.
      </p>

      <div className="staff-manage-tabs" role="tablist">
        {tabs.map((tab) => {
          const count =
            tab.type === 'Hotel'
              ? hotelCount
              : tab.type === 'Restaurant'
                ? tableCount
                : combinedCount;

          return (
            <button
              type="button"
              role="tab"
              aria-selected={activeType === tab.type}
              className={`staff-manage-tab ${
                activeType === tab.type ? 'active' : ''
              }`}
              key={tab.type}
              onClick={() => {
                setActiveType(tab.type);
                setSelected(null);
                setEditing(null);
              }}
            >
              {tab.label}
              <span>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="staff-manage-toolbar">
        <input
          type="search"
          placeholder="Search by reservation ID, guest, or property..."
          aria-label="Search reservations"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <span>{filtered.length} reservations</span>
      </div>

      <div className="staff-table-wrap">
        <table className="staff-reservations-table">
          <thead>
            <tr>
              <th>Reservation</th>
              <th>Guest</th>
              <th>Property / Booking</th>
              <th>Date</th>
              <th>Guests</th>
              <th>Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>#{item.id}</strong>
                  <small>{item.type}</small>
                </td>
                <td>{item.guest}</td>
                <td>
                  <strong>{item.property}</strong>
                  <small>{item.room}</small>
                </td>
                <td>
                  {item.date}
                  {item.checkOut && <small>Until {item.checkOut}</small>}
                  {!item.checkOut && <small>{item.time}</small>}
                </td>
                <td>{item.guests}</td>
                <td>₱{item.total.toLocaleString('en-PH')}</td>
                <td>
                  <select
                    aria-label={`Status for reservation ${item.id}`}
                    className={`staff-status-select ${item.status.toLowerCase()}`}
                    value={item.status}
                    onChange={(event) =>
                      updateStatus(item.id, event.target.value as ReservationStatus)
                    }
                  >
                    <option>Confirmed</option>
                    <option>Pending</option>
                    <option>Cancelled</option>
                    <option>Completed</option>
                  </select>
                </td>
                <td>
                  <div className="staff-table-actions">
                    <button type="button" onClick={() => setSelected(item)}>
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing({ ...item });
                        setSelected(null);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="delete"
                      onClick={() => deleteReservation(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="staff-empty-state">
                  No reservations match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <section className="staff-manage-panel">
          <h2>Reservation #{selected.id}</h2>
          <p><strong>Type:</strong> {selected.type}</p>
          <p><strong>Guest:</strong> {selected.guest}</p>
          <p><strong>Property:</strong> {selected.property}</p>
          <p><strong>Room / Booking:</strong> {selected.room}</p>
          <p><strong>Check-in / Date:</strong> {selected.date}</p>
          {selected.checkOut && (
            <p><strong>Check-out:</strong> {selected.checkOut}</p>
          )}
          <p><strong>Time:</strong> {selected.time}</p>
          <p><strong>Guests:</strong> {selected.guests}</p>
          <p><strong>Total:</strong> ₱{selected.total.toLocaleString('en-PH')}</p>
          <p><strong>Status:</strong> {selected.status}</p>
          <button
            type="button"
            className="staff-secondary-button"
            onClick={() => setSelected(null)}
          >
            Close Details
          </button>
        </section>
      )}

      {editing && (
        <section className="staff-manage-panel">
          <h2>Edit Reservation #{editing.id}</h2>
          <form className="staff-edit-form" onSubmit={saveEdit}>
            <label>
              Guest Name
              <input
                value={editing.guest}
                onChange={(event) =>
                  setEditing({ ...editing, guest: event.target.value })
                }
                required
              />
            </label>

            <label>
              Property / Booking
              <input
                value={editing.property}
                onChange={(event) =>
                  setEditing({ ...editing, property: event.target.value })
                }
                required
              />
            </label>

            <label>
              Room / Table
              <input
                value={editing.room}
                onChange={(event) =>
                  setEditing({ ...editing, room: event.target.value })
                }
                required
              />
            </label>

            <label>
              Date
              <input
                type="date"
                value={editing.date}
                onChange={(event) =>
                  setEditing({ ...editing, date: event.target.value })
                }
                required
              />
            </label>

            {editing.type !== 'Restaurant' && (
              <label>
                Check-out
                <input
                  type="date"
                  value={editing.checkOut}
                  onChange={(event) =>
                    setEditing({ ...editing, checkOut: event.target.value })
                  }
                />
              </label>
            )}

            <label>
              Time
              <input
                type="time"
                value={editing.time}
                onChange={(event) =>
                  setEditing({ ...editing, time: event.target.value })
                }
                required
              />
            </label>

            <label>
              Guests
              <input
                type="number"
                min="1"
                value={editing.guests}
                onChange={(event) =>
                  setEditing({ ...editing, guests: Number(event.target.value) })
                }
                required
              />
            </label>

            <label>
              Total (₱)
              <input
                type="number"
                min="0"
                value={editing.total}
                onChange={(event) =>
                  setEditing({ ...editing, total: Number(event.target.value) })
                }
                required
              />
            </label>

            <label>
              Status
              <select
                value={editing.status}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    status: event.target.value as ReservationStatus,
                  })
                }
              >
                <option>Confirmed</option>
                <option>Pending</option>
                <option>Cancelled</option>
                <option>Completed</option>
              </select>
            </label>

            <div className="staff-reservation-actions">
              <button type="submit" className="signup-button">
                Save Changes
              </button>
              <button
                type="button"
                className="staff-secondary-button"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
    </section>
  );
}
