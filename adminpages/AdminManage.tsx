import { useMemo, useState, type FormEvent } from "react";

import "../App.css";

type FieldType = "text" | "number" | "email" | "date" | "time" | "select";

type FieldDefinition = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  min?: number;
};

type RecordData = Record<string, string | number | string[]>;

type SectionKey =
  | "rooms"
  | "tables"
  | "roomReservations"
  | "tableReservations"
  | "combinedBookings"
  | "users";

type SectionDefinition = {
  label: string;
  description: string;
  singular: string
  idField: string;
  fields: FieldDefinition[];
  initialData: RecordData[];
  statusField?: string;
  allowCreate: boolean;
};

const roomStatuses = ["Available", "Reserved", "Occupied", "Maintenance"];

const reservationStatuses = [
  "Pending",
  "Confirmed",
  "Checked In",
  "Completed",
  "Cancelled",
];

const bookingStatuses = ["Pending", "Confirmed", "Completed", "Cancelled"];
const accountStatuses = ["Active", "Inactive", "Suspended"];
const commonAmenities = [
  "Wi-Fi",
  "Air Conditioning",
  "Television",
  "Private Bathroom",
  "Minibar",
  "Balcony",
  "Coffee Maker",
  "Hair Dryer",
  "Room Service",
  "Safe",
  "Refrigerator",
  "Desk",
];

