import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import '../App.css';
import AdminManage from './AdminManage';

// ========================================
// TYPE DEFINITIONS
// ========================================

type Section = {
  title: string;
  description: string;
  columns?: string[];
};

type Status = 'Available' | 'Reserved' | 'Occupied' | 'Maintenance';

type Room = {
  number: string;
  type: string;
  capacity: number;
  price: number;
  status: Status;
  image: string;
  amenities: string[];
};

type RestaurantTable = {
  number: string;
  type: string;
  capacity: number;
  location: string;
  status: Status;
  image: string;
};

// ========================================
// ADMIN PAGE SECTIONS
// ========================================

const sections: Record<string, Section> = {
  '/admin/dashboard': {
    title: 'Dashboard',
    description:
      'Operational overview for Serenity Hotel and its in-house restaurant.',
  },
  '/admin/rooms-tables': {
    title: 'Rooms & Tables',
    description:
      'Browse room and restaurant table information. Booking actions are not available to Admin.',
  },
  '/admin/manage': {
    title: 'Manage',
    description:
      'Manage establishment records, existing reservations, and user accounts.',
  },
  '/admin/support': {
    title: 'Customer Support',
    description:
      'Review customer complaints, feedback, inquiries, and booking issues.',
  },
  '/admin/notifications': {
    title: 'Notifications',
    description:
      'System events and updates will appear here when connected to the notification service.',
  },
  '/admin/profile': {
    title: 'Profile',
    description:
      'Administrator account information and recorded administrative activity.',
  },
};

// ========================================
// ADMIN NAVIGATION GROUPS
// ========================================

const groups: Record<string, string[]> = {
  '/admin/rooms-tables': ['Rooms', 'Restaurant Tables'],
  '/admin/manage': [
    'Rooms',
    'Tables',
    'Room Reservations',
    'Table Reservations',
    'Combined Bookings',
    'Users',
  ],
  '/admin/support': [
    'All Tickets',
    'Complaints',
    'Feedback',
    'Inquiries',
    'Booking Issues',
  ],
};

// ========================================
// ROOM AND TABLE STATUSES
// ========================================

const statuses: Array<'All Statuses' | Status> = [
  'All Statuses',
  'Available',
  'Reserved',
  'Occupied',
  'Maintenance',
];

// ========================================
// ROOM DETAILS
// ========================================

const rooms: Room[] = [
  {
    number: '101',
    image:
      'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=85',
    type: 'Standard Room',
    capacity: 2,
    price: 2500,
    status: 'Available',
    amenities: [
      'Wi-Fi',
      'Air conditioning',
      'TV',
      'Private bathroom',
      'Toiletries',
    ],
  },
  {
    number: '102',
    image:
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=85',
    type: 'Standard Room',
    capacity: 2,
    price: 2500,
    status: 'Occupied',
    amenities: [
      'Wi-Fi',
      'Air conditioning',
      'TV',
      'Private bathroom',
      'Toiletries',
    ],
  },
  {
    number: '201',
    image:
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=900&q=85',
    type: 'Deluxe Room',
    capacity: 3,
    price: 3800,
    status: 'Available',
    amenities: [
      'Wi-Fi',
      'Air conditioning',
      'TV',
      'Private bathroom',
      'Toiletries',
    ],
  },
  {
    number: '202',
    image:
      'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=900&q=85',
    type: 'Deluxe Room',
    capacity: 3,
    price: 3800,
    status: 'Reserved',
    amenities: [
      'Wi-Fi',
      'Air conditioning',
      'TV',
      'Private bathroom',
      'Toiletries',
    ],
  },
  {
    number: '301',
    image:
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=900&q=85',
    type: 'Family Room',
    capacity: 5,
    price: 5500,
    status: 'Available',
    amenities: [
      'Wi-Fi',
      'Air conditioning',
      'TV',
      'Private bathroom',
      'Toiletries',
    ],
  },
  {
    number: '302',
    image:
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=900&q=85',
    type: 'Family Room',
    capacity: 5,
    price: 5500,
    status: 'Maintenance',
    amenities: [
      'Wi-Fi',
      'Air conditioning',
      'TV',
      'Private bathroom',
      'Toiletries',
    ],
  },
  {
    number: '401',
    image:
      'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=900&q=85',
    type: 'Executive Suite',
    capacity: 2,
    price: 7500,
    status: 'Occupied',
    amenities: [
      'Wi-Fi',
      'Air conditioning',
      'TV',
      'Private bathroom',
      'Toiletries',
    ],
  },
  {
    number: '402',
    image:
      'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=900&q=85',
    type: 'Executive Suite',
    capacity: 2,
    price: 7500,
    status: 'Reserved',
    amenities: [
      'Wi-Fi',
      'Air conditioning',
      'TV',
      'Private bathroom',
      'Toiletries',
    ],
  },
];