const definitions: Record<SectionKey, SectionDefinition> = {
  rooms: {
    label: "Rooms",
    description:
      "Manage room information, capacity, pricing, availability, and amenities.",
    singular: "Room",
    idField: "roomNumber",
    statusField: "status",
    allowCreate: true,
    fields: [
      {
        key: "roomNumber",
        label: "Room Number",
        type: "text",
        required: true,
      },

      {
        key: "roomType",
        label: "Room Type",
        type: "select",
        required: true,
        options: ["Standard Room", "Deluxe Room", "Family Room", "Suite"],
      },

      {
        key: "capacity",
        label: "Capacity",
        type: "number",
        required: true,
        min: 1,
      },

      {
        key: "price",
        label: "Price per Night (₱)",
        type: "number",
        required: true,
        min: 0,
      },

      {
        key: "status",
        label: "Room Status",
        type: "select",
        required: true,
        options: roomStatuses,
      },
    ],

    initialData: [
      {
        id: "R-101",
        roomNumber: "101",
        roomType: "Standard Room",
        capacity: 2,
        price: 2500,
        status: "Available",
        amenities: [
          "Wi-Fi",
          "Air Conditioning",
          "Television",
          "Private Bathroom",
        ],

        additionalAmenities: "",
      },

      {
        id: "R-102",
        roomNumber: "102",
        roomType: "Deluxe Room",
        capacity: 2,
        price: 3500,
        status: "Reserved",
        amenities: [
          "Wi-Fi",
          "Air Conditioning",
          "Television",
          "Private Bathroom",
          "Minibar",
          "Balcony",
        ],

        additionalAmenities: "",
      },

      {
        id: "R-201",
        roomNumber: "201",
        roomType: "Family Room",
        capacity: 5,
        price: 5000,
        status: "Occupied",
        amenities: [
          "Wi-Fi",
          "Air Conditioning",
          "Television",
          "Private Bathroom",
          "Refrigerator",
        ],

        additionalAmenities: "Extra pillows",
      },

      {
        id: "R-301",
        roomNumber: "301",
        roomType: "Suite",
        capacity: 4,
        price: 6500,
        status: "Maintenance",
        amenities: [
          "Wi-Fi",
          "Air Conditioning",
          "Television",
          "Private Bathroom",
          "Minibar",
          "Balcony",
          "Coffee Maker",
          "Safe",
        ],

        additionalAmenities: "",
      },
    ],
  },

  tables: {
    label: "Tables",
    description:
      "Manage restaurant tables, seating capacity, and availability.",
    singular: "Table",
    idField: "tableNumber",
    statusField: "status",
    allowCreate: true,
    fields: [
      {
        key: "tableNumber",
        label: "Table Number",
        type: "text",
        required: true,
      },

      {
        key: "capacity",
        label: "Seating Capacity",
        type: "number",
        required: true,
        min: 1,
      },

      {
        key: "status",
        label: "Table Status",
        type: "select",
        required: true,
        options: ["Available", "Reserved", "Occupied", "Maintenance"],
      },
    ],

    initialData: [
      { id: "T-01", tableNumber: "T-01", capacity: 2, status: "Available" },
      { id: "T-02", tableNumber: "T-02", capacity: 4, status: "Reserved" },
      { id: "T-03", tableNumber: "T-03", capacity: 6, status: "Occupied" },
      { id: "T-04", tableNumber: "T-04", capacity: 4, status: "Available" },
    ],
  },

  roomReservations: {
    label: "Room Reservations",
    description: "Review and manage existing room reservation records.",
    singular: "Room Reservation",
    idField: "reservationId",
    statusField: "status",
    allowCreate: false,
    fields: [
      {
        key: "reservationId",
        label: "Reservation ID",
        type: "text",
        required: true,
      },

      { key: "customer", 
        label: "Customer", 
        type: "text", 
        required: true },

      {
        key: "room",
        label: "Room",
        type: "select",
        required: true,
        options: ["101", "102", "201", "301"],
      },

      {
        key: "checkIn",
        label: "Check-in Date",
        type: "date",
        required: true,
      },

      {
        key: "checkOut",
        label: "Check-out Date",
        type: "date",
        required: true,
      },

      {
        key: "status",
        label: "Reservation Status",
        type: "select",
        required: true,
        options: reservationStatuses,
      },
    ],

    initialData: [
      {
        id: "RR-1001",
        reservationId: "RR-1001",
        customer: "Alex Santos",
        room: "102",
        checkIn: "2026-11-05",
        checkOut: "2026-11-07",
        status: "Confirmed",
      },

      {
        id: "RR-1002",
        reservationId: "RR-1002",
        customer: "Jamie Reyes",
        room: "201",
        checkIn: "2026-11-10",
        checkOut: "2026-11-12",
        status: "Pending",
      },

      {
        id: "RR-1003",
        reservationId: "RR-1003",
        customer: "Taylor Cruz",
        room: "101",
        checkIn: "2026-11-15",
        checkOut: "2026-11-17",
        status: "Completed",
      },
    ],
  },

  tableReservations: {
    label: "Table Reservations",
    description: "Manage existing restaurant reservations and guest schedules.",
    singular: "Table Reservation",
    idField: "reservationId",
    statusField: "status",
    allowCreate: false,
    fields: [
      {
        key: "reservationId",
        label: "Reservation ID",
        type: "text",
        required: true,
      },

      { key: "customer",
        label: "Customer", 
        type: "text", 
        required: true },

      {
        key: "table",
        label: "Table",
        type: "select",
        required: true,
        options: ["T-01", "T-02", "T-03", "T-04"],
      },

      {
        key: "guests",
        label: "Number of Guests",
        type: "number",
        required: true,
        min: 1,
      },

      {
        key: "reservationDate",
        label: "Reservation Date",
        type: "date",
        required: true,
      },

      {
        key: "reservationTime",
        label: "Reservation Time",
        type: "time",
        required: true,
      },

      {
        key: "status",
        label: "Reservation Status",
        type: "select",
        required: true,
        options: reservationStatuses,
      },
    ],

    initialData: [
      {
        id: "TR-2001",
        reservationId: "TR-2001",
        customer: "Morgan Lee",
        table: "T-02",
        guests: 4,
        reservationDate: "2026-11-05",
        reservationTime: "18:00",
        status: "Confirmed",
      },

      {
        id: "TR-2002",
        reservationId: "TR-2002",
        customer: "Jamie Reyes",
        table: "T-01",
        guests: 2,
        reservationDate: "2026-11-06",
        reservationTime: "19:00",
        status: "Pending",
      },

      {
        id: "TR-2003",
        reservationId: "TR-2003",
        customer: "Taylor Cruz",
        table: "T-04",
        guests: 3,
        reservationDate: "2026-11-08",
        reservationTime: "12:30",
        status: "Completed",
      },
    ],
  },

  combinedBookings: {
    label: "Combined Bookings",
    description:
      "Review and manage existing bookings that include a room and restaurant table.",
    singular: "Combined Booking",
    idField: "bookingId",
    statusField: "status",
    allowCreate: false,
    fields: [
      {
        key: "bookingId",
        label: "Booking ID",
        type: "text",
        required: true,
      },

      { key: "customer", label: "Customer", type: "text", required: true },

      {
        key: "roomReservation",
        label: "Room Reservation",
        type: "select",
        required: true,
        options: ["RR-1001", "RR-1002", "RR-1003"],
      },

      {
        key: "tableReservation",
        label: "Table Reservation",
        type: "select",
        required: true,
        options: ["TR-2001", "TR-2002", "TR-2003"],
      },

      {
        key: "schedule",
        label: "Booking Schedule",
        type: "date",
        required: true,
      },

      {
        key: "status",
        label: "Booking Status",
        type: "select",
        required: true,
        options: bookingStatuses,
      },
    ],

    initialData: [
      {
        id: "CB-3001",
        bookingId: "CB-3001",
        customer: "Alex Santos",
        roomReservation: "RR-1001",
        tableReservation: "TR-2001",
        schedule: "2026-11-05",
        status: "Confirmed",
      },

      {
        id: "CB-3002",
        bookingId: "CB-3002",
        customer: "Taylor Cruz",
        roomReservation: "RR-1003",
        tableReservation: "TR-2003",
        schedule: "2026-11-15",
        status: "Pending",
      },
    ],
  },

  users: {
    label: "Users",
    description:
      "Manage user account information, assigned roles, and account status.",
    singular: "User",
    idField: "userId",
    statusField: "accountStatus",
    allowCreate: true,
    fields: [
      { key: "userId", label: "User ID", type: "text", required: true },

      { key: "fullName", label: "Full Name", type: "text", required: true },

      { key: "email", label: "Email Address", type: "email", required: true },

      {
        key: "role",
        label: "Role",
        type: "select",
        required: true,
        options: ["Customer", "Staff", "Admin"],
      },

      {
        key: "accountStatus",
        label: "Account Status",
        type: "select",
        required: true,
        options: accountStatuses,
      },
    ],

    initialData: [
      {
        id: "U-001",
        userId: "U-001",
        fullName: "Alex Santos",
        email: "alex.santos\@example.com",
        role: "Customer",
        accountStatus: "Active",
      },

      {
        id: "U-002",
        userId: "U-002",
        fullName: "Jamie Reyes",
        email: "jamie.reyes\@example.com",
        role: "Staff",
        accountStatus: "Active",
      },

      {
        id: "U-003",
        userId: "U-003",
        fullName: "Morgan Lee",
        email: "morgan.lee\@example.com",
        role: "Customer",
        accountStatus: "Inactive",
      },

      {
        id: "U-004",
        userId: "U-004",
        fullName: "Taylor Cruz",
        email: "taylor.cruz\@example.com",
        role: "Admin",
        accountStatus: "Active",
      },
    ],
  },
};

const sectionKeys: SectionKey[] = [
  "rooms",
  "tables",
  "roomReservations",
  "tableReservations",
  "combinedBookings",
  "users",
];

type ModalState =
  | { mode: "create"; section: SectionKey }
  | { mode: "view"; section: SectionKey; record: RecordData }
  | { mode: "edit"; section: SectionKey; record: RecordData }
  | null;

type FormValues = Record<string, string>;

function createInitialState(): Record<SectionKey, RecordData[]> {
  return {
    rooms: definitions.rooms.initialData.map((item) => ({ ...item })),

    tables: definitions.tables.initialData.map((item) => ({ ...item })),

    roomReservations: definitions.roomReservations.initialData.map((item) => ({
      ...item,
    })),

    tableReservations: definitions.tableReservations.initialData.map(
      (item) => ({
        ...item,
      }),
    ),

    combinedBookings: definitions.combinedBookings.initialData.map((item) => ({
      ...item,
    })),

    users: definitions.users.initialData.map((item) => ({ ...item })),
  };
}

function toText(value: string | number | string[] | undefined): string {
  if (value === undefined) return "";

  if (Array.isArray(value)) return value.join(", ");

  return String(value);
}

function statusClass(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function makeId(section: SectionKey, records: RecordData[]): string {
  const prefixes: Record<SectionKey, string> = {
    rooms: "R",
    tables: "T",
    roomReservations: "RR",
    tableReservations: "TR",
    combinedBookings: "CB",
    users: "U",
  };

  let next = records.length + 1;

  let candidate = `${prefixes[section]}-${String(next).padStart(3, "0")}`;

  while (records.some((record) => String(record.id) === candidate)) {
    next += 1;

    candidate = `${prefixes[section]}-${String(next).padStart(3, "0")}`;
  }

  return candidate;
}

export default function AdminManage() {
  const [data, setData] =
    useState<Record<SectionKey, RecordData[]>>(createInitialState);

  const [activeSection, setActiveSection] = useState<SectionKey>("rooms");

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("All Statuses");

  const [modal, setModal] = useState<ModalState>(null);

  const [formValues, setFormValues] = useState<FormValues>({});

  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  const [additionalAmenities, setAdditionalAmenities] = useState("");

  const [notice, setNotice] = useState("");

  const [page, setPage] = useState(1);

  const pageSize = 5;

  const definition = definitions[activeSection];

  const records = data[activeSection];

  const isReadOnlySection =
    activeSection === "roomReservations" ||
    activeSection === "tableReservations" ||
    activeSection === "combinedBookings";

  function canEditRecord(record: RecordData): boolean {
    if (isReadOnlySection) return false;
    if (activeSection === "users") return record.role === "Staff";
    return activeSection === "rooms" || activeSection === "tables";
  }

  function canDeleteRecord(record: RecordData): boolean {
    if (isReadOnlySection) return false;
    if (activeSection === "users") {
      return record.role === "Staff" || record.role === "Customer";
    }
    return activeSection === "rooms" || activeSection === "tables";
  }

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchesSearch =
        !query ||
        Object.values(record).some((value) => {
          const searchableValue = Array.isArray(value)
            ? value.join(" ")
            : String(value);

          return searchableValue.toLowerCase().includes(query);
        });

      const statusValue = definition.statusField
        ? String(record[definition.statusField] ?? "")
        : "";

      const matchesStatus =
        statusFilter === "All Statuses" || statusValue === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [records, search, statusFilter, definition.statusField]);

  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize));

  const currentPage = Math.min(page, pageCount);

  const visibleRecords = filteredRecords.slice(
    (currentPage - 1) * pageSize,

    currentPage * pageSize,
  );

  const statusOptions = definition.statusField
    ? Array.from(
        new Set([
          ...definition.fields

            .filter((field) => field.key === definition.statusField)

            .flatMap((field) => field.options ?? []),

          ...records.map((record) =>
            String(record[definition.statusField!] ?? ""),
          ),
        ]),
      ).filter(Boolean)
    : [];

  function resetFilters() {
    setSearch("");

    setStatusFilter("All Statuses");

    setPage(1);
  }

  function openCreate() {
    // Reservation creation is intentionally disabled for Admins.

    if (!definitions[activeSection].allowCreate) return;

    const values: FormValues = {};

    definitions[activeSection].fields.forEach((field) => {
      values[field.key] = "";
    });

    if (activeSection === "users") {
      values.role = "Staff";
      values.accountStatus = "Active";
    }

    if (activeSection === "rooms") {
      values.status = "Available";

      setSelectedAmenities([]);

      setAdditionalAmenities("");
    } else {
      setSelectedAmenities([]);

      setAdditionalAmenities("");
    }

    setFormValues(values);

    setNotice("");

    setModal({ mode: "create", section: activeSection });
  }

  function openView(record: RecordData) {
    setNotice("");

    setModal({ mode: "view", section: activeSection, record });
  }

  function openEdit(record: RecordData) {
    if (!canEditRecord(record)) return;

    const values: FormValues = {};

    definitions[activeSection].fields.forEach((field) => {
      values[field.key] = toText(record[field.key]);
    });

    if (activeSection === "rooms") {
      const amenities = record.amenities;

      setSelectedAmenities(Array.isArray(amenities) ? [...amenities] : []);

      setAdditionalAmenities(toText(record.additionalAmenities));
    } else {
      setSelectedAmenities([]);

      setAdditionalAmenities("");
    }

    setFormValues(values);

    setNotice("");

    setModal({ mode: "edit", section: activeSection, record });
  }

  function closeModal() {
    setModal(null);

    setFormValues({});

    setSelectedAmenities([]);

    setAdditionalAmenities("");

    setNotice("");
  }

  function handleSectionChange(section: SectionKey) {
    setActiveSection(section);

    resetFilters();

    closeModal();

    setNotice("");
  }

  function toggleAmenity(amenity: string) {
    setSelectedAmenities((current) =>
      current.includes(amenity)
        ? current.filter((item) => item !== amenity)
        : [...current, amenity],
    );
  }

  function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!modal || (modal.mode !== "create" && modal.mode !== "edit")) {
      return;
    }

    const section = modal.section;

    const currentDefinition = definitions[section];

    // User creation is restricted to Staff accounts; Staff roles cannot be changed.
    if (section === "users") {
      if (modal.mode === "create") {
        formValues.role = "Staff";
      } else if (modal.mode === "edit" && modal.record.role !== "Staff") {
        setNotice("Only Staff accounts can be edited.");
        return;
      } else {
        formValues.role = "Staff";
      }
    }

    // Defense in depth: do not permit reservation creation through this handler.

    if (modal.mode === "create" && !currentDefinition.allowCreate) {
      setNotice("Creating reservation records is not available to Admins.");

      return;
    }

    const currentRecords = data[section];

    for (const field of currentDefinition.fields) {
      const value = (formValues[field.key] ?? "").trim();

      if (field.required && !value) {
        setNotice(`Please complete the required field: ${field.label}.`);

        return;
      }

      if (field.type === "number" && value) {
        const numberValue = Number(value);

        if (!Number.isFinite(numberValue)) {
          setNotice(`${field.label} must be a valid number.`);

          return;
        }

        if (field.min !== undefined && numberValue < field.min) {
          setNotice(`${field.label} must be at least ${field.min}.`);

          return;
        }
      }

      if (field.type === "email" && value) {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(value)) {
          setNotice("Please enter a valid email address.");

          return;
        }
      }
    }

    if (section === "rooms") {
      const roomNumber = (formValues.roomNumber ?? "").trim();

      const duplicateRoom = currentRecords.some(
        (record) =>
          String(record.roomNumber).toLowerCase() ===
            roomNumber.toLowerCase() &&
          (modal.mode !== "edit" ||
            String(record.id) !== String(modal.record.id)),
      );

      if (duplicateRoom) {
        setNotice("A room with this room number already exists.");

        return;
      }

      const price = Number(formValues.price);

      const capacity = Number(formValues.capacity);

      if (!Number.isFinite(price) || price < 0) {
        setNotice("Room price must be zero or greater.");

        return;
      }

      if (!Number.isInteger(capacity) || capacity < 1) {
        setNotice("Room capacity must be a whole number greater than zero.");

        return;
      }
    }

    if (
      section === "roomReservations" &&
      formValues.checkIn &&
      formValues.checkOut &&
      formValues.checkOut <= formValues.checkIn
    ) {
      setNotice("Check-out date must be later than check-in date.");

      return;
    }

    const newRecord: RecordData = {
      ...(modal.mode === "edit" ? modal.record : {}),
    };

    currentDefinition.fields.forEach((field) => {
      const rawValue = (formValues[field.key] ?? "").trim();

      newRecord[field.key] =
        field.type === "number" ? Number(rawValue) : rawValue;
    });

    if (section === "rooms") {
      newRecord.amenities = [...selectedAmenities];

      newRecord.additionalAmenities = additionalAmenities.trim();
    }

    const primaryValue = String(
      newRecord[currentDefinition.idField] ?? "",
    ).toLowerCase();

    const duplicateId = currentRecords.some(
      (record) =>
        String(record[currentDefinition.idField] ?? "").toLowerCase() ===
          primaryValue &&
        (modal.mode !== "edit" ||
          String(record.id) !== String(modal.record.id)),
    );

    if (duplicateId) {
      setNotice(`${currentDefinition.idField} must be unique.`);

      return;
    }

    if (modal.mode === "create") {
      newRecord.id =
        String(newRecord[currentDefinition.idField] ?? "") ||
        makeId(section, currentRecords);

      setData((previous) => ({
        ...previous,

        [section]: [...previous[section], newRecord],
      }));

      setNotice(`${currentDefinition.singular} added successfully.`);
    } else {
      setData((previous) => ({
        ...previous,

        [section]: previous[section].map((record) =>
          String(record.id) === String(modal.record.id) ? newRecord : record,
        ),
      }));

      setNotice(`${currentDefinition.singular} updated successfully.`);
    }

    setPage(1);

    setSearch("");

    setStatusFilter("All Statuses");

    closeModal();

    setNotice(
      modal.mode === "create"
        ? `${currentDefinition.singular} added successfully.`
        : `${currentDefinition.singular} updated successfully.`,
    );
  }

  function deleteRecord(record: RecordData) {
    if (!canDeleteRecord(record)) return;

    const identifier = String(
      record[definition.idField] ?? record.id ?? "this record",
    );

    const confirmed = window.confirm(
      `Delete ${definition.singular.toLowerCase()} "${identifier}"? This action cannot be undone.`,
    );

    if (!confirmed) return;

    setData((previous) => ({
      ...previous,

      [activeSection]: previous[activeSection].filter(
        (item) => String(item.id) !== String(record.id),
      ),
    }));

    setPage(1);

    setNotice(`${definition.singular} deleted.`);

    if (
      modal &&
      "record" in modal &&
      String(modal.record.id) === String(record.id)
    ) {
      closeModal();

      setNotice(`${definition.singular} deleted.`);
    }
  }

  function renderCell(record: RecordData, fieldKey: string): string {
    const value = record[fieldKey];

    if (fieldKey === "price" && typeof value === "number") {
      return `₱${value.toLocaleString("en-PH")}`;
    }

    if (fieldKey === "amenities") {
      const amenities = Array.isArray(value) ? value : [];

      return `${amenities.length} selected`;
    }

    if (fieldKey === "additionalAmenities") {
      return toText(value);
    }

    return toText(value) || "—";
  }

  const modalDefinition = modal ? definitions[modal.section] : null;

  return (
    <div className="admin-crud-page">
      <div className="admin-crud-summary">
        <div className="admin-crud-summary-card">
          <span>Total Rooms</span>

          <strong>{data.rooms.length}</strong>
        </div>

        <div className="admin-crud-summary-card">
          <span>Total Tables</span>

          <strong>{data.tables.length}</strong>
        </div>

        <div className="admin-crud-summary-card">
          <span>Room Reservations</span>

          <strong>{data.roomReservations.length}</strong>
        </div>

        <div className="admin-crud-summary-card">
          <span>Table Reservations</span>

          <strong>{data.tableReservations.length}</strong>
        </div>

        <div className="admin-crud-summary-card">
          <span>Combined Bookings</span>

          <strong>{data.combinedBookings.length}</strong>
        </div>

        <div className="admin-crud-summary-card">
          <span>Users</span>

          <strong>{data.users.length}</strong>
        </div>
      </div>

      <div
        className="admin-crud-tabs"
        role="tablist"
        aria-label="Admin sections"
      >
        {sectionKeys.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeSection === key}
            className={activeSection === key ? "active" : ""}
            onClick={() => handleSectionChange(key)}
          >
            {definitions[key].label}

            <span>{data[key].length}</span>
          </button>
        ))}
      </div>

      <div className="admin-crud-panel">
        <div className="admin-crud-section-heading">
          <div>
            <h2>{definition.label}</h2>

            <p>{definition.description}</p>
          </div>

          {definition.allowCreate && (
            <button
              className="admin-crud-add"
              type="button"
              onClick={openCreate}
            >
              + Add {definition.singular}
            </button>
          )}
        </div>

        {notice && !modal && (
          <div className="admin-crud-notice" role="status">
            {notice}

            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </div>
        )}

        <div className="admin-crud-toolbar">
          <input
            type="search"
            value={search}
            placeholder={`Search ${definition.label.toLowerCase()}...`}
            aria-label={`Search ${definition.label}`}
            onChange={(event) => {
              setSearch(event.target.value);

              setPage(1);
            }}
          />

          {definition.statusField && (
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);

                setPage(1);
              }}
            >
              <option value="All Statuses">All Statuses</option>

              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          )}

          <span className="admin-crud-result-count">
            {filteredRecords.length} record
            {filteredRecords.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="admin-crud-table-wrap">
          {visibleRecords.length === 0 ? (
            <div className="admin-crud-empty">
              <span aria-hidden="true">⌕</span>

              <h3>No records found</h3>

              <p>
                {records.length === 0
                  ? `There are no ${definition.label.toLowerCase()} yet.`
                  : "Try changing your search or status filter."}
              </p>

              {records.length === 0 && definition.allowCreate && (
                <button
                  type="button"
                  className="admin-crud-add"
                  onClick={openCreate}
                >
                  + Add {definition.singular}
                </button>
              )}
            </div>
          ) : (
            <table className="admin-crud-table">
              <thead>
                <tr>
                  {definition.fields.map((field) => (
                    <th key={field.key}>
                      {field.key === "amenities" ? "Amenities" : field.label}
                    </th>
                  ))}

                  <th className="admin-crud-actions-heading">Actions</th>
                </tr>
              </thead>

              <tbody>
                {visibleRecords.map((record) => (
                  <tr key={String(record.id)}>
                    {definition.fields.map((field) => {
                      const value = renderCell(record, field.key);

                      const isStatus = field.key === definition.statusField;

                      return (
                        <td key={field.key}>
                          {isStatus ? (
                            <span
                              className={`admin-crud-status ${statusClass(value)}`}
                            >
                              {value}
                            </span>
                          ) : (
                            value
                          )}
                        </td>
                      );
                    })}

                    <td>
                      <div className="admin-crud-row-actions">
                        <button
                          type="button"
                          className="admin-crud-view"
                          onClick={() => openView(record)}
                        >
                          View
                        </button>

                        {canEditRecord(record) && (
                          <button
                            type="button"
                            className="admin-crud-edit"
                            onClick={() => openEdit(record)}
                          >
                            Edit
                          </button>
                        )}

                        {canDeleteRecord(record) && (
                          <button
                            type="button"
                            className="admin-crud-delete"
                            onClick={() => deleteRecord(record)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {filteredRecords.length > 0 && (
          <div className="admin-crud-pagination">
            <span>
              Showing {(currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, filteredRecords.length)} of{" "}
              {filteredRecords.length}
            </span>

            <div>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>

              <span>
                Page {currentPage} of {pageCount}
              </span>

              <button
                type="button"
                disabled={currentPage >= pageCount}
                onClick={() =>
                  setPage((current) => Math.min(pageCount, current + 1))
                }
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="admin-crud-disclaimer">
        Demo data only. Changes are held in frontend state and are not
        permanently saved.
      </p>

      {modal && modalDefinition && (
        <div
          className="admin-crud-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section
            className="admin-crud-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-crud-modal-title"
          >
            <div className="admin-crud-modal-head">
              <div>
                <p className="eyebrow">ADMIN MANAGEMENT</p>

                <h2 id="admin-crud-modal-title">
                  {modal.mode === "create"
                    ? `Add ${modalDefinition.singular}`
                    : modal.mode === "edit"
                      ? `Edit ${modalDefinition.singular}`
                      : `${modalDefinition.singular} Details`}
                </h2>
              </div>

              <button
                type="button"
                aria-label="Close dialog"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            {modal.mode === "view" ? (
              <>
                <div className="admin-crud-details">
                  {modalDefinition.fields.map((field) => {
                    const value = modal.record[field.key];

                    return (
                      <div className="admin-crud-detail-row" key={field.key}>
                        <span>{field.label}</span>

                        <strong>
                          {field.key === "price" && typeof value === "number"
                            ? `₱${value.toLocaleString("en-PH")}`
                            : field.key === "amenities"
                              ? Array.isArray(value)
                                ? `${value.length} selected`
                                : "None specified"
                              : toText(value) || "—"}
                        </strong>
                      </div>
                    );
                  })}

                  {modal.section === "rooms" && (
                    <div className="admin-crud-amenities-details">
                      <h3>Amenities</h3>

                      {Array.isArray(modal.record.amenities) &&
                      modal.record.amenities.length > 0 ? (
                        <div className="admin-crud-amenity-list">
                          {modal.record.amenities.map((amenity) => (
                            <span
                              className="admin-crud-amenity-chip"
                              key={amenity}
                            >
                              {amenity}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p>No standard amenities specified.</p>
                      )}

                      {toText(modal.record.additionalAmenities).trim() && (
                        <div className="admin-crud-additional-amenities">
                          <strong>Additional Amenities</strong>

                          <p>{toText(modal.record.additionalAmenities)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {modal.section === "combinedBookings" &&
                    (() => {
                      const roomReservation = data.roomReservations.find(
                        (item) =>
                          String(item.reservationId) ===
                          toText(modal.record.roomReservation),
                      );
                      const tableReservation = data.tableReservations.find(
                        (item) =>
                          String(item.reservationId) ===
                          toText(modal.record.tableReservation),
                      );
                      const room = data.rooms.find(
                        (item) =>
                          String(item.roomNumber) ===
                          toText(roomReservation?.room),
                      );
                      const table = data.tables.find(
                        (item) =>
                          String(item.tableNumber) ===
                          toText(tableReservation?.table),
                      );

                      return (
                        <div className="admin-crud-details">
                          <div className="admin-crud-detail-row">
                            <span>Room Details</span>
                            <strong>
                              {room
                                ? `Room ${toText(room.roomNumber)} · ${toText(room.roomType)} · ₱${Number(room.price ?? 0).toLocaleString("en-PH")}/night`
                                : `Room ${toText(roomReservation?.room) || "—"}`}
                            </strong>
                          </div>
                          <div className="admin-crud-detail-row">
                            <span>Room Schedule</span>
                            <strong>
                              {`${toText(roomReservation?.checkIn) || "—"} to ${toText(roomReservation?.checkOut) || "—"}`}
                            </strong>
                          </div>
                          <div className="admin-crud-detail-row">
                            <span>Table Details</span>
                            <strong>
                              {table
                                ? `${toText(table.tableNumber)} · Capacity ${toText(table.capacity)}`
                                : toText(tableReservation?.table) || "—"}
                            </strong>
                          </div>
                          <div className="admin-crud-detail-row">
                            <span>Table Schedule</span>
                            <strong>
                              {`${toText(tableReservation?.reservationDate) || "—"} at ${toText(tableReservation?.reservationTime) || "—"}`}
                            </strong>
                          </div>
                          <div className="admin-crud-detail-row">
                            <span>Guests</span>
                            <strong>
                              {toText(tableReservation?.guests) || "—"}
                            </strong>
                          </div>
                        </div>
                      );
                    })()}
                </div>

                <div className="admin-crud-form-actions">
                  <button
                    type="button"
                    className="admin-crud-cancel"
                    onClick={closeModal}
                  >
                    Close
                  </button>

                  {canEditRecord(modal.record) && (
                    <button
                      type="button"
                      className="admin-crud-add"
                      onClick={() => openEdit(modal.record)}
                    >
                      Edit Record
                    </button>
                  )}
                </div>
              </>
            ) : (
              <form onSubmit={saveRecord}>
                {notice && (
                  <div className="admin-crud-form-error" role="alert">
                    {notice}
                  </div>
                )}

                <div className="admin-crud-fields">
                  {modalDefinition.fields.map((field) => {
                    // The Add User form always creates a Staff account, so Role is not selectable.
                    if (
                      modal.section === "users" &&
                      field.key === "role" &&
                      modal.mode === "create"
                    ) {
                      return null;
                    }

                    return (
                      <label key={field.key}>
                        <span>
                          {field.label}
                          {field.required && (
                            <span className="admin-crud-required"> *</span>
                          )}
                        </span>

                        {modal.section === "users" &&
                        field.key === "role" &&
                        modal.mode === "edit" ? (
                          <input type="text" value="Staff" readOnly />
                        ) : field.type === "select" ? (
                          <select
                            required={field.required}
                            value={formValues[field.key] ?? ""}
                            onChange={(event) =>
                              setFormValues((current) => ({
                                ...current,
                                [field.key]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Select {field.label}</option>
                            {(field.options ?? []).map((option) => (
                              <option value={option} key={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.type}
                            required={field.required}
                            min={
                              field.type === "number"
                                ? (field.min ?? 0)
                                : undefined
                            }
                            step={field.type === "number" ? "any" : undefined}
                            value={formValues[field.key] ?? ""}
                            onChange={(event) =>
                              setFormValues((current) => ({
                                ...current,
                                [field.key]: event.target.value,
                              }))
                            }
                          />
                        )}
                      </label>
                    );
                  })}
                </div>

                {modal.section === "rooms" && (
                  <div className="admin-crud-amenities-form">
                    <div className="admin-crud-amenities-heading">
                      <h3>Room Amenities</h3>

                      <span>Optional</span>
                    </div>

                    <p>
                      Select all amenities available in this room. You can leave
                      this section empty if no amenities have been specified.
                    </p>

                    <div className="admin-crud-amenities-options">
                      {commonAmenities.map((amenity) => (
                        <label
                          className="admin-crud-amenity-option"
                          key={amenity}
                        >
                          <input
                            type="checkbox"
                            checked={selectedAmenities.includes(amenity)}
                            onChange={() => toggleAmenity(amenity)}
                          />

                          <span>{amenity}</span>
                        </label>
                      ))}
                    </div>

                    <label className="admin-crud-additional-field">
                      <span>Additional Amenities (Optional)</span>

                      <textarea
                        rows={3}
                        value={additionalAmenities}
                        placeholder="e.g. Extra pillows, ocean view, bathtub"
                        onChange={(event) =>
                          setAdditionalAmenities(event.target.value)
                        }
                      />
                    </label>
                  </div>
                )}

                {modal.section === "combinedBookings" && (
                  <p className="admin-crud-help">
                    This form edits an existing combined booking. Both its room
                    reservation and table reservation references are retained.
                  </p>
                )}

                <div className="admin-crud-form-actions">
                  <button
                    type="button"
                    className="admin-crud-cancel"
                    onClick={closeModal}
                  >
                    Cancel
                  </button>

                  <button type="submit" className="admin-crud-add">
                    {modal.mode === "create" ? "Add Record" : "Save Changes"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