// ========================================
// RESTAURANT TABLE DETAILS
// ========================================

const restaurantTables: RestaurantTable[] = [
  {
    number: 'T01',
    image:
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=85',
    type: 'Small Table',
    capacity: 2,
    location: 'Window Area',
    status: 'Available',
  },
  {
    number: 'T02',
    image:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=85',
    type: 'Small Table',
    capacity: 2,
    location: 'Window Area',
    status: 'Reserved',
  },
  {
    number: 'T03',
    image:
      'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=85',
    type: 'Standard Table',
    capacity: 4,
    location: 'Main Dining Area',
    status: 'Available',
  },
  {
    number: 'T04',
    image:
      'https://images.unsplash.com/photo-1515003197210-e0cd7184f8b5?auto=format&fit=crop&w=900&q=85',
    type: 'Standard Table',
    capacity: 4,
    location: 'Main Dining Area',
    status: 'Occupied',
  },
  {
    number: 'T05',
    image:
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=85',
    type: 'Family Table',
    capacity: 6,
    location: 'Main Dining Area',
    status: 'Available',
  },
  {
    number: 'T06',
    image:
      'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=900&q=85',
    type: 'Family Table',
    capacity: 6,
    location: 'Garden View',
    status: 'Reserved',
  },
  {
    number: 'T07',
    image:
      'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=900&q=85',
    type: 'Large Table',
    capacity: 8,
    location: 'Private Dining Area',
    status: 'Available',
  },
  {
    number: 'T08',
    image:
      'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=85',
    type: 'Large Table',
    capacity: 8,
    location: 'Private Dining Area',
    status: 'Maintenance',
  },
];

// ========================================
// EMPTY STATE COMPONENT
// ========================================

function EmptyState({
  message = 'No records are available yet.',
}: {
  message?: string;
}) {
  return (
    <div className="admin-empty">
      <span aria-hidden="true">—</span>
      <strong>Nothing to display</strong>
      <p>{message}</p>
    </div>
  );
}

// ========================================
// DATA TABLE COMPONENT
// ========================================

type TableRow = Record<string, string>;

function DataTable({
  columns,
  rows,
  emptyMessage = 'No sample records available.',
}: {
  columns: string[];
  rows: TableRow[];
  emptyMessage?: string;
}) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={`${row[columns[0]] || 'record'}-${index}`}>
                {columns.map((column) => (
                  <td key={column}>{row[column] || '—'}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState message={emptyMessage} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ========================================
// SAMPLE RESERVATION DATA
// ========================================

const sampleReservations: TableRow[] = [
  {
    'Reservation ID': 'RH-1042',
    Customer: 'Ava Santos',
    Room: '201 · Deluxe',
    Table: 'T03',
    Dates: 'Oct 30–Nov 1, 2026',
    'Date & Time': 'Oct 30, 2026 · 7:00 PM',
    'Dates & Times': 'Oct 30–Nov 1 · Dinner 7:00 PM',
    Status: 'Confirmed',
    Actions: 'View (demo)',
  },
  {
    'Reservation ID': 'RH-1043',
    Customer: 'Noah Reyes',
    Room: '101 · Standard',
    Table: 'T02',
    Dates: 'Nov 2–3, 2026',
    'Date & Time': 'Nov 2, 2026 · 6:30 PM',
    'Dates & Times': 'Nov 2–3 · Dinner 6:30 PM',
    Status: 'Pending',
    Actions: 'View (demo)',
  },
  {
    'Reservation ID': 'RH-1044',
    Customer: 'Mia Cruz',
    Room: '301 · Family',
    Table: 'T06',
    Dates: 'Nov 5–7, 2026',
    'Date & Time': 'Nov 5, 2026 · 8:00 PM',
    'Dates & Times': 'Nov 5–7 · Dinner 8:00 PM',
    Status: 'Completed',
    Actions: 'View (demo)',
  },
];

// ========================================
// SAMPLE USER DATA
// ========================================

const sampleUsers: TableRow[] = [
  {
    User: 'Ava Santos',
    Email: 'ava.santos@example.com',
    Role: 'Customer',
    'Account Status': 'Active',
    Actions: 'View (demo)',
  },
  {
    User: 'Noah Reyes',
    Email: 'noah.reyes@example.com',
    Role: 'Customer',
    'Account Status': 'Active',
    Actions: 'View (demo)',
  },
  {
    User: 'Ella Morgan',
    Email: 'ella.morgan@example.com',
    Role: 'Staff',
    'Account Status': 'Active',
    Actions: 'View (demo)',
  },
  {
    User: 'Liam Patel',
    Email: 'liam.patel@example.com',
    Role: 'Customer',
    'Account Status': 'Pending',
    Actions: 'View (demo)',
  },
];

// ========================================
// SAMPLE CUSTOMER SUPPORT TICKETS
// ========================================

const sampleTickets: TableRow[] = [
  {
    'Ticket ID': 'CS-021',
    Customer: 'Ava Santos',
    Subject: 'Reservation date clarification',
    Category: 'Inquiry',
    'Date Submitted': 'Oct 26, 2026',
    Status: 'Open',
    Actions: 'Review (demo)',
  },
  {
    'Ticket ID': 'CS-022',
    Customer: 'Noah Reyes',
    Subject: 'Table booking update',
    Category: 'Booking Issues',
    'Date Submitted': 'Oct 27, 2026',
    Status: 'In Review',
    Actions: 'Review (demo)',
  },
  {
    'Ticket ID': 'CS-023',
    Customer: 'Mia Cruz',
    Subject: 'Dining experience feedback',
    Category: 'Feedback',
    'Date Submitted': 'Oct 28, 2026',
    Status: 'Resolved',
    Actions: 'Review (demo)',
  },
];

// ========================================
// SAMPLE NOTIFICATIONS
// ========================================

const sampleNotifications = [
  {
    title: 'New room reservation',
    detail: 'Reservation RH-1042 · Deluxe Room 201',
    time: 'Today, 10:42 AM',
  },
  {
    title: 'Customer support ticket received',
    detail: 'Ticket CS-023 · Dining experience feedback',
    time: 'Today, 9:15 AM',
  },
  {
    title: 'Room maintenance reminder',
    detail: 'Room 302 is marked for maintenance',
    time: 'Yesterday, 4:30 PM',
  },
];

// ========================================
// STATUS BADGE COMPONENT
// ========================================

function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`admin-status-badge status-${status.toLowerCase()}`}>
      {status}
    </span>
  );
}

// ========================================
// ROOMS AND TABLES PAGE
// ========================================

function RoomsAndTables() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All Statuses' | Status>(
    'All Statuses',
  );
  const [active, setActive] = useState<'Rooms' | 'Restaurant Tables'>('Rooms');

  // ========================================
  // FILTER ROOM RECORDS
  // ========================================

  const filteredRooms = useMemo(
    () =>
      rooms.filter(
        (room) =>
          room.number.toLowerCase().includes(search.trim().toLowerCase()) &&
          (statusFilter === 'All Statuses' || room.status === statusFilter),
      ),
    [search, statusFilter],
  );

  // ========================================
  // FILTER RESTAURANT TABLE RECORDS
  // ========================================

  const filteredTables = useMemo(
    () =>
      restaurantTables.filter(
        (table) =>
          table.number.toLowerCase().includes(search.trim().toLowerCase()) &&
          (statusFilter === 'All Statuses' || table.status === statusFilter),
      ),
    [search, statusFilter],
  );

  // ========================================
  // INVENTORY COUNTS
  // ========================================

  const currentCount =
    active === 'Rooms' ? filteredRooms.length : filteredTables.length;

  const totalCount =
    active === 'Rooms' ? rooms.length : restaurantTables.length;

  const statusCounts = statuses.slice(1).map((status) => ({
    status,
    count: (active === 'Rooms' ? rooms : restaurantTables).filter(
      (item) => item.status === status,
    ).length,
  }));

  return (
    <>
      {/* ========================================
          ROOM AND TABLE TABS
      ======================================== */}

      <div
        className="admin-tabs"
        role="tablist"
        aria-label="Rooms and restaurant tables"
      >
        {(['Rooms', 'Restaurant Tables'] as const).map((tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={active === tab}
            className={active === tab ? 'is-active' : ''}
            key={tab}
            onClick={() => setActive(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ========================================
          INVENTORY INFORMATION
      ======================================== */}

      <p className="admin-note">
        Serenity has one hotel and one restaurant. These are sample frontend
        records for display only.
      </p>

      {/* ========================================
          SEARCH AND STATUS FILTER
      ======================================== */}

      <div className="admin-rooms-toolbar">
        <label className="admin-search-label">
          <span>
            Search {active === 'Rooms' ? 'room' : 'table'} number
          </span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={active === 'Rooms' ? 'e.g. 101' : 'e.g. T01'}
          />
        </label>

        <label className="admin-filter-label">
          <span>Filter by status</span>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as 'All Statuses' | Status,
              )
            }
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* ========================================
          INVENTORY SUMMARY
      ======================================== */}

      <div className="admin-inventory-summary">
        <div>
          <span>Showing</span>
          <strong>
            {currentCount} <small>/ {totalCount}</small>
          </strong>
          <span>
            {active === 'Rooms' ? 'rooms' : 'restaurant tables'}
          </span>
        </div>

        {statusCounts.map(({ status, count }) => (
          <div key={status}>
            <span>{status}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>

      {/* ========================================
          ROOM INVENTORY CARDS
      ======================================== */}

      {active === 'Rooms' ? (
        <div className="admin-inventory-grid">
          {filteredRooms.map((room) => (
            <article
              className="admin-inventory-card"
              key={room.number}
            >
              <div
                className={`admin-room-placeholder room-${room.type
                  .toLowerCase()
                  .replaceAll(' ', '-')}`}
              >
                <img
                  src={room.image}
                  alt={`${room.type} - Room ${room.number}`}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
                <span className="admin-image-label">
                  ROOM {room.number}
                </span>
              </div>

              <div className="admin-inventory-card-body">
                <div className="admin-inventory-card-heading">
                  <div>
                    <p className="admin-card-kicker">
                      ROOM {room.number}
                    </p>
                    <h2>{room.type}</h2>
                  </div>

                  <StatusBadge status={room.status} />
                </div>

                <div className="admin-card-facts">
                  <span>♙ Up to {room.capacity} guests</span>
                  <strong>
                    ₱{room.price.toLocaleString('en-PH')}{' '}
                    <small>/ night</small>
                  </strong>
                </div>

                {/* ========================================
                    ROOM AMENITIES
                ======================================== */}

                <div className="admin-amenities">
                  <span className="admin-detail-label">AMENITIES</span>
                  <div>
                    {room.amenities.map((amenity) => (
                      <span key={amenity}>{amenity}</span>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (

        // ========================================
        // RESTAURANT TABLE INVENTORY CARDS
        // ========================================

        <div className="admin-inventory-grid admin-table-cards">
          {filteredTables.map((table) => (
            <article
              className="admin-inventory-card"
              key={table.number}
            >
              <div className="admin-table-placeholder">
                <img
                  src={table.image}
                  alt={`${table.type} ${table.number} at ${table.location}`}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
                <span className="admin-image-label">
                  {table.location}
                </span>
              </div>

              <div className="admin-inventory-card-body">
                <div className="admin-inventory-card-heading">
                  <div>
                    <p className="admin-card-kicker">
                      TABLE {table.number}
                    </p>
                    <h2>{table.type}</h2>
                  </div>

                  <StatusBadge status={table.status} />
                </div>

                <div className="admin-card-facts">
                  <span>
                    ♙ Seats up to {table.capacity} guests
                  </span>
                </div>

                {/* ========================================
                    RESTAURANT TABLE LOCATION
                ======================================== */}

                <div className="admin-table-location">
                  <span className="admin-detail-label">LOCATION</span>
                  <strong>{table.location}</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ========================================
          EMPTY INVENTORY STATE
      ======================================== */}

      {currentCount === 0 && (
        <div className="admin-panel">
          <EmptyState message="No rooms or tables match your search and status filter. Try changing the filters." />
        </div>
      )}

      {/* ========================================
          DEMO DATA DISCLAIMER
      ======================================== */}

      <p className="admin-demo-disclaimer">
        Demo data only · Search and filters run in this page and do not update
        a database.
      </p>
    </>
  );
}

// ========================================
// MAIN ADMIN PAGES COMPONENT
// ========================================

export default function AdminPages() {
  const location = useLocation();
  const section =
    sections[location.pathname] || sections['/admin/dashboard'];

  const [selected, setSelected] = useState('');
  const [read, setRead] = useState(false);

  const tabs = groups[location.pathname] || [];
  const active =
    selected && tabs.includes(selected) ? selected : tabs[0];

  return (
    <section className="listing-section admin-page">

      {/* ========================================
          ADMIN PAGE HEADER
      ======================================== */}

      {location.pathname.replace(/\/+$/, '') !== '/admin/manage' && section.title !== 'Manage' && (
        <div className="admin-page-heading">
          <div>
            <p className="eyebrow">SERENITY HOTEL &amp; RESTAURANT</p>
            <h1>{section.title}</h1>
            <p className="staff-manage-description">
              {section.description}
            </p>
          </div>

          <span className="staff-dashboard-badge">Admin</span>
        </div>
      )}

      {/* ========================================
          ADMIN DASHBOARD
      ======================================== */}

      {location.pathname === '/admin/dashboard' && (
        <>
          {/* ========================================
              DASHBOARD STATISTICS
          ======================================== */}

          <div className="admin-stat-grid">
            {[
              {
                label: 'Room Occupancy',
                value: '62.5%',
                note: '5 of 8 sample rooms occupied/reserved',
              },
              {
                label: 'Room Reservations',
                value: '12',
                note: 'Sample reservations this month',
              },
              {
                label: 'Table Reservations',
                value: '18',
                note: 'Sample dining reservations',
              },
              {
                label: 'Revenue Overview',
                value: '₱84,500',
                note: 'Illustrative demo total',
              },
              {
                label: 'Registered Users',
                value: '248',
                note: 'Sample account count',
              },
            ].map(({ label, value, note }) => (
              <article className="admin-stat-card" key={label}>
                <p>{label}</p>
                <strong>{value}</strong>
                <small>{note} · Demo data</small>
              </article>
            ))}
          </div>

          {/* ========================================
              RECENT OPERATIONS
          ======================================== */}

          <div className="admin-panel">
            <h2>Recent Operations</h2>
            <DataTable
              columns={['Activity', 'Date & Time', 'Status']}
              rows={[
                {
                  Activity: 'Room 302 marked for maintenance',
                  'Date & Time': 'Oct 28, 2026 · 9:20 AM',
                  Status: 'Demo',
                },
                {
                  Activity: 'Reservation RH-1042 reviewed',
                  'Date & Time': 'Oct 28, 2026 · 10:42 AM',
                  Status: 'Demo',
                },
                {
                  Activity: 'Support ticket CS-023 received',
                  'Date & Time': 'Oct 28, 2026 · 9:15 AM',
                  Status: 'Demo',
                },
              ]}
            />
          </div>
        </>
      )}

      {/* ========================================
          ROOM AND TABLE DETAILS PAGE
      ======================================== */}

      {location.pathname === '/admin/rooms-tables' && (
        <RoomsAndTables />
      )}

      {location.pathname === '/admin/manage' && <AdminManage />}

      {/* ========================================
          ADMIN MANAGEMENT AND SUPPORT TABS
      ======================================== */}

      {tabs.length > 0 &&
        location.pathname !== '/admin/rooms-tables' &&
        location.pathname !== '/admin/manage' && (
          <>
            {/* ========================================
                MANAGEMENT NAVIGATION TABS
            ======================================== */}

            <div className="admin-tabs" role="tablist">
              {tabs.map((tab) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={active === tab}
                  className={active === tab ? 'is-active' : ''}
                  key={tab}
                  onClick={() => setSelected(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* ========================================
                MANAGEMENT TOOLBAR
            ======================================== */}

            {location.pathname === '/admin/manage' && (
              <div className="admin-toolbar">
                <p>Read-only demo interface. Changes are not saved.</p>
                <button
                  type="button"
                  className="admin-secondary-button"
                  disabled
                  title="Create actions are not connected to a data source"
                >
                  Add{' '}
                  {active === 'Tables'
                    ? 'Table'
                    : active?.replace(/s$/, '') || 'Record'}{' '}
                  · Demo only
                </button>
              </div>
            )}

            {/* ========================================
                MANAGEMENT AND SUPPORT DATA TABLE
            ======================================== */}

            <DataTable
              columns={
                active === 'Rooms'
                  ? [
                      'Room No.',
                      'Room Type',
                      'Description',
                      'Capacity',
                      'Price',
                      'Status',
                      'Actions',
                    ]
                  : active === 'Tables'
                    ? [
                        'Table No.',
                        'Seating Capacity',
                        'Status',
                        'Actions',
                      ]
                    : active === 'Room Reservations'
                      ? [
                          'Reservation ID',
                          'Customer',
                          'Room',
                          'Dates',
                          'Status',
                          'Actions',
                        ]
                      : active === 'Table Reservations'
                        ? [
                            'Reservation ID',
                            'Customer',
                            'Table',
                            'Date & Time',
                            'Status',
                            'Actions',
                          ]
                        : active === 'Combined Bookings'
                          ? [
                              'Booking ID',
                              'Customer',
                              'Room',
                              'Table',
                              'Dates & Times',
                              'Status',
                              'Actions',
                            ]
                          : active === 'Users'
                            ? [
                                'User',
                                'Email',
                                'Role',
                                'Account Status',
                                'Actions',
                              ]
                            : [
                                'Ticket ID',
                                'Customer',
                                'Subject',
                                'Category',
                                'Date Submitted',
                                'Status',
                                'Actions',
                              ]
              }
              rows={
                // ========================================
                // CUSTOMER SUPPORT TICKETS
                // ========================================

                location.pathname === '/admin/support'
                  ? sampleTickets.filter(
                      (ticket) =>
                        active === 'All Tickets' ||
                        ticket.Category === active ||
                        (active === 'Booking Issues' &&
                          ticket.Category === 'Booking Issues'),
                    )

                  // ========================================
                  // ROOM DETAILS
                  // ========================================

                  : active === 'Rooms'
                    ? rooms.map((room) => ({
                        'Room No.': room.number,
                        'Room Type': room.type,
                        Description: room.amenities
                          .slice(0, 2)
                          .join(', '),
                        Capacity: `${room.capacity} guests`,
                        Price: `₱${room.price.toLocaleString('en-PH')}/night`,
                        Status: room.status,
                        Actions: 'View (demo)',
                      }))

                    // ========================================
                    // RESTAURANT TABLE DETAILS
                    // ========================================

                    : active === 'Tables'
                      ? restaurantTables.map((table) => ({
                          'Table No.': table.number,
                          'Seating Capacity': `${table.capacity} guests`,
                          Status: table.status,
                          Actions: 'View (demo)',
                        }))

                      // ========================================
                      // ROOM RESERVATIONS
                      // ========================================

                      : active === 'Room Reservations'
                        ? sampleReservations.map(
                            ({
                              'Reservation ID': id,
                              Customer,
                              Room,
                              Dates,
                              Status,
                              Actions,
                            }) => ({
                              'Reservation ID': id,
                              Customer,
                              Room,
                              Dates,
                              Status,
                              Actions,
                            }),
                          )

                        // ========================================
                        // TABLE RESERVATIONS
                        // ========================================

                        : active === 'Table Reservations'
                          ? sampleReservations.map(
                              ({
                                'Reservation ID': id,
                                Customer,
                                Table,
                                'Date & Time': date,
                                Status,
                                Actions,
                              }) => ({
                                'Reservation ID': id,
                                Customer,
                                Table,
                                'Date & Time': date,
                                Status,
                                Actions,
                              }),
                            )

                          // ========================================
                          // COMBINED BOOKINGS
                          // ========================================

                          : active === 'Combined Bookings'
                            ? sampleReservations.map(
                                ({
                                  'Reservation ID': id,
                                  Customer,
                                  Room,
                                  Table,
                                  'Dates & Times': dates,
                                  Status,
                                  Actions,
                                }) => ({
                                  'Booking ID': id.replace('RH-', 'CB-'),
                                  Customer,
                                  Room,
                                  Table,
                                  'Dates & Times': dates,
                                  Status,
                                  Actions,
                                }),
                              )

                            // ========================================
                            // USER MANAGEMENT
                            // ========================================

                            : active === 'Users'
                              ? sampleUsers
                              : []
              }
              emptyMessage="No sample records match this section yet. These are frontend-only examples."
            />
          </>
        )}

      {/* ========================================
          NOTIFICATIONS PAGE
      ======================================== */}

      {location.pathname === '/admin/notifications' && (
        <div className="admin-panel">

          {/* ========================================
              NOTIFICATION TOOLBAR
          ======================================== */}

          <div className="admin-toolbar">
            <p>
              {read
                ? 'Demo notification view marked as read locally only.'
                : 'No notifications available in demo mode.'}
            </p>

            <button
              type="button"
              className="admin-secondary-button"
              onClick={() => setRead(true)}
            >
              Mark displayed as read (demo)
            </button>
          </div>

          {/* ========================================
              NOTIFICATION LIST
          ======================================== */}

          <div className="profile-activity-list">
            {sampleNotifications.map((item) => (
              <article key={item.title}>
                <span className="profile-activity-icon">N</span>

                <div>
                  <h3>{item.title}</h3>
                  <p>
                    {item.detail} · {item.time}
                  </p>
                </div>

                <span className="profile-activity-status">
                  {read ? 'Read' : 'New'}
                </span>
              </article>
            ))}
          </div>

          {/* ========================================
              NOTIFICATION DISCLAIMER
          ======================================== */}

          <p className="admin-demo-disclaimer">
            Sample notifications only. Read status is local UI state and is
            not persisted.
          </p>
        </div>
      )}

      {/* ========================================
          CUSTOMER SUPPORT INFORMATION
      ======================================== */}

      {location.pathname === '/admin/support' && (
        <p className="admin-note">
          Sample support tickets are shown in the selected category. Any
          review/action labels are illustrative and do not send replies or
          update a real ticket.
        </p>
      )}
    </section>
  );
}